import * as THREE from 'three';
import { jest } from '@jest/globals';
import { Entity } from '../src/entities/Entity.js';
import { MeshFactory } from '../src/utils/MeshFactory.js';
import { ChunkManager } from '../src/core/ChunkManager.js';

function pending() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
function entity() {
    const result = new Entity('mesh-lifetime'); result.meshType = 'Fighter'; return result;
}
beforeEach(() => jest.spyOn(MeshFactory, 'releaseMesh').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

test('a model finishing after chunk disposal returns to its pool without attaching', async () => {
    const item = entity(), load = pending(), mesh = new THREE.Group();
    jest.spyOn(MeshFactory, 'createMeshForType').mockReturnValue(load.promise);
    const task = item.ensureMesh(); expect(item.isMeshLoading).toBe(true);
    item.dispose(); load.resolve(mesh); await task;
    expect(item.isActive).toBe(true); // Unloaded entities must remain reloadable.
    expect(item.mesh).toBeNull(); expect(mesh.parent).toBeNull();
    expect(item.isMeshLoading).toBe(false);
    expect(MeshFactory.releaseMesh).toHaveBeenCalledTimes(1);
    expect(MeshFactory.releaseMesh).toHaveBeenCalledWith('Fighter', mesh);
});

test('reentering a chunk can load afresh without the old result replacing the new model', async () => {
    const item = entity(), old = pending(), fresh = pending();
    const oldMesh = new THREE.Group(), freshMesh = new THREE.Group();
    const create = jest.spyOn(MeshFactory, 'createMeshForType')
        .mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const oldTask = item.ensureMesh(); item.dispose();
    const freshTask = item.ensureMesh();
    expect(create).toHaveBeenCalledTimes(2);
    fresh.resolve(freshMesh); await freshTask;
    expect(item.mesh).toBe(freshMesh);
    old.resolve(oldMesh); await oldTask;
    expect(item.mesh).toBe(freshMesh);
    expect(MeshFactory.releaseMesh).toHaveBeenCalledTimes(1);
    expect(MeshFactory.releaseMesh).toHaveBeenCalledWith('Fighter', oldMesh);
    item.dispose();
});

test.each(['resolve', 'reject'])('an old %s cannot clear the newer load guard and admit a duplicate request', async outcome => {
    const item = entity(), old = pending(), fresh = pending();
    const create = jest.spyOn(MeshFactory, 'createMeshForType')
        .mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const oldTask = item.ensureMesh(); item.dispose();
    const freshTask = item.ensureMesh();
    if (outcome === 'resolve') old.resolve(new THREE.Group());
    else old.reject(new Error('Old fixture request failed'));
    await oldTask;
    expect(item.isMeshLoading).toBe(true);
    await item.ensureMesh(); expect(create).toHaveBeenCalledTimes(2);
    fresh.resolve(new THREE.Group()); await freshTask;
    expect(item.isMeshLoading).toBe(false); expect(item.mesh).not.toBeNull();
    if (outcome === 'reject') expect(error).toHaveBeenCalledTimes(1);
    item.dispose();
});

test('an inactive entity starts no model request', async () => {
    const item = entity(); item.isActive = false;
    const create = jest.spyOn(MeshFactory, 'createMeshForType').mockResolvedValue(new THREE.Group());
    await item.ensureMesh(); expect(create).not.toHaveBeenCalled();
});

test.each([
    ['desktop Low', false, 'low', 'low'],
    ['desktop Medium', false, 'medium', 'medium'],
    ['desktop High', false, 'high', 'high'],
    ['mobile Low', true, 'low', 'low'],
    ['mobile Medium', true, 'medium', 'low'],
    ['mobile High', true, 'high', 'low']
])('%s loads the renderer-selected actor detail without changing model ownership', async (_, isMobile, graphicsQuality, expected) => {
    const item = entity(), mesh = new THREE.Group();
    item.gameEngine = { renderSystem: { isMobile, graphicsQuality } };
    const create = jest.spyOn(MeshFactory, 'createMeshForType').mockResolvedValue(mesh);
    await item.ensureMesh();
    expect(create).toHaveBeenCalledWith('Fighter', { quality: expected });
    expect(item.mesh).toBe(mesh);
    item.dispose();
    expect(MeshFactory.releaseMesh).toHaveBeenCalledWith('Fighter', mesh);
});

test('ordinary concurrent ensures still share one load and preserve the accepted transform', async () => {
    const item = entity(), load = pending(), mesh = new THREE.Group();
    item.position.set(12, 0, 24); item.setScale(1.5);
    const create = jest.spyOn(MeshFactory, 'createMeshForType').mockReturnValue(load.promise);
    const task = item.ensureMesh(); await item.ensureMesh();
    expect(create).toHaveBeenCalledTimes(1); expect(create).toHaveBeenCalledWith('Fighter', { quality: undefined });
    load.resolve(mesh); await task;
    expect(item.mesh).toBe(mesh); expect(mesh.userData.entityId).toBe(item.id);
    item.render(1); // Entity applies accepted transforms in its render step.
    expect(mesh.position.toArray()).toEqual([12, 0, 24]);
    expect(mesh.scale.toArray()).toEqual([1.5, 1.5, 1.5]);
    item.dispose();
});

test('actual chunk unload/reentry attaches only the current model even when the original request finishes last', async () => {
    const item = entity(), scene = new THREE.Group(), chunks = new ChunkManager(scene);
    const old = pending(), fresh = pending(), oldMesh = new THREE.Group(), freshMesh = new THREE.Group();
    const create = jest.spyOn(MeshFactory, 'createMeshForType')
        .mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    chunks.activeChunkKeys.add('0,0'); chunks.addEntity(item);
    chunks.activeChunkKeys.clear(); chunks.unloadChunk('0,0');
    expect(item.isActive).toBe(true);
    chunks.activeChunkKeys.add('0,0'); chunks.loadChunk('0,0');
    expect(create).toHaveBeenCalledTimes(2);
    fresh.resolve(freshMesh); await fresh.promise; await Promise.resolve();
    expect(item.mesh).toBe(freshMesh); expect(freshMesh.parent).toBe(scene);
    old.resolve(oldMesh); await old.promise; await Promise.resolve();
    expect(item.mesh).toBe(freshMesh); expect(scene.children).toEqual([freshMesh]);
    expect(oldMesh.parent).toBeNull();
    expect(MeshFactory.releaseMesh).toHaveBeenCalledWith('Fighter', oldMesh);
    chunks.removeEntity(item);
});

test('removing from an active chunk prevents a pending result from reattaching to its scene', async () => {
    const item = entity(), scene = new THREE.Group(), chunks = new ChunkManager(scene);
    const load = pending(), mesh = new THREE.Group();
    jest.spyOn(MeshFactory, 'createMeshForType').mockReturnValue(load.promise);
    chunks.activeChunkKeys.add('0,0'); chunks.addEntity(item); chunks.removeEntity(item);
    load.resolve(mesh); await load.promise; await Promise.resolve();
    expect(scene.children).toEqual([]); expect(item.mesh).toBeNull();
    expect(MeshFactory.releaseMesh).toHaveBeenCalledWith('Fighter', mesh);
});

test('a model-type change returns a late result to the captured old pool, not the new class pool', async () => {
    const item = entity(), oldMesh = new THREE.Group(), currentMesh = new THREE.Group();
    const create = jest.spyOn(MeshFactory, 'createMeshForType')
        .mockResolvedValueOnce(oldMesh).mockResolvedValueOnce(currentMesh);
    const task = item.ensureMesh(); item.meshType = 'Rogue'; await task;
    expect(item.mesh).toBeNull(); expect(item.isMeshLoading).toBe(false);
    expect(MeshFactory.releaseMesh).toHaveBeenCalledWith('Fighter', oldMesh);
    await item.ensureMesh(); expect(create).toHaveBeenLastCalledWith('Rogue', { quality: undefined });
    expect(item.mesh).toBe(currentMesh); item.dispose();
});
