import * as THREE from 'three';
import { jest } from '@jest/globals';
import { batchRigidEquipmentPivots, clearRigidEquipmentPivots, suspendRigidEquipmentPivots } from '../src/art/RigidEquipmentPivots.js';
import { createProceduralFighter } from '../src/art/ProceduralHumanoid.js';
import { applyProceduralEquipment } from '../src/art/ProceduralEquipment.js';
import { MeshFactory } from '../src/utils/MeshFactory.js';

function fixture() {
    const root = new THREE.Group(), pivot = new THREE.Group(), anchor = new THREE.Group();
    pivot.name = 'Rig_Torso'; root.add(pivot); pivot.add(anchor);
    root.userData.proceduralHumanoid = true;
    root.userData.animations = [new THREE.AnimationClip('Run', 1,
        [new THREE.NumberKeyframeTrack('Rig_Torso.rotation[y]', [0, 1], [0, .8])])];
    const material = new THREE.MeshStandardMaterial({ color: 'red' });
    const sources = [];
    for (let i = 0; i < 2; i++) {
        const item = new THREE.Group(); item.userData.equipmentVisual = true;
        item.position.set(i, .2, -.4); item.scale.set(1, .9, 1.1); anchor.add(item);
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(.5, .5, .5), material);
        mesh.position.set(.1, i * .3, 0); mesh.castShadow = true;
        mesh.name = `Gear_${i}`; item.add(mesh); sources.push(mesh);
    }
    return { root, pivot, anchor, material, sources };
}

function worldVertices(root) {
    root.updateMatrixWorld(true);
    const vertices = [];
    root.traverseVisible(mesh => {
        if (!mesh.isMesh) return;
        const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
        const positions = geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) vertices.push(new THREE.Vector3()
            .fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld).toArray().map(v => v.toFixed(5)).join(','));
        geometry.dispose();
    });
    return vertices.sort();
}

test('static anchor fits remain identical beneath a moving animation pivot', () => {
    const { root, pivot, sources } = fixture();
    const mixer = new THREE.AnimationMixer(root);
    mixer.clipAction(root.userData.animations[0]).play(); mixer.update(.37);
    const expected = worldVertices(root);
    batchRigidEquipmentPivots(root);
    expect(pivot.children.filter(mesh => mesh.userData.rigidEquipmentPivot)).toHaveLength(1);
    expect(sources.every(mesh => !mesh.visible)).toBe(true);
    expect(worldVertices(root)).toEqual(expected);
    mixer.update(.29); const batched = worldVertices(root);
    clearRigidEquipmentPivots(root);
    expect(worldVertices(root)).toEqual(batched);
    mixer.stopAllAction(); mixer.uncacheRoot(root);
});

test('every clip target is a boundary, including equipment-anchor rotations', () => {
    const { root, pivot, anchor } = fixture(); anchor.name = 'Equipment_FootLeft';
    root.userData.animations.push(new THREE.AnimationClip('Cast', 1,
        [new THREE.NumberKeyframeTrack('Equipment_FootLeft.rotation[x]', [0, 1], [0, .4])]));
    batchRigidEquipmentPivots(root);
    expect(anchor.children.filter(mesh => mesh.userData.rigidEquipmentPivot)).toHaveLength(1);
    expect(pivot.children.some(mesh => mesh.userData.rigidEquipmentPivot)).toBe(false);
    clearRigidEquipmentPivots(root);
});

test.each(['transparent', 'material', 'shadow', 'layer', 'order', 'reflection', 'animated', 'attributes'])('%s boundary retains source meshes', mode => {
    const { root, sources } = fixture();
    if (mode === 'transparent') sources[0].material.transparent = true;
    if (mode === 'material') sources[0].material = sources[0].material.clone();
    if (mode === 'shadow') sources[0].castShadow = false;
    if (mode === 'layer') sources[0].layers.set(2);
    if (mode === 'order') sources[0].renderOrder = 3;
    if (mode === 'reflection') sources[0].scale.x = -1;
    if (mode === 'animated') root.userData.animations[0].tracks.push(new THREE.NumberKeyframeTrack('Gear_0.rotation[y]', [0, 1], [0, 1]));
    if (mode === 'attributes') sources[0].geometry.deleteAttribute('uv');
    batchRigidEquipmentPivots(root);
    expect(sources.every(mesh => mesh.visible)).toBe(true);
    clearRigidEquipmentPivots(root);
});

test('stealth suspension reuses geometry, and clear disposes only owned geometry once', () => {
    const { root, pivot, material, sources } = fixture();
    const originalDispose = sources.map(mesh => jest.spyOn(mesh.geometry, 'dispose'));
    const materialDispose = jest.spyOn(material, 'dispose');
    batchRigidEquipmentPivots(root);
    const mesh = pivot.children.find(mesh => mesh.userData.rigidEquipmentPivot);
    const dispose = jest.spyOn(mesh.geometry, 'dispose');
    for (let i = 0; i < 3; i++) {
        suspendRigidEquipmentPivots(root, true);
        expect(mesh.visible).toBe(false); expect(sources.every(mesh => mesh.visible)).toBe(true);
        suspendRigidEquipmentPivots(root, false);
        expect(mesh.visible).toBe(true); expect(sources.every(mesh => !mesh.visible)).toBe(true);
    }
    expect(dispose).not.toHaveBeenCalled();
    clearRigidEquipmentPivots(root); clearRigidEquipmentPivots(root);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(mesh.parent).toBeNull(); expect(sources.every(mesh => mesh.visible)).toBe(true);
    expect(materialDispose).not.toHaveBeenCalled();
    originalDispose.forEach(spy => expect(spy).not.toHaveBeenCalled());
});

test('pool return clears loadout and owned geometry even when the pool is full', () => {
    const originalPool = MeshFactory.pool.Fighter;
    try {
        for (const full of [false, true]) {
            MeshFactory.pool.Fighter = full ? Array(50).fill(null) : [];
            const root = createProceduralFighter();
            applyProceduralEquipment(root, { ring1: { id: 'a', name: 'Ruby Ring', rarity: 'Rare', slot: 'ring' },
                ring2: { id: 'b', name: 'Ruby Ring', rarity: 'Rare', slot: 'ring' } });
            // Use deterministic same-pivot sources to test the pool seam even
            // when the selected item's materials do not happen to batch.
            const { root: simple } = fixture();
            batchRigidEquipmentPivots(simple);
            const batches = []; simple.traverse(mesh => { if (mesh.userData.rigidEquipmentPivot) batches.push(mesh); });
            const dispose = jest.spyOn(batches[0].geometry, 'dispose');
            MeshFactory.releaseMesh('Fighter', simple);
            expect(dispose).toHaveBeenCalledTimes(1);
            MeshFactory.releaseMesh('Fighter', root);
            expect(root.userData.equipmentVisualSignature).toBe('');
            expect(root.userData.equipmentVisualItemCount).toBe(0);
        }
    } finally { MeshFactory.pool.Fighter = originalPool; }
});
