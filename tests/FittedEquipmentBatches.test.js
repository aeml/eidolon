import * as THREE from 'three';
import { jest } from '@jest/globals';
import { batchFittedEquipment } from '../src/art/FittedEquipmentBatches.js';
import { applyActorStealthAppearance, restoreActorStealthAppearance } from '../src/entities/ActorStealthAppearance.js';
import { prepareFittedEquipment, applyFittedEquipment, clearFittedEquipment } from '../src/art/FittedEquipment.js';

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

test('opaque gear with identical texture objects batches without changing UVs or reading image pixels', () => {
    const {parts} = fixture(), map = new THREE.Texture(), normal = new THREE.Texture();
    parts.forEach(part => { part.material.map = map; part.material.normalMap = normal; });
    const mapJSON = jest.spyOn(map, 'toJSON'), normalJSON = jest.spyOn(normal, 'toJSON');
    const expectedUVs = parts.flatMap(part => [...part.geometry.attributes.uv.array]);
    const result = batchFittedEquipment(parts), batch = result.at(-1);
    expect(result).toHaveLength(3); expect(batch.userData.fittedBatchSources).toHaveLength(2);
    expect(batch.material.map).toBe(map); expect(batch.material.normalMap).toBe(normal);
    expect([...batch.geometry.attributes.uv.array]).toEqual(expectedUVs);
    for (const call of [...mapJSON.mock.calls, ...normalJSON.mock.calls]) {
        expect(call[0].textures[map.uuid]).toEqual({uuid: map.uuid});
        expect(call[0].textures[normal.uuid]).toEqual({uuid: normal.uuid});
    }
    jest.restoreAllMocks();
});

test.each(['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'])('distinct %s texture objects never batch even with a shared image source', slot => {
    const {parts} = fixture(), first = new THREE.Texture(), second = first.clone();
    parts[0].material[slot] = first; parts[1].material[slot] = second;
    expect(second.source).toBe(first.source);
    expect(batchFittedEquipment(parts)).toEqual(parts);
    expect(parts.every(part => part.visible)).toBe(true);
});

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
