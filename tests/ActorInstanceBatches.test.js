import * as THREE from 'three';
import { jest } from '@jest/globals';
import { ActorInstanceBatches } from '../src/art/ActorInstanceBatches.js';
import { createProceduralSkeleton, createProceduralImp } from '../src/art/ProceduralLegacyEnemies.js';

test('only constructor-batched Skeletons join the qualified enemy instance roster', () => {
    const scene = new THREE.Scene(); scene.add(createProceduralSkeleton(), createProceduralImp());
    const instances = new ActorInstanceBatches(scene);
    try { expect(instances.roots.size).toBe(0); } finally { instances.dispose(); }
});

test('rigid ossuary skeleton instances retain every animated surface and restore pooled visibility', () => {
    const scene = new THREE.Scene(), models = [0, 1, 2].map(index => {
        const root = createProceduralSkeleton({ batch: true }); root.position.x = index * 4;
        scene.add(root); return root;
    });
    const instances = new ActorInstanceBatches(scene), local = new THREE.Matrix4(), world = new THREE.Matrix4();
    const mixers = models.map(root => new THREE.AnimationMixer(root));
    try {
        for (const state of ['Idle', 'Walk', 'Run', 'Attack', 'Death']) {
            mixers.forEach((mixer, index) => { mixer.stopAllAction(); mixer.clipAction(models[index].userData.animations
                .find(clip => clip.name === state)).play(); mixer.update(.2 + index * .17); });
            scene.updateMatrixWorld(true);
            const visible = new Map(); models.forEach(root => root.traverse(part => visible.set(part, part.visible)));
            instances.beginFrame();
            expect(instances.roots.size).toBe(3); expect(instances.batches.size).toBeGreaterThan(0);
            for (const entries of instances.buckets.values()) {
                const parts = entries.map(entry => entry.part).filter(part => instances.hidden.includes(part));
                if (!parts.length) continue;
                const batch = [...instances.batches.values()].find(value => value.geometry === parts[0].geometry && value.material === parts[0].material);
                expect(batch.count).toBe(parts.length);
                parts.forEach((part, index) => {
                    batch.getMatrixAt(index, local); world.multiplyMatrices(batch.matrixWorld, local);
                    world.elements.forEach((value, element) => expect(value).toBeCloseTo(part.matrixWorld.elements[element], 5));
                });
            }
            instances.endFrame(); expect([...visible].every(([part, value]) => part.visible === value)).toBe(true);
            models.forEach(root => root.userData.resetPose());
        }
        models[1].visible = false; scene.updateMatrixWorld(true); instances.beginFrame();
        expect(instances.hidden.some(part => models[1].getObjectByProperty('uuid', part.uuid))).toBe(false);
        instances.endFrame(); models[1].visible = true; models[1].userData.proceduralActorType = 'Unknown';
        instances.beginFrame(); expect(instances.roots.has(models[1])).toBe(false);
    } finally { instances.dispose(); mixers.forEach(mixer => { mixer.stopAllAction(); mixer.uncacheRoot(mixer.getRoot()); }); }
});

function fixture() {
    const scene = new THREE.Scene(), geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial();
    const actors = [0, 1].map(index => {
        const root = new THREE.Group(); root.userData.proceduralHumanoid = true;
        const mesh = new THREE.Mesh(geometry, material); mesh.position.x = 2; mesh.castShadow = true;
        root.position.set(index * 4, 0, 0); root.add(mesh); scene.add(root); return { root, mesh };
    });
    const instances = new ActorInstanceBatches(scene);
    const begin = () => { scene.updateMatrixWorld(true); instances.beginFrame(); };
    return { scene, geometry, material, actors, instances, begin };
}

test('borrows exact surfaces and retains parent-transformed world positions', () => {
    const f = fixture(); f.scene.position.x = 10; f.begin();
    expect(f.instances.batches.size).toBe(1);
    const batch = [...f.instances.batches.values()][0], matrix = new THREE.Matrix4();
    expect(batch.geometry).toBe(f.geometry); expect(batch.material).toBe(f.material);
    expect(batch.count).toBe(2); expect(batch.castShadow).toBe(true); expect(batch.morphTexture).toBeNull();
    f.actors.forEach(({ mesh }, index) => {
        batch.getMatrixAt(index, matrix); matrix.premultiply(batch.matrixWorld);
        expect(matrix.elements).toEqual(mesh.matrixWorld.elements);
    });
    f.actors.forEach(({ mesh }) => expect(mesh.visible).toBe(false));
    f.instances.endFrame(); f.actors.forEach(({ mesh }) => expect(mesh.visible).toBe(true));
    expect(f.instances.group.visible).toBe(false); f.instances.dispose();
});

test.each(['transparent', 'customDepth', 'customRender', 'customShader', 'skinned', 'morph', 'mirrored', 'hidden', 'other-layer', 'other-shadow', 'nonprocedural'])('%s retains the normal rendering path', kind => {
    const f = fixture(), { root, mesh } = f.actors[1];
    if (kind === 'transparent') mesh.material = new THREE.MeshStandardMaterial({ transparent: true });
    if (kind === 'customDepth') mesh.customDepthMaterial = new THREE.MeshDepthMaterial();
    if (kind === 'customRender') mesh.onBeforeRender = () => {};
    if (kind === 'customShader') { mesh.material = mesh.material.clone(); mesh.material.onBeforeCompile = () => {}; }
    if (kind === 'skinned') mesh.isSkinnedMesh = true;
    if (kind === 'morph') { mesh.geometry = mesh.geometry.clone(); mesh.geometry.morphAttributes.position = [mesh.geometry.attributes.position.clone()]; }
    if (kind === 'mirrored') mesh.scale.x = -1;
    if (kind === 'hidden') root.visible = false;
    if (kind === 'other-layer') mesh.layers.set(1);
    if (kind === 'other-shadow') mesh.castShadow = false;
    if (kind === 'nonprocedural') root.userData.proceduralHumanoid = false;
    f.begin(); expect(f.instances.batches.size).toBe(0); expect(mesh.visible).toBe(true); f.instances.dispose();
});

test('retired buckets release only owned instance buffers and restore original hooks/visibility', () => {
    const f = fixture(), originalBefore = f.instances.before, originalAfter = f.instances.after;
    f.begin(); const batch = [...f.instances.batches.values()][0], dispose = jest.spyOn(batch, 'dispose');
    const geometry = jest.spyOn(f.geometry, 'dispose'), material = jest.spyOn(f.material, 'dispose');
    f.instances.endFrame(); f.actors[1].root.removeFromParent(); f.begin();
    expect(dispose).toHaveBeenCalledTimes(1); expect(f.instances.batches.size).toBe(0);
    f.instances.dispose(); f.instances.dispose();
    expect(geometry).not.toHaveBeenCalled(); expect(material).not.toHaveBeenCalled();
    expect(f.scene.onBeforeRender).toBe(originalBefore); expect(f.scene.onAfterRender).toBe(originalAfter);
    expect(f.instances.group.parent).toBeNull(); jest.restoreAllMocks();
    f.instances.register(f.actors[0].root); expect(f.instances.roots.size).toBe(0);
});

test('disposing during a frame restores sources and never erases a replacement hook', () => {
    const f = fixture(); f.begin(); const replacement = () => {}; f.scene.onBeforeRender = replacement;
    f.instances.dispose(); expect(f.scene.onBeforeRender).toBe(replacement);
    f.actors.forEach(({ mesh }) => expect(mesh.visible).toBe(true));
});

test('distant instance positions retain fractional equipment transforms', () => {
    const f = fixture();
    try {
        f.actors.forEach(({ root, mesh }, index) => {
            root.position.set(50000.123 + index * 4, 0, 20000.456);
            mesh.position.set(2.12345, .45678, .98765);
        });
        f.begin();
        const batch = [...f.instances.batches.values()][0], local = new THREE.Matrix4(), world = new THREE.Matrix4();
        f.actors.forEach(({ mesh }, index) => {
            batch.getMatrixAt(index, local); world.multiplyMatrices(batch.matrixWorld, local);
            for (let element = 0; element < 16; element++) {
                expect(Math.abs(world.elements[element] - mesh.matrixWorld.elements[element])).toBeLessThan(.00001);
            }
        });
    } finally { f.instances.dispose(); }
});

test('reuses unchanged roster and detects material, geometry, revision, cell and actor membership changes', () => {
    const f = fixture(); f.begin(); const roster = f.instances.roster; f.instances.endFrame(); f.begin();
    expect(f.instances.roster).toBe(roster);
    f.instances.endFrame(); f.actors[1].mesh.material = f.material.clone(); f.begin();
    expect(f.instances.roster).not.toBe(roster); expect(f.instances.batches.size).toBe(0);
    f.instances.endFrame(); f.actors[1].mesh.material = f.material;
    f.actors[1].root.userData.equipmentVisualRevision = 1; f.begin();
    expect(f.instances.batches.size).toBe(1);
    f.instances.endFrame(); f.actors[1].root.position.x = 200; f.begin();
    expect(f.instances.batches.size).toBe(0);
    f.instances.endFrame(); f.actors[1].root.position.x = 4;
    f.actors[1].mesh.geometry = f.geometry.clone(); f.begin(); expect(f.instances.batches.size).toBe(0);
    f.instances.endFrame(); f.actors[1].root.removeFromParent(); f.begin(); expect(f.instances.roots.size).toBe(1);
    f.scene.add(f.actors[1].root); f.actors[1].mesh.geometry = f.geometry;
    f.instances.register(f.actors[1].root); f.begin(); expect(f.instances.batches.size).toBe(1); f.instances.dispose();
});
