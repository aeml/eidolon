import * as THREE from 'three';
import { jest } from '@jest/globals';
import { ChunkManager } from '../src/core/ChunkManager.js';

function createSceneHarness() {
    return {
        add: jest.fn(),
        remove: jest.fn()
    };
}

function createEntity({
    id = 'entity-1',
    type = 'Skeleton',
    x = 0,
    z = 0,
    mesh = null,
    ensureMesh = null
} = {}) {
    return {
        id,
        type,
        position: new THREE.Vector3(x, 0, z),
        isActive: true,
        mesh,
        isMeshLoading: false,
        update: jest.fn(),
        ensureMesh,
        dispose: jest.fn()
    };
}

function createImmediateThenable(callback) {
    return {
        then(onFulfilled) {
            onFulfilled(callback());
            return {
                catch() {
                    return this;
                }
            };
        }
    };
}

describe('ChunkManager scene residency', () => {
    test('update attaches meshes for newly active chunks even when ensureMesh resolves immediately', () => {
        const scene = createSceneHarness();
        const manager = new ChunkManager(scene);
        const mesh = { id: 'skeleton-mesh' };
        const entity = createEntity({
            ensureMesh: jest.fn(() => createImmediateThenable(() => {
                entity.mesh = mesh;
                return mesh;
            }))
        });
        const key = manager.getChunkKey(entity.position.x, entity.position.z);
        manager.chunks.set(key, new Set([entity]));

        manager.update({ position: new THREE.Vector3(0, 0, 0) }, 1 / 60, null, null, null);

        expect(entity.ensureMesh).toHaveBeenCalledTimes(1);
        expect(scene.add).toHaveBeenCalledWith(mesh);
        expect(manager.activeChunkKeys.has(key)).toBe(true);
    });

    test('always-visible town services stay scene-resident even outside active chunks', () => {
        const scene = createSceneHarness();
        const manager = new ChunkManager(scene);
        const mesh = { id: 'forge-mesh' };
        const entity = createEntity({
            type: 'Forge',
            x: 9999,
            z: 9999,
            ensureMesh: jest.fn(() => createImmediateThenable(() => {
                entity.mesh = mesh;
                return mesh;
            }))
        });

        manager.addEntity(entity);

        expect(entity.ensureMesh).toHaveBeenCalledTimes(1);
        expect(scene.add).toHaveBeenCalledWith(mesh);
    });

    test('removeEntity detaches non-disposable meshes from their current parent after reparenting', () => {
        const scene = createSceneHarness();
        const manager = new ChunkManager(scene);
        const otherParent = { remove: jest.fn() };
        const mesh = { parent: otherParent };
        const entity = createEntity({ mesh, ensureMesh: null });
        delete entity.dispose;
        const key = manager.getChunkKey(entity.position.x, entity.position.z);
        manager.chunks.set(key, new Set([entity]));

        manager.removeEntity(entity);

        expect(otherParent.remove).toHaveBeenCalledWith(mesh);
        expect(scene.remove).not.toHaveBeenCalled();
    });

    test('addEntity detaches meshes from their current parent when the chunk is inactive', () => {
        const scene = createSceneHarness();
        const manager = new ChunkManager(scene);
        const otherParent = { remove: jest.fn() };
        const mesh = { parent: otherParent };
        const entity = createEntity({ mesh, ensureMesh: null, x: 9999, z: 9999 });

        manager.addEntity(entity);

        expect(otherParent.remove).toHaveBeenCalledWith(mesh);
        expect(scene.remove).not.toHaveBeenCalled();
    });
});
