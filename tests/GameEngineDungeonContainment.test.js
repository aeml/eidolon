import * as THREE from 'three';
import { jest } from '@jest/globals';

const worldGeneratorInstances = [];

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

jest.unstable_mockModule('../src/world/WorldGenerator.js', () => ({
    WorldGenerator: class MockWorldGenerator {
        constructor(scene, collisionManager) {
            this.scene = scene;
            this.collisionManager = collisionManager;
            this.createDungeon = jest.fn().mockResolvedValue();
            this.createVerdantBastionCatacombs = jest.fn().mockResolvedValue();
            this.createMoltenCore = jest.fn().mockResolvedValue();
            this.createTempestSpire = jest.fn().mockResolvedValue();
            this.createAbyssalWell = jest.fn().mockResolvedValue();
            this.createTown = jest.fn().mockResolvedValue();
            this.createOverworldStructures = jest.fn().mockResolvedValue();
            worldGeneratorInstances.push(this);
        }
    }
}));

const { GameEngine } = await import('../src/core/GameEngine.js');

function createScene() {
    return {
        children: [{ id: 'existing-1' }, { id: 'existing-2' }],
        add: jest.fn(),
        remove(child) {
            const index = this.children.indexOf(child);
            if (index >= 0) {
                this.children.splice(index, 1);
            }
        }
    };
}

function createEngineHarness() {
    const engine = Object.create(GameEngine.prototype);
    const scene = createScene();
    const playerMesh = { position: new THREE.Vector3(), visible: false };

    engine.currentInstanceId = null;
    engine.remotePlayers = new Map();
    engine.enemies = [];
    engine.lootDrops = [];
    engine.cameraLocked = true;
    engine.renderSystem = {
        scene,
        setupLights: jest.fn(),
        setCameraTarget: jest.fn(),
        preloadEnvironment: jest.fn().mockResolvedValue()
    };
    engine.chunkManager = {
        removeEntity: jest.fn(),
        updateEntityChunk: jest.fn()
    };
    engine.collisionManager = {
        clear: jest.fn(),
        setDungeonWalkableGeometry: jest.fn(),
        clearDungeonWalkableGeometry: jest.fn()
    };
    engine.player = {
        position: new THREE.Vector3(),
        mesh: playerMesh,
        targetPosition: new THREE.Vector3(1, 0, 1),
        state: 'MOVING',
        playAnimation: jest.fn()
    };

    return engine;
}

beforeEach(() => {
    worldGeneratorInstances.length = 0;
});

describe('GameEngine dungeon containment wiring', () => {
    test.each([
        ['verdant_bastion_catacombs', 'createVerdantBastionCatacombs'],
        ['molten_core', 'createMoltenCore'],
        ['tempest_spire', 'createTempestSpire'],
        ['abyssal_well', 'createAbyssalWell']
    ])('enterInstance activates canonical dungeon containment for %s', async (instanceType, generatorMethod) => {
        const engine = createEngineHarness();
        const layout = {
            rooms: [{ x: 12, z: 34, width: 80 }],
            walkRects: [
                { x: 12, z: 34, width: 80, height: 80, kind: 'room' },
                { x: 60, z: 34, width: 20, height: 40, kind: 'corridor' }
            ]
        };

        await engine.enterInstance('instance-1', instanceType, layout);

        expect(engine.collisionManager.clear).toHaveBeenCalled();
        expect(engine.collisionManager.setDungeonWalkableGeometry).toHaveBeenCalledWith(layout.walkRects);
        expect(engine.collisionManager.clearDungeonWalkableGeometry).not.toHaveBeenCalled();
        expect(worldGeneratorInstances).toHaveLength(1);
        expect(worldGeneratorInstances[0][generatorMethod]).toHaveBeenCalledWith(0, 0, layout);
        expect(engine.player.position.x).toBe(12);
        expect(engine.player.position.z).toBe(34);
    });

    test('enterInstance clears dungeon containment when returning to overworld', async () => {
        const engine = createEngineHarness();

        await engine.enterInstance('instance-2', 'overworld', null);

        expect(engine.collisionManager.clear).toHaveBeenCalled();
        expect(engine.collisionManager.clearDungeonWalkableGeometry).toHaveBeenCalled();
        expect(engine.collisionManager.setDungeonWalkableGeometry).not.toHaveBeenCalled();
        expect(worldGeneratorInstances).toHaveLength(1);
        expect(worldGeneratorInstances[0].createTown).toHaveBeenCalledWith(0, 200, 100);
        expect(worldGeneratorInstances[0].createOverworldStructures).toHaveBeenCalled();
    });
});