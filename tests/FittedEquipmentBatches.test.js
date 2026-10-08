import * as THREE from 'three';
import { jest } from '@jest/globals';
import { batchFittedEquipment } from '../src/art/FittedEquipmentBatches.js';
import { applyActorStealthAppearance, restoreActorStealthAppearance } from '../src/entities/ActorStealthAppearance.js';
import { prepareFittedEquipment, applyFittedEquipment, clearFittedEquipment } from '../src/art/FittedEquipment.js';
import { applyAuthoredEquipmentSurface } from '../src/art/AuthoredEquipmentSurfaces.js';
import { AUTHORED_ASSETS } from '../src/assets/authoredEquipment.generated.js';

function fixture() {
    const root = new THREE.Group(), bones = [new THREE.Bone(), new THREE.Bone()];
    bones[0].add(bones[1]); root.add(bones[0]); bones[1].position.y = 1;
    root.updateMatrixWorld(true);
    const inverses = new THREE.Skeleton(bones).boneInverses;
    const parts = [0, 1].map((offset, i) => {
        const geometry = new THREE.BoxGeometry(.3, .3, .3).translate(offset, 1, 0);
        geometry.clearGroups();
        const count = geometry.attributes.position.count;
        const indices = new Uint16Array(count * 4), weights = new Float32Array(count * 4);
        for (let vertex = 0; vertex < count; vertex++) { indices[vertex * 4] = 1; weights[vertex * 4] = 1; }
        geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
        geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
        const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial({color: '#aaaabb', roughness: .4}));
        mesh.name = `piece-${i}`; mesh.bind(new THREE.Skeleton(bones, inverses.map(matrix => matrix.clone())), new THREE.Matrix4());
        mesh.castShadow = true; mesh.receiveShadow = true;
        Object.assign(mesh.userData, {authoredEquipment: true, fittedParent: root, slot: ['chest', 'gloves'][i]});
        root.add(mesh); return mesh;
    });
    return {root, bones, parts};
}

function surface(mesh) {
    mesh.skeleton.update();
    const position = new THREE.Vector3(), geometry = mesh.geometry;
    return Array.from({length: geometry.index.count}, (_, index) => {
        const vertex = geometry.index.getX(index);
        position.fromBufferAttribute(geometry.attributes.position, vertex);
        return { position: mesh.applyBoneTransform(vertex, position).applyMatrix4(mesh.matrixWorld).toArray(),
            attributes: Object.fromEntries(Object.entries(geometry.attributes).map(([name, attribute]) =>
                [name, Array.from({length: attribute.itemSize}, (_, component) => attribute.getComponent(vertex, component))])) };
    });
}

function skeletonSharingFixture(differentInverse = false) {
    const {root: scene, parts, bones} = fixture();
    bones[0].name = 'pelvis'; bones[1].name = 'spine_01';
    parts[0].name = 'Fighter_Body'; parts[0].userData = {}; parts[1].userData = {};
    const sourceScene = new THREE.Group(), second = parts[1].clone(false);
    if (differentInverse) {
        const inverses = second.skeleton.boneInverses.map(matrix => matrix.clone());
        inverses[1].elements[12] += .25;
        second.skeleton = new THREE.Skeleton(second.skeleton.bones, inverses);
    }
    sourceScene.add(parts[1], second);
    for (const name of ['upperarm_l', 'lowerarm_l', 'upperarm_r', 'lowerarm_r', 'neck_01']) {
        const bone = new THREE.Bone(); bone.name = name; bone.position.y = name.startsWith('lower') ? 2 : 1; scene.add(bone);
    }
    const root = new THREE.Group(); root.userData.authoredClass = 'Fighter'; root.userData.fittedEquipmentBatching = false; root.add(scene);
    prepareFittedEquipment(root, scene, async () => ({scene: sourceScene}));
    const equipment = {chest: {id: 'mail', name: 'Plate Mail', baseName: 'Plate Mail', slot: 'chest', type: 'ARMOR', rarity: 'Rare'}};
    const gear = () => { const meshes = []; root.traverse(mesh => { if (mesh.userData.authoredEquipment && mesh.isSkinnedMesh) meshes.push(mesh); }); return meshes; };
    return {root, scene, sourceScene, bones, equipment, gear, source: parts[1].skeleton, body: parts[0].skeleton};
}

test('quality changes reload the matching wearable; explicit original path remains reversible', async () => {
    const current = skeletonSharingFixture(), paths = [];
    prepareFittedEquipment(current.root, current.scene, async path => { paths.push(path); return {scene: current.sourceScene}; });
    const catalog = AUTHORED_ASSETS.items['Plate Mail'];
    for (const quality of ['high', 'low']) {
        current.root.userData.authoredQuality = quality;
        expect(applyFittedEquipment(current.root, current.equipment).changed).toBe(true);
        await current.root.userData.equipmentReady;
        expect(paths.at(-1)).toBe(catalog.runtimeModels.standard.Fighter[quality]);
        expect(current.root.userData.equipmentVisualFallback).toEqual([]);
        expect(applyFittedEquipment(current.root, current.equipment).changed).toBe(false);
    }
    current.root.userData.fittedEquipmentLOD = false;
    expect(applyFittedEquipment(current.root, current.equipment).changed).toBe(true);
    await current.root.userData.equipmentReady;
    expect(paths.at(-1)).toBe(catalog.models.standard.Fighter);
    clearFittedEquipment(current.root);
});

test('a missing derivative uses the registered delivered fallback and records it', async () => {
    const current = skeletonSharingFixture(), catalog = AUTHORED_ASSETS.items['Plate Mail'];
    const loader = jest.fn(async path => {
        if (path === catalog.models.standard.Fighter) return {scene: current.sourceScene};
        throw new Error('Missing runtime copy');
    });
    prepareFittedEquipment(current.root, current.scene, loader);
    applyFittedEquipment(current.root, current.equipment); await current.root.userData.equipmentReady;
    expect(loader.mock.calls.map(([path]) => path)).toEqual([catalog.runtimeModels.standard.Fighter.high, catalog.models.standard.Fighter]);
    expect(current.root.userData.equipmentVisualMissing).toEqual([]);
    expect(current.root.userData.equipmentVisualFallback).toEqual(['chest']);
    expect(current.root.userData.equipmentVisualItemCount).toBe(1);
    clearFittedEquipment(current.root);
    expect(current.root.userData.equipmentVisualFallback).toEqual([]);
});

test('failed fitted binding releases completed local parts without disposing cached assets or masking the body', async () => {
    const current = skeletonSharingFixture();
    const first = current.sourceScene.children[0], bad = current.sourceScene.children[1];
    const unknown = new THREE.Bone(); unknown.name = 'missing-joint';
    bad.skeleton = new THREE.Skeleton([unknown]);
    const sharedMaterial = first.material, sharedGeometry = first.geometry;
    const materialDispose = jest.spyOn(sharedMaterial, 'dispose'), geometryDispose = jest.spyOn(sharedGeometry, 'dispose');
    const bodyDispose = jest.spyOn(current.body, 'dispose'), sourceDispose = jest.spyOn(current.source, 'dispose');
    const originalClone = sharedMaterial.clone, owned = [];
    jest.spyOn(sharedMaterial, 'clone').mockImplementation(function () {
        const clone = originalClone.call(this); owned.push(jest.spyOn(clone, 'dispose')); return clone;
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
        const bodyGeometry = current.root.getObjectByName('Fighter_Body').geometry;
        applyFittedEquipment(current.root, current.equipment); await current.root.userData.equipmentReady;
        expect(warn).toHaveBeenCalledTimes(1); expect(owned).toHaveLength(1);
        expect(owned[0]).toHaveBeenCalledTimes(1);
        expect(current.gear()).toHaveLength(0);
        expect(current.root.getObjectByName('Fighter_Body').geometry).toBe(bodyGeometry);
        expect(current.root.userData.equipmentVisualSignature).toBe('');
        expect(materialDispose).not.toHaveBeenCalled(); expect(geometryDispose).not.toHaveBeenCalled();
        expect(bodyDispose).not.toHaveBeenCalled(); expect(sourceDispose).not.toHaveBeenCalled();
    } finally { clearFittedEquipment(current.root); jest.restoreAllMocks(); }
});

test('a rejected replacement keeps previously equipped parts and body coverage intact', async () => {
    const current = skeletonSharingFixture(), badScene = current.sourceScene.clone(true);
    const unknown = new THREE.Bone(); unknown.name = 'missing-joint';
    badScene.children[1].skeleton = new THREE.Skeleton([unknown]);
    let failReplacement = false;
    prepareFittedEquipment(current.root, current.scene, async () => ({scene: failReplacement ? badScene : current.sourceScene}));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
        applyFittedEquipment(current.root, current.equipment); await current.root.userData.equipmentReady;
        const equipped = current.gear(), coverage = current.root.getObjectByName('Fighter_Body').geometry;
        const revision = current.root.userData.equipmentVisualRevision;
        const disposals = equipped.map(part => jest.spyOn(part.material, 'dispose'));
        failReplacement = true;
        applyFittedEquipment(current.root, current.equipment, {force: true}); await current.root.userData.equipmentReady;
        expect(warn).toHaveBeenCalledTimes(1); expect(current.gear()).toEqual(equipped);
        expect(current.root.getObjectByName('Fighter_Body').geometry).toBe(coverage);
        expect(current.root.userData.equipmentVisualRevision).toBe(revision);
        disposals.forEach(disposal => expect(disposal).not.toHaveBeenCalled());
        expect(current.root.userData.equipmentVisualSignature).toBe('');
    } finally { clearFittedEquipment(current.root); jest.restoreAllMocks(); }
});

test('a rejected older equip task cannot clear the signature of a newer queued generation', async () => {
    const current = skeletonSharingFixture();
    const shared = current.sourceScene.children[0].material;
    const unknown = new THREE.Bone(); unknown.name = 'missing-joint';
    current.sourceScene.children[1].skeleton = new THREE.Skeleton([unknown]);
    const originalClone = shared.clone;
    let queuedSignature, latestReady;
    jest.spyOn(shared, 'clone').mockImplementation(function () {
        const clone = originalClone.call(this);
        // A separately completed task runs after this binding rejects but
        // before its chained catch. The newer load itself need not fail.
        queueMicrotask(() => {
            applyFittedEquipment(current.root, {mainHand: {id: 'sword', name: 'Iron Sword', baseName: 'Iron Sword',
                slot: 'mainHand', type: 'WEAPON', rarity: 'Rare'}});
            queuedSignature = current.root.userData.equipmentVisualSignature;
            latestReady = current.root.userData.equipmentReady;
        });
        return clone;
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
        applyFittedEquipment(current.root, current.equipment);
        const rejected = current.root.userData.equipmentReady;
        await rejected;
        expect(queuedSignature).toBeTruthy();
        expect(current.root.userData.equipmentVisualSignature).toBe(queuedSignature);
        // Retire the queued request before it can bind the synthetic weapon
        // fixture; the test concerns generation ownership, not weapon fit.
        clearFittedEquipment(current.root); await latestReady;
        expect(current.root.userData.equipmentVisualSignature).toBe('');
        expect(warn).toHaveBeenCalled();
    } finally { clearFittedEquipment(current.root); jest.restoreAllMocks(); }
});

test('partial failure across several items disposes their shared equip-owned skeleton once', async () => {
    const current = skeletonSharingFixture(), badScene = current.sourceScene.clone(true);
    const unknown = new THREE.Bone(); unknown.name = 'missing-joint';
    badScene.children[1].skeleton = new THREE.Skeleton([unknown]);
    prepareFittedEquipment(current.root, current.scene, async path => ({scene: path.includes('iron-gauntlets') ? badScene : current.sourceScene}));
    const material = current.sourceScene.children[0].material, originalClone = material.clone, owned = [];
    jest.spyOn(material, 'clone').mockImplementation(function () {
        const clone = originalClone.call(this); owned.push(jest.spyOn(clone, 'dispose')); return clone;
    });
    const skeletonDisposal = jest.spyOn(THREE.Skeleton.prototype, 'dispose');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
        applyFittedEquipment(current.root, {...current.equipment, gloves: {id: 'gloves', name: 'Iron Gauntlets',
            baseName: 'Iron Gauntlets', slot: 'gloves', type: 'ARMOR', rarity: 'Rare'}});
        await current.root.userData.equipmentReady;
        expect(warn).toHaveBeenCalledTimes(1); expect(owned).toHaveLength(3);
        owned.forEach(disposal => expect(disposal).toHaveBeenCalledTimes(1));
        expect(skeletonDisposal).toHaveBeenCalledTimes(1);
        expect(skeletonDisposal.mock.contexts[0]).not.toBe(current.body);
        expect(skeletonDisposal.mock.contexts[0]).not.toBe(current.source);
        expect(current.gear()).toHaveLength(0);
    } finally { clearFittedEquipment(current.root); jest.restoreAllMocks(); }
});

test('fitted pieces share only matching equip-owned skeletons and retain exact animated surfaces', async () => {
    const first = skeletonSharingFixture(), second = skeletonSharingFixture();
    for (const fixture of [first, second]) { applyFittedEquipment(fixture.root, fixture.equipment); await fixture.root.userData.equipmentReady; }
    const gear = first.gear(), other = second.gear();
    expect(gear).toHaveLength(2); expect(gear[0].skeleton).toBe(gear[1].skeleton);
    expect(gear[0].skeleton).not.toBe(first.body); expect(gear[0].skeleton).not.toBe(first.source);
    expect(gear[0].skeleton).not.toBe(other[0].skeleton);
    const reference = gear.map(mesh => {
        const copy = mesh.clone(false);
        copy.bind(new THREE.Skeleton(mesh.skeleton.bones, mesh.skeleton.boneInverses.map(matrix => matrix.clone())), mesh.bindMatrix.clone());
        first.root.getObjectByName('Fighter_Body').parent.add(copy); return copy;
    });
    for (const angle of [0, .4, -.7]) {
        first.bones[1].rotation.z = angle; first.root.position.set(2, 0, -3); first.root.updateMatrixWorld(true);
        gear.forEach((mesh, index) => expect(surface(mesh)).toEqual(surface(reference[index])));
    }
    reference.forEach(mesh => { mesh.removeFromParent(); mesh.skeleton.dispose(); });
    const owned = jest.spyOn(gear[0].skeleton, 'dispose'), foreign = jest.spyOn(other[0].skeleton, 'dispose');
    const source = jest.spyOn(first.source, 'dispose'), body = jest.spyOn(first.body, 'dispose');
    clearFittedEquipment(first.root); clearFittedEquipment(first.root);
    expect(owned).toHaveBeenCalledTimes(1); expect(foreign).not.toHaveBeenCalled();
    expect(source).not.toHaveBeenCalled(); expect(body).not.toHaveBeenCalled();
    applyFittedEquipment(first.root, first.equipment); await first.root.userData.equipmentReady;
    expect(first.gear()[0].skeleton).not.toBe(gear[0].skeleton);
    clearFittedEquipment(first.root); clearFittedEquipment(second.root);
    jest.restoreAllMocks();
});

test('different inverse matrices remain separately owned skeletons', async () => {
    const fixture = skeletonSharingFixture(true);
    applyFittedEquipment(fixture.root, fixture.equipment); await fixture.root.userData.equipmentReady;
    const gear = fixture.gear(); expect(gear).toHaveLength(2);
    expect(gear[0].skeleton).not.toBe(gear[1].skeleton);
    expect(gear[0].skeleton.boneInverses[1].elements[12]).not.toBe(gear[1].skeleton.boneInverses[1].elements[12]);
    clearFittedEquipment(fixture.root);
});

test('merges identical opaque surfaces without changing source buffers, bones or animated triangle positions', () => {
    const {root, parts, bones} = fixture();
    const indices = parts.map(part => [...part.geometry.index.array]);
    const dispose = parts.map(part => jest.spyOn(part.geometry, 'dispose'));
    const result = batchFittedEquipment(parts), batch = result.at(-1);
    expect(result).toHaveLength(3);
    expect(batch.material).toBe(parts[0].material);
    expect(batch.skeleton).toBe(parts[0].skeleton);
    expect(batch.userData.fittedSlots).toEqual(['chest', 'gloves']);
    root.add(batch);
    for (const angle of [0, .4, -.7]) {
        bones[1].rotation.z = angle; root.position.set(2, 0, -3); root.updateMatrixWorld(true);
        expect(surface(batch)).toEqual(parts.flatMap(surface));
    }
    parts.forEach((part, i) => {
        expect(part.visible).toBe(false);
        expect([...part.geometry.index.array]).toEqual(indices[i]);
        expect(dispose[i]).not.toHaveBeenCalled();
    });
    expect(batch.geometry).not.toBe(parts[0].geometry);
    expect(batch.userData.fittedOwnedGeometry).toBe(true);
    expect(batch.castShadow).toBe(true);
});

test.each([
    ['color', part => part.material.color.set('#123456')],
    ['potency emission', part => { part.material.emissiveIntensity = 2; }],
    ['transparent', part => { part.material.transparent = true; }],
    ['texture', part => { part.material.map = new THREE.Texture(); }],
    ['custom shader', part => { part.material.onBeforeCompile = () => {}; }],
    ['custom render callback', part => { part.onBeforeRender = () => {}; }],
    ['custom post-render callback', part => { part.onAfterRender = () => {}; }],
    ['custom shadow callback', part => { part.onBeforeShadow = () => {}; }],
    ['body instead of equipment', part => { part.userData.authoredEquipment = false; }],
    ['transform', part => { part.position.x = 1; }],
    ['bind matrix', part => { part.bindMatrix.makeTranslation(1, 0, 0); }],
    ['different actor bones', part => { part.skeleton.bones = part.skeleton.bones.map(bone => bone.clone()); }],
    ['different inverse bind', part => { part.skeleton.boneInverses[0].makeTranslation(1, 0, 0); }],
    ['hidden skirt', part => { part.visible = false; }],
    ['draw range', part => { part.geometry.setDrawRange(0, 3); }],
    ['morph', part => { part.geometry.morphAttributes.position = [part.geometry.attributes.position.clone()]; }],
    ['shadow', part => { part.castShadow = false; }]
])('preserves the %s boundary without hiding the eligible source', (_, change) => {
    const {parts} = fixture(); change(parts[1]);
    const result = batchFittedEquipment(parts);
    expect(result).toEqual(parts); expect(parts[0].visible).toBe(true);
    expect(parts[0].userData.fittedBatchSource).toBeUndefined();
});

test('exact shared generated surfaces retain fitted batching, but changed surface/map boundaries stay separate', () => {
    for (const change of [null, part => { part.material.name = 'standard leather | main'; },
        part => { part.material.name = 'legendary plate | main'; }]) {
        const { parts } = fixture();
        for (const part of parts) part.material.name = 'standard cloth | main';
        if (change) change(parts[1]);
        for (const part of parts) expect(applyAuthoredEquipmentSurface(part.material)).toBe(true);
        const result = batchFittedEquipment(parts);
        expect(result.length).toBe(change ? 2 : 3);
        if (!change) {
            const batch = result.at(-1);
            expect(batch.material.map).toBe(parts[0].material.map);
            expect(batch.material.bumpMap).toBe(parts[0].material.bumpMap);
        } else expect(parts.every(part => part.visible)).toBe(true);
    }
    const { parts } = fixture();
    for (const part of parts) {
        part.material.name = 'standard cloth | main'; applyAuthoredEquipmentSurface(part.material);
    }
    parts[1].material.normalMap = new THREE.Texture();
    expect(batchFittedEquipment(parts)).toEqual(parts);
});

test.each([true, false])('fitted materials apply shared surfaces only with usable UVs (%s), never mutating cached source materials', async validUV => {
    const current = skeletonSharingFixture();
    const source = current.sourceScene.children[0].material;
    source.name = 'standard cloth | main';
    if (!validUV) current.sourceScene.children.forEach(mesh => { mesh.geometry.deleteAttribute('uv'); });
    applyFittedEquipment(current.root, current.equipment); await current.root.userData.equipmentReady;
    const materials = current.gear().map(mesh => mesh.material);
    expect(materials).toHaveLength(2);
    for (const material of materials) {
        expect(material).not.toBe(source);
        expect(Boolean(material.map)).toBe(validUV);
        expect(material.userData.authoredEquipmentSurface).toBe(validUV ? 'cloth' : undefined);
    }
    expect(source.map).toBeNull(); expect(source.bumpMap).toBeNull();
    const textureDispose = validUV ? jest.spyOn(materials[0].map, 'dispose') : null;
    clearFittedEquipment(current.root);
    if (textureDispose) { expect(textureDispose).not.toHaveBeenCalled(); textureDispose.mockRestore(); }
});

test('stealth restores individual sorting surfaces and then the opaque batch, never hidden input duplicates', () => {
    const {root, parts} = fixture();
    const result = batchFittedEquipment(parts), batch = result.at(-1);
    root.add(batch); const actor = {mesh: root};
    const originals = result.map(part => part.material);
    for (let iteration = 0; iteration < 2; iteration++) {
        applyActorStealthAppearance(actor);
        expect(parts.every(part => part.visible && part.material.transparent && part.material.opacity === .3)).toBe(true);
        expect(batch.visible).toBe(false);
        restoreActorStealthAppearance(actor);
        expect(parts.every(part => !part.visible)).toBe(true); expect(batch.visible).toBe(true);
        result.forEach((part, i) => expect(part.material).toBe(originals[i]));
    }
});

test('clearing stealth equipment disposes owned original and temporary materials, not cached materials or textures', async () => {
    const {root: scene, parts, bones} = fixture();
    bones[0].name = 'pelvis'; bones[1].name = 'spine_01';
    const body = parts[0]; body.name = 'Fighter_Body'; body.userData = {};
    const sourceScene = new THREE.Group(); sourceScene.add(parts[1]);
    for (const name of ['upperarm_l', 'lowerarm_l', 'upperarm_r', 'lowerarm_r', 'neck_01']) {
        const bone = new THREE.Bone(); bone.name = name; bone.position.y = name.startsWith('lower') ? 2 : 1; scene.add(bone);
    }
    const source = parts[1].material, texture = new THREE.Texture(); source.map = texture;
    const sourceDispose = jest.spyOn(source, 'dispose'), textureDispose = jest.spyOn(texture, 'dispose');
    const root = new THREE.Group(); root.userData.authoredClass = 'Fighter'; root.add(scene);
    prepareFittedEquipment(root, scene, async () => ({scene: sourceScene}));
    applyFittedEquipment(root, {chest: {id: 'mail', name: 'Plate Mail', baseName: 'Plate Mail', slot: 'chest', type: 'ARMOR', rarity: 'Rare'}});
    await root.userData.equipmentReady;
    const gear = []; root.traverse(part => { if (part.userData.authoredEquipment) gear.push(part); });
    expect(gear).toHaveLength(1);
    const original = gear[0].material, originalDispose = jest.spyOn(original, 'dispose');
    const actor = {mesh: root}; applyActorStealthAppearance(actor);
    const fadedDispose = jest.spyOn(gear[0].material, 'dispose');
    expect(gear[0].material).not.toBe(original);
    clearFittedEquipment(root);
    expect(originalDispose).toHaveBeenCalledTimes(1); expect(fadedDispose).toHaveBeenCalledTimes(1);
    expect(sourceDispose).not.toHaveBeenCalled(); expect(textureDispose).not.toHaveBeenCalled();
    expect(root.userData.equipmentVisualItemCount).toBe(0);
    restoreActorStealthAppearance(actor);
});

test('normal fitted equipment batches by default; explicit false retains the separate-piece comparison path', async () => {
    const {root: scene, parts, bones} = fixture();
    bones[0].name = 'pelvis'; bones[1].name = 'spine_01';
    parts[0].name = 'Fighter_Body'; parts[0].userData = {}; parts[1].userData = {};
    const sourceScene = new THREE.Group();
    sourceScene.add(parts[1], parts[1].clone(false));
    for (const name of ['upperarm_l', 'lowerarm_l', 'upperarm_r', 'lowerarm_r', 'neck_01']) {
        const bone = new THREE.Bone(); bone.name = name; bone.position.y = name.startsWith('lower') ? 2 : 1; scene.add(bone);
    }
    const root = new THREE.Group(); root.userData.authoredClass = 'Fighter'; root.add(scene);
    prepareFittedEquipment(root, scene, async () => ({scene: sourceScene}));
    const equipment = {chest: {id: 'mail', name: 'Plate Mail', baseName: 'Plate Mail', slot: 'chest', type: 'ARMOR', rarity: 'Rare'}};
    for (const enabled of [undefined, false]) {
        root.userData.fittedEquipmentBatching = enabled;
        applyFittedEquipment(root, equipment); await root.userData.equipmentReady;
        const batches = [], sources = [];
        root.traverse(mesh => {
            if (mesh.userData.fittedBatchSources) batches.push(mesh);
            if (mesh.userData.fittedBatchSource) sources.push(mesh);
        });
        expect(batches).toHaveLength(enabled === false ? 0 : 1);
        expect(sources).toHaveLength(enabled === false ? 0 : 2);
        expect(sources.every(mesh => !mesh.visible)).toBe(true);
        expect(root.userData.equipmentVisualItemCount).toBe(1);
        clearFittedEquipment(root);
    }
});
