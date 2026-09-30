import * as THREE from 'three';
import { jest } from '@jest/globals';
import { createProceduralFighter, createProceduralRogue, createProceduralWizard,
    createProceduralCleric, HUMANOID_EQUIPMENT_ANCHORS, getProceduralHumanoidCacheMetrics } from '../src/art/ProceduralHumanoid.js';
import { applyProceduralEquipment, clearProceduralEquipment, EQUIPMENT_VISUAL_DESCRIPTORS } from '../src/art/ProceduralEquipment.js';
import { applyActorStealthAppearance, restoreActorStealthAppearance } from '../src/entities/ActorStealthAppearance.js';
import { batchHumanoidRenderParts } from '../src/art/HumanoidRenderBatches.js';
import { MeshFactory } from '../src/utils/MeshFactory.js';
import { Actor } from '../src/entities/Actor.js';
import { createProceduralSkeleton } from '../src/art/ProceduralLegacyEnemies.js';

const cases = [
    ['Fighter', createProceduralFighter, 61, 53], ['Rogue', createProceduralRogue, 77, 60],
    ['Wizard', createProceduralWizard, 60, 54], ['Cleric', createProceduralCleric, 108, 76]
];
const visibleMeshes = root => {
    const meshes = [];
    root.traverseVisible(object => { if (object.isMesh) meshes.push(object); });
    return meshes;
};

test('rigid leaves skip local matrix composition but retain moving-parent and directly animated transforms', () => {
    const root = new THREE.Group(), pivot = new THREE.Group();
    const rigid = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    const animated = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    rigid.name = 'Rigid'; animated.name = 'Animated'; rigid.position.x = 2;
    root.userData.animations = [new THREE.AnimationClip('Move', 1,
        [new THREE.NumberKeyframeTrack('Animated.position[x]', [0, 1], [0, 4])])];
    root.add(pivot); pivot.add(rigid, animated);
    batchHumanoidRenderParts(root);
    expect(rigid.matrixAutoUpdate).toBe(false); expect(animated.matrixAutoUpdate).toBe(true);
    expect(root.matrixAutoUpdate).toBe(true); expect(pivot.matrixAutoUpdate).toBe(true);
    const compose = jest.spyOn(rigid, 'updateMatrix');
    pivot.position.x = 3;
    const mixer = new THREE.AnimationMixer(root); mixer.clipAction(root.userData.animations[0]).play(); mixer.update(.5);
    root.updateMatrixWorld(true); root.updateMatrixWorld(true);
    expect(compose).not.toHaveBeenCalled();
    expect(rigid.getWorldPosition(new THREE.Vector3()).x).toBe(5);
    expect(animated.getWorldPosition(new THREE.Vector3()).x).toBe(5);
    jest.restoreAllMocks();
});

test('a pooled rest-pose reset refreshes a cached rigid local matrix', () => {
    const root = createProceduralFighter({ batch: true });
    const part = visibleMeshes(root).find(mesh => !mesh.matrixAutoUpdate);
    expect(part).toBeDefined();
    const rest = part.matrix.clone();
    part.position.x += 10; part.updateMatrix();
    root.userData.resetPose();
    expect(part.matrix.elements).toEqual(rest.elements);
});

test('owned equipment surface comparison rejects a changed vertex, not just shared geometry', () => {
    const source = createProceduralFighter(), batched = createProceduralFighter({ batch: true });
    const equipment = Object.fromEntries(Object.keys(HUMANOID_EQUIPMENT_ANCHORS).map(slot => {
        const baseName = Object.keys(EQUIPMENT_VISUAL_DESCRIPTORS).find(name => EQUIPMENT_VISUAL_DESCRIPTORS[name].slot === slot.replace(/[12]$/, ''));
        return [slot, { id: `reference-${slot}`, baseName, name: baseName, slot, rarity: 'Rare' }];
    }));
    applyProceduralEquipment(source, equipment); applyProceduralEquipment(batched, equipment);
    checkSurfaces(source, batched);
    const part = visibleMeshes(batched).find(mesh => mesh.userData.rigidEquipmentPivot);
    expect(part).toBeDefined();
    const positions = part.geometry.attributes.position;
    positions.setX(0, positions.getX(0) + 1);
    expect(() => checkSurfaces(source, batched)).toThrow();
    clearProceduralEquipment(source); clearProceduralEquipment(batched);
});

// Compare actual triangle vertices, normals and UVs under animated world
// transforms against the unbatched source, not a second merge implementation.
function checkSurfaces(source, batched) {
    source.updateMatrixWorld(true); batched.updateMatrixWorld(true);
    const visible = new Set(visibleMeshes(source));
    let maxPositionError = 0, maxNormalError = 0, maxUVError = 0;
    for (const mesh of visibleMeshes(batched)) {
        if (!mesh.userData.humanoidBatchSources) continue;
        let offset = 0;
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
        for (const name of mesh.userData.humanoidBatchSources) {
            const original = source.getObjectByName(name), geometry = original.geometry;
            expect(visible.has(original)).toBe(true);
            visible.delete(original);
            expect(mesh.material).toBe(original.material);
            expect(mesh.castShadow).toBe(original.castShadow);
            expect(mesh.receiveShadow).toBe(original.receiveShadow);
            const originalNormals = new THREE.Matrix3().getNormalMatrix(original.matrixWorld);
            const count = geometry.index?.count ?? geometry.attributes.position.count;
            for (let i = 0; i < count; i++, offset++) {
                const index = geometry.index ? geometry.index.getX(i) : i;
                const originalPosition = new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, index).applyMatrix4(original.matrixWorld);
                const position = new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, offset).applyMatrix4(mesh.matrixWorld);
                maxPositionError = Math.max(maxPositionError, position.distanceTo(originalPosition));
                const originalNormal = new THREE.Vector3().fromBufferAttribute(geometry.attributes.normal, index).applyNormalMatrix(originalNormals);
                const normal = new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.normal, offset).applyNormalMatrix(normalMatrix);
                maxNormalError = Math.max(maxNormalError, normal.distanceTo(originalNormal));
                const originalUV = new THREE.Vector2().fromBufferAttribute(geometry.attributes.uv, index);
                const uv = new THREE.Vector2().fromBufferAttribute(mesh.geometry.attributes.uv, offset);
                maxUVError = Math.max(maxUVError, uv.distanceTo(originalUV));
            }
        }
        expect(mesh.geometry.attributes.position.count).toBe(offset);
    }
    expect(maxPositionError).toBeLessThan(1e-5);
    expect(maxNormalError).toBeLessThan(1e-5);
    expect(maxUVError).toBe(0);
    // Remaining default pieces are still independently drawn, not lost.
    for (const mesh of visible) {
        if (mesh.name.startsWith('Gear_')) continue;
        const counterpart = batched.getObjectByName(mesh.name);
        expect(counterpart?.visible).toBe(true);
        if (mesh.userData.rigidEquipmentPivot) {
            // Per-loadout pivot buffers are intentionally owned, not shared.
            // Compare every attribute/index instead of demanding identity.
            expect(counterpart.userData.rigidEquipmentPivot).toBe(true);
            expect(Object.keys(counterpart.geometry.attributes)).toEqual(Object.keys(mesh.geometry.attributes));
            expect(counterpart.geometry.index?.array).toEqual(mesh.geometry.index?.array);
            for (const [name, attribute] of Object.entries(mesh.geometry.attributes)) {
                const other = counterpart.geometry.attributes[name];
                expect(other.itemSize).toBe(attribute.itemSize);
                expect(other.normalized).toBe(attribute.normalized);
                expect(other.array).toEqual(attribute.array);
            }
        } else expect(counterpart.geometry).toBe(mesh.geometry);
        expect(counterpart.matrixWorld.elements).toEqual(mesh.matrixWorld.elements);
    }
}

test.each(cases)('%s reduces rigid draws while preserving every surface throughout its animation states', (_type, factory, before, after) => {
    const source = factory(), batched = factory({ batch: true });
    expect(visibleMeshes(source)).toHaveLength(before);
    expect(visibleMeshes(batched)).toHaveLength(after);
    expect(batched.userData.humanoidRenderBatches).toEqual({ sourceMeshes: before, drawMeshes: after });
    for (const names of Object.values(HUMANOID_EQUIPMENT_ANCHORS)) for (const name of names) {
        expect(batched.getObjectByName(name).parent.name).toBe(source.getObjectByName(name).parent.name);
    }
    for (const clip of source.userData.animations) {
        const mixers = [source, batched].map(root => new THREE.AnimationMixer(root));
        mixers.forEach(mixer => { mixer.clipAction(clip).play(); mixer.update(.37); });
        checkSurfaces(source, batched);
        mixers.forEach((mixer, index) => { mixer.stopAllAction(); mixer.uncacheRoot([source, batched][index]); });
        source.userData.resetPose(); batched.userData.resetPose();
    }
});

test.each(cases)('%s equipment masking, clearing and pooled reset retain body and default geometry', (type, factory, _before, after) => {
    const source = factory(), batched = factory({ batch: true });
    const equipment = {};
    for (const slot of Object.keys(HUMANOID_EQUIPMENT_ANCHORS)) {
        const descriptorSlot = slot.replace(/[12]$/, '');
        const baseName = Object.keys(EQUIPMENT_VISUAL_DESCRIPTORS).find(name => EQUIPMENT_VISUAL_DESCRIPTORS[name].slot === descriptorSlot);
        expect(baseName).toBeDefined();
        equipment[slot] = { id: `${type}-${slot}`, baseName, name: baseName, slot: descriptorSlot, rarity: 'Rare' };
        applyProceduralEquipment(source, equipment); applyProceduralEquipment(batched, equipment);
        checkSurfaces(source, batched);
    }
    clearProceduralEquipment(source); clearProceduralEquipment(batched);
    batched.getObjectByName('RigRoot').rotation.z = -1.4;
    // Exercise the actual pool reset, including visibility of batched defaults.
    MeshFactory.releaseMesh(type, batched);
    expect(MeshFactory.getPooledMesh(type)).toBe(batched);
    expect(visibleMeshes(batched)).toHaveLength(after);
    checkSurfaces(source, batched);
});

test.each(cases)('%s procedural factory or failed-load fallback uses shared batches with per-actor stealth', async (type, factory) => {
    const load = type === 'Fighter' ? jest.spyOn(MeshFactory, 'loadModelWithTimeout').mockRejectedValue(new Error('404')) : null;
    try {
    const first = await MeshFactory.createMeshForType(type), metrics = getProceduralHumanoidCacheMetrics();
    const second = factory({ batch: true });
    expect(getProceduralHumanoidCacheMetrics()).toEqual(metrics);
    const batch = visibleMeshes(first).find(mesh => mesh.userData.humanoidBatchSources);
    const twin = second.getObjectByName(batch.name), original = batch.material;
    expect(batch.geometry).toBe(twin.geometry);
    expect(batch.geometry.boundingSphere.radius).toBeGreaterThan(0);
    const dispose = jest.spyOn(batch.geometry, 'dispose');
    const actor = new Actor(`batch-${type}`, {});
    actor.setMesh(first);
    applyActorStealthAppearance(actor);
    expect(batch.material).not.toBe(original);
    expect(twin.material).toBe(original);
    expect(batch.material.opacity).toBe(.3);
    restoreActorStealthAppearance(actor);
    expect(batch.material).toBe(original);
    expect(first.getObjectByName('ActorInteractionHitbox').parent).toBe(first);
    actor.dispose();
    expect(dispose).not.toHaveBeenCalled();
    dispose.mockRestore();
    } finally { load?.mockRestore(); }
});

test('a directly animated leaf is not absorbed into a rigid batch', () => {
    const root = new THREE.Group(), geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial();
    for (const name of ['animated', 'static-a', 'static-b']) {
        const mesh = new THREE.Mesh(geometry, material); mesh.name = name; root.add(mesh);
    }
    root.userData.animations = [new THREE.AnimationClip('move', 1, [new THREE.NumberKeyframeTrack('animated.position[x]', [0, 1], [0, 1])])];
    batchHumanoidRenderParts(root);
    expect(root.getObjectByName('animated').isMesh).toBe(true);
    expect(visibleMeshes(root)).toHaveLength(2);
});

test('skeleton batches preserve every animated surface and pooled reset without new shared geometry', async () => {
    const source = createProceduralSkeleton(), batched = await MeshFactory.createMeshForType('Skeleton');
    // Runtime adds an interaction hitbox; this compares only constructor art.
    expect(batched.userData.humanoidRenderBatches).toEqual({ sourceMeshes: 51, drawMeshes: 34 });
    expect(visibleMeshes(batched).length).toBeLessThan(visibleMeshes(source).length);
    expect(batched.userData.bounds).toEqual(source.userData.bounds);
    expect(batched.userData.combatRadius).toBe(source.userData.combatRadius);
    for (const clip of source.userData.animations) {
        for (const phase of [.25, .7]) {
            const mixers = [source, batched].map(root => new THREE.AnimationMixer(root));
            mixers.forEach(mixer => { mixer.clipAction(clip).play(); mixer.update(clip.duration * phase); });
            checkSurfaces(source, batched);
            mixers.forEach((mixer, i) => { mixer.stopAllAction(); mixer.uncacheRoot([source, batched][i]); });
            source.userData.resetPose(); batched.userData.resetPose();
        }
    }
    const batch = visibleMeshes(batched).find(mesh => mesh.userData.humanoidBatchSources);
    const geometry = batch.geometry, original = batch.material;
    const dispose = jest.spyOn(geometry, 'dispose');
    batch.visible = false;
    batched.userData.resetPose(); expect(batch.visible).toBe(true);
    const actor = new Actor('batched-skeleton', {}); actor.setMesh(batched); actor.dispose();
    expect(dispose).not.toHaveBeenCalled(); dispose.mockRestore();
    const other = createProceduralSkeleton({ batch: true });
    expect(other.getObjectByName(batch.name).geometry).toBe(geometry);
    expect(other.getObjectByName(batch.name).material).toBe(original);
});
