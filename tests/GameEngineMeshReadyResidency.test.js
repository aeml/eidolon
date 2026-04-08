import * as THREE from 'three';
import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/proto/state_pb.js', () => {
    const mock = {
        eidolon: {
            state: {
                StateEnvelope: {
                    decode: jest.fn()
                }
            }
        }
    };
    return { default: mock, ...mock };
});

const { GameEngine } = await import('../src/core/GameEngine.js');

function createMesh() {
    return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
}

function createEngineHarness({ activeChunk = false } = {}) {
    const engine = Object.create(GameEngine.prototype);
    engine.renderSystem = {
        add: jest.fn(),
        remove: jest.fn()
    };
    engine.collisionManager = {
        addCollider: jest.fn()
    };
    engine.chunkManager = {
        activeChunkKeys: new Set(activeChunk ? ['0,0'] : []),
        getChunkKey: jest.fn(() => '0,0'),
        addEntity: jest.fn(entity => entity.ensureMesh?.())
    };
    return engine;
}

function createImmediateMeshEntity(type = 'Skeleton') {
    return {
        id: `${type.toLowerCase()}-1`,
        type,
        isActive: true,
        mesh: null,
        position: new THREE.Vector3(0, 0, 0),
        rotation: new THREE.Quaternion(),
        onMeshReady: jest.fn(),
        ensureMesh() {
            const mesh = createMesh();
            this.mesh = mesh;
            if (this.onMeshReady) {
                this.onMeshReady(mesh);
                this.onMeshReady = null;
            }
            return Promise.resolve(mesh);
        }
    };
}

describe('GameEngine mesh-ready residency', () => {
    test('addEntity still runs mesh-ready hook when chunk registration resolves immediately', () => {
        const engine = createEngineHarness({ activeChunk: true });
        const entity = createImmediateMeshEntity('Skeleton');
        const originalOnMeshReady = entity.onMeshReady;

        engine.addEntity(entity);

        expect(engine.chunkManager.addEntity).toHaveBeenCalledWith(entity);
        expect(originalOnMeshReady).toHaveBeenCalledTimes(1);
        expect(engine.renderSystem.add).toHaveBeenCalledWith(entity.mesh);
    });

    test('always-visible town services stay render-resident and get collision setup after immediate mesh load', () => {
        const engine = createEngineHarness({ activeChunk: false });
        const entity = createImmediateMeshEntity('Forge');

        engine.addEntity(entity);

        expect(engine.renderSystem.add).toHaveBeenCalledWith(entity.mesh);
        expect(engine.collisionManager.addCollider).toHaveBeenCalledTimes(1);
    });
});
