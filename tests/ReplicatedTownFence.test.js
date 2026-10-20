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

test('a perimeter arriving after the actor retires both loaded and pending legacy rectangles', async () => {
    let resolve;
    const loader = jest.spyOn(MeshFactory, 'createMeshForType').mockImplementation(() => new Promise(done => { resolve = done; }));
    const release = jest.spyOn(MeshFactory, 'releaseMesh').mockImplementation(() => {});
    try {
        const pending = new Fence('early-realm', 1000, 112, Math.PI / 2);
        pending.adoptEnvironmentPerimeter();
        const stale = new THREE.Group(); resolve(stale);
        await Promise.resolve(); await Promise.resolve();
        expect(pending.isActive).toBe(true);
        expect(pending.mesh).toBeNull();
        expect(pending.meshType).toBeNull();
        expect(release).toHaveBeenCalledWith('Fence', stale);
        const loaded = new Fence('loaded-realm', 1000, 116, Math.PI / 2);
        loaded.mesh = new THREE.Group();
        const scene = new THREE.Scene(); scene.add(loaded.mesh);
        loaded.adoptEnvironmentPerimeter();
        expect(scene.children).toHaveLength(0);
        expect(loaded.isActive).toBe(true);
        expect(loaded.mesh).toBeNull();
    } finally { loader.mockRestore(); release.mockRestore(); }
});

jest.unstable_mockModule('../src/proto/state_pb.js', () => ({
    eidolon: { state: { StateEnvelope: { decode: jest.fn() } } }
}));
const { GameEngine } = await import('../src/core/GameEngine.js');

test.each(['EarthFence', 'WaterFence', 'FireFence', 'AirFence'])('%s retires an already loaded replicated rectangle without losing the actor', async name => {
    const load = jest.spyOn(MeshFactory, 'createMeshForType').mockResolvedValue(new THREE.Group());
    const release = jest.spyOn(MeshFactory, 'releaseMesh').mockImplementation(() => {});
    const actor = new Fence('replicated', 1000, 112, Math.PI / 2);
    try {
        await actor.ensureMesh();
        const scene = new THREE.Group(), root = new THREE.Group(); root.name = name;
        root.userData.fenceSegments = [[1000, 112, Math.PI / 2]];
        scene.add(root, actor.mesh);
        const oldMesh = actor.mesh;
        GameEngine.prototype.adoptEnvironmentFences.call({
            getInstanceEnvironmentGroup: () => scene, remotePlayers: new Map([[actor.id, actor]])
        });
        expect(actor.environmentOwned).toBe(true);
        expect(actor.isActive).toBe(true);
        expect(actor.mesh).toBeNull();
        expect(actor.position.toArray()).toEqual([1000, 0, 112]);
        expect(scene.children).toEqual([root]);
        expect(release).toHaveBeenCalledWith('Fence', oldMesh);
    } finally { actor.dispose(); load.mockRestore(); release.mockRestore(); }
});
