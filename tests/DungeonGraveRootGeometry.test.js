import * as THREE from 'three';
import { jest } from '@jest/globals';
import { createDungeonGraveRootGeometry } from '../src/art/DungeonGraveRootGeometry.js';
import { createProceduralDungeonInteriorKit } from '../src/art/ProceduralDungeonInteriors.js';
import { RenderSystem } from '../src/core/RenderSystem.js';

test.each(['low', 'high'])('%s grave roots form a bounded, low, branched silhouette with finite smooth normals and restrained bark tones', quality => {
    const geometry = createDungeonGraveRootGeometry(quality), repeat = createDungeonGraveRootGeometry(quality);
    const { position, normal, color } = geometry.attributes, n = new THREE.Vector3();
    expect(geometry.index.count / 3).toBeLessThanOrEqual(quality === 'low' ? 500 : 1500);
    const bytes = Object.values(geometry.attributes).reduce((sum, attribute) => sum + attribute.array.byteLength, geometry.index.array.byteLength);
    expect(bytes).toBeLessThan(quality === 'low' ? 20000 : 50000);
    for (let i = 0; i < position.count; i++) {
        expect([position.getX(i), position.getY(i), position.getZ(i)].every(Number.isFinite)).toBe(true);
        expect(n.fromBufferAttribute(normal, i).length()).toBeCloseTo(1, 5);
    }
    expect([...color.array].every(value => Number.isFinite(value) && value > .4 && value <= 1)).toBe(true);
    expect(new Set([...color.array].map(value => value.toFixed(2))).size).toBeGreaterThan(8);
    const box = geometry.boundingBox;
    expect(box.min.x).toBeGreaterThan(-1.2); expect(box.max.x).toBeLessThan(1.1);
    // The thick end penetrates the floor; every exposed branch remains low.
    expect(box.min.y).toBeGreaterThan(-.2); expect(box.max.y).toBeLessThan(.3);
    expect(box.min.z).toBeGreaterThan(-.65); expect(box.max.z).toBeLessThan(.7);
    expect(box.max.z - box.min.z).toBeGreaterThan(1.1);
    for (const key of Object.keys(geometry.attributes)) expect(geometry.attributes[key].array).toEqual(repeat.attributes[key].array);
    geometry.dispose(); repeat.dispose();
});

test.each(['low', 'high'])('%s roots stay inside the smallest room and batch without changing navigation or room state', quality => {
    const kit = createProceduralDungeonInteriorKit('verdant_bastion_catacombs', { quality });
    const room = { x: 20000, z: 20000, width: 40, height: 40, type: 'start' };
    const source = kit.createRoomDressing(room, 0, { optimized: false });
    const batched = kit.createRoomDressing(room, 0);
    source.updateMatrixWorld(true);
    const roots = [-1, 1].map(side => source.getObjectByName(`verdant:grave-root:${side}`));
    for (const root of roots) {
        const bounds = new THREE.Box3().setFromObject(root);
        expect(bounds.min.x).toBeGreaterThan(room.x - room.width / 2);
        expect(bounds.max.x).toBeLessThan(room.x + room.width / 2);
        expect(bounds.min.z).toBeGreaterThan(room.z - room.height / 2);
        expect(bounds.max.z).toBeLessThan(room.z + room.height / 2);
        expect(bounds.max.y).toBeLessThan(1);
        expect(root.material.roughness).toBeGreaterThan(.9);
        expect(root.material.metalness).toBe(0);
        expect(root.material.transparent).toBe(false);
        expect(root.material.vertexColors).toBe(true);
    }
    const bakedRoots = batched.children.filter(part => part.material === roots[0].material);
    expect(bakedRoots).toHaveLength(1);
    expect(bakedRoots[0].geometry.attributes.position.count).toBe(roots[0].geometry.index.count * 2);
    expect(batched.userData.drawMeshCount).toBeLessThanOrEqual(8);
    expect(batched.userData.visualOnly).toBe(true);
    expect(batched.getObjectByName('DungeonRoomState:verdant_bastion_catacombs:0')).toBeDefined();
    const ray = new THREE.Raycaster(new THREE.Vector3(room.x, .5, room.z - 14), new THREE.Vector3(0, 0, 1), 0, 28);
    source.updateMatrixWorld(true);
    expect(ray.intersectObjects(roots)).toHaveLength(0);
    // A scene replacement owns the two roots' one merged geometry/material.
    const geometryDisposed = jest.fn(), materialDisposed = jest.fn();
    bakedRoots[0].geometry.addEventListener('dispose', geometryDisposed);
    bakedRoots[0].material.addEventListener('dispose', materialDisposed);
    RenderSystem.prototype.disposeObjectResources.call({}, batched);
    expect(geometryDisposed).toHaveBeenCalledTimes(1); expect(materialDisposed).toHaveBeenCalledTimes(1);
});
