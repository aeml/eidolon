import { jest } from '@jest/globals';
import * as THREE from 'three';
import { registerAnimatedEquipmentBatches, updateAnimatedEquipmentBatches,
    clearAnimatedEquipmentBatches, suspendAnimatedEquipmentBatches } from '../src/art/AnimatedEquipmentBatches.js';

function fixture() {
    const scene = new THREE.Scene(), root = new THREE.Group(); scene.add(root);
    const material = new THREE.MeshStandardMaterial({ color: 0x98654f });
    const geometry = new THREE.BoxGeometry(.4, 1, .4);
    const parts = [0, 1].map(index => {
        const pivot = new THREE.Group(), gear = new THREE.Group(); gear.userData.equipmentVisual = true;
        root.add(pivot); pivot.position.set(index ? -2 : 2, index, 0); pivot.add(gear);
        const part = new THREE.Mesh(geometry, material); part.name = `piece-${index}`;
        part.castShadow = part.receiveShadow = true; gear.add(part); return part;
    });
    registerAnimatedEquipmentBatches(root);
    const update = supported => updateAnimatedEquipmentBatches(scene, { extensions: { has: () => supported } });
    const batch = () => root.children.find(child => child.isBatchedMesh);
    const cleanup = () => { clearAnimatedEquipmentBatches(root); material.dispose(); geometry.dispose(); };
    return { scene, root, parts, geometry, material, update, batch, cleanup };
}

test('same-material sources at independent anchors retain exact animated transforms', () => {
    const f = fixture();
    try {
        f.root.position.set(100, 2, -80); f.root.rotation.y = .8; f.root.scale.setScalar(1.5);
        f.update(true);
        const batch = f.batch(), matrix = new THREE.Matrix4();
        expect(batch.material).toBe(f.material); expect(batch.castShadow).toBe(true);
        expect(batch.receiveShadow).toBe(true); expect(batch.frustumCulled).toBe(false);
        expect(batch.perObjectFrustumCulled).toBe(true);
        expect(batch.instanceCount).toBe(2);
        f.parts.forEach((part, index) => {
            expect(part.visible).toBe(false); batch.getMatrixAt(index, matrix);
            const expected = new THREE.Matrix4().copy(f.root.matrixWorld).invert().multiply(part.matrixWorld);
            matrix.elements.forEach((value, i) => expect(value).toBeCloseTo(expected.elements[i], 5));
        });
        f.parts[0].parent.parent.rotation.z = .75; f.update(true); batch.getMatrixAt(0, matrix);
        expect(matrix.elements[1]).toBeCloseTo(Math.sin(.75), 5);
    } finally { f.cleanup(); }
});

test('missing multi-draw does not allocate batches and retains ordinary source meshes', () => {
    const f = fixture();
    try { f.update(false); expect(f.batch()).toBeUndefined(); expect(f.parts.every(part => part.visible)).toBe(true); }
    finally { f.cleanup(); }
});

test('unchanged transforms retain matrix textures without marking another upload', () => {
    const f = fixture();
    try {
        f.update(true); const batch = f.batch(), update = jest.spyOn(batch, 'setMatrixAt');
        f.update(true); expect(update).not.toHaveBeenCalled();
        f.parts[0].parent.parent.rotation.z = .5; f.update(true);
        expect(update).toHaveBeenCalledTimes(1);
    } finally { f.cleanup(); }
});

test('suspension restores original pieces, and resumption restores current matrices', () => {
    const f = fixture();
    try {
        f.update(true); const batch = f.batch(); suspendAnimatedEquipmentBatches(f.root, true);
        expect(batch.visible).toBe(false); expect(f.parts.every(part => part.visible)).toBe(true);
        f.parts[0].visible = false; f.update(true);
        expect(f.parts[0].visible).toBe(false); // Do not undo stealth's piece ordering.
        f.parts[0].visible = true; suspendAnimatedEquipmentBatches(f.root, false); f.update(true);
        expect(batch.visible).toBe(true); expect(f.parts.every(part => !part.visible)).toBe(true);
        f.update(false); expect(f.parts.every(part => part.visible)).toBe(true);
    } finally { f.cleanup(); }
});

test.each(['material', 'geometry', 'shadow', 'layers', 'order', 'negative-scale', 'detached'])('changed %s uses original meshes without stale batch appearance', change => {
    const f = fixture(); let replacement;
    try {
        f.update(true);
        if (change === 'material') f.parts[0].material = replacement = new THREE.MeshStandardMaterial();
        if (change === 'geometry') f.parts[0].geometry = replacement = new THREE.SphereGeometry();
        if (change === 'shadow') f.parts[0].castShadow = false;
        if (change === 'layers') f.parts[0].layers.set(2);
        if (change === 'order') f.parts[0].renderOrder = 10;
        if (change === 'negative-scale') f.parts[0].scale.x = -1;
        if (change === 'detached') f.parts[0].parent.removeFromParent();
        f.update(true); expect(f.batch().visible).toBe(false);
        expect(f.parts.every(part => part.visible)).toBe(true);
    } finally { f.cleanup(); replacement?.dispose(); }
});

test('hidden anchors cull instances and hidden actors skip buffer updates', () => {
    const f = fixture();
    try {
        f.update(true); const batch = f.batch(); f.parts[0].parent.visible = false; f.update(true);
        expect(batch.getVisibleAt(0)).toBe(false); expect(batch.getVisibleAt(1)).toBe(true);
        const update = jest.spyOn(batch, 'setMatrixAt'); f.root.visible = false; f.update(true);
        expect(update).not.toHaveBeenCalled();
    } finally { f.cleanup(); }
});

test('cleanup releases only owned GPU buffers once, never shared surfaces', () => {
    const f = fixture();
    const geometry = jest.spyOn(f.geometry, 'dispose'), material = jest.spyOn(f.material, 'dispose');
    f.update(true); const batch = f.batch(), owned = jest.spyOn(batch.geometry, 'dispose');
    const matrices = jest.spyOn(batch._matricesTexture, 'dispose'), indirect = jest.spyOn(batch._indirectTexture, 'dispose');
    batch.dispose(); clearAnimatedEquipmentBatches(f.root); clearAnimatedEquipmentBatches(f.root);
    expect(owned).toHaveBeenCalledTimes(1); expect(matrices).toHaveBeenCalledTimes(1); expect(indirect).toHaveBeenCalledTimes(1);
    expect(geometry).not.toHaveBeenCalled(); expect(material).not.toHaveBeenCalled();
    expect(f.parts.every(part => part.visible)).toBe(true); expect(f.batch()).toBeUndefined(); f.cleanup();
});

test('disposed buffers rebuild safely on later renderer use', () => {
    const f = fixture();
    try {
        f.update(true); const old = f.batch(); old.dispose(); f.update(true);
        expect(f.batch()).not.toBe(old); expect(f.batch().visible).toBe(true);
    } finally { f.cleanup(); }
});
