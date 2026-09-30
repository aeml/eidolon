import * as THREE from 'three';
import { jest } from '@jest/globals';
import { createLanternholdPerimeter, ownsPerimeterFence } from '../src/art/LanternholdPerimeter.js';
import { Fence } from '../src/entities/Fence.js';
import { MeshFactory } from '../src/utils/MeshFactory.js';

test('only matching local fence segments own replicated presentation', () => {
    const root = createLanternholdPerimeter(0, 200, 200, 200);
    try {
        expect(root.userData.fenceSegments).toHaveLength(184);
        for (const [x, z, rotation] of root.userData.fenceSegments) {
            expect(ownsPerimeterFence(root, { x, z, rotation })).toBe(true);
            expect(ownsPerimeterFence(root, { x, z, rotation: rotation + Math.PI })).toBe(true);
            expect(ownsPerimeterFence(root, { x, z, rotation: rotation + .2 })).toBe(false);
        }
        for (const data of [{ x: 100, z: 200 }, { x: 1000, z: 200 },
            { x: 100, z: 112, rotation: Math.PI / 2, scale: 2 }]) {
            expect(ownsPerimeterFence(root, data)).toBe(false);
        }
        expect(ownsPerimeterFence(null, { x: 100, z: 112 })).toBe(false);
        expect(ownsPerimeterFence(new THREE.Group(), { x: 100, z: 112 })).toBe(false);
    } finally {
        const materials = new Set();
        root.traverse(mesh => { mesh.geometry?.dispose(); if (mesh.material) materials.add(mesh.material); });
        materials.forEach(material => material.dispose());
    }
});

test('environment-owned fence never requests a legacy mesh; remote-only fences still do', async () => {
    const loader = jest.spyOn(MeshFactory, 'createMeshForType').mockResolvedValue(new THREE.Group());
    try {
        const local = new Fence('town', 100, 112, Math.PI / 2, { environmentOwned: true });
        await local.ensureMesh(); await local.ensureMesh();
        expect(local.mesh).toBeNull(); expect(local.isActive).toBe(true);
        expect(local.position.toArray()).toEqual([100, 0, 112]);
        expect(loader).not.toHaveBeenCalled();
        const outer = new Fence('realm', 1000, 112, Math.PI / 2);
        await Promise.resolve();
        expect(loader).toHaveBeenCalledWith('Fence', { quality: undefined });
        expect(outer.mesh).not.toBeNull();
    } finally { loader.mockRestore(); }
});
