import * as THREE from 'three';
import { jest } from '@jest/globals';
import { EnvironmentalHazard } from '../src/entities/EnvironmentalHazard.js';

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
        children: [],
        add(child) {
            if (!child) return;
            if (!this.children.includes(child)) {
                this.children.push(child);
            }
            child.parent = this;
        },
        remove(child) {
            const index = this.children.indexOf(child);
            if (index >= 0) {
                this.children.splice(index, 1);
                child.parent = null;
            }
        }
    };
}

function createGroup(name) {
    return {
        name,
        parent: null,
        children: [],
        add(child) {
            if (!child) return;
            if (child.parent && child.parent !== this && typeof child.parent.remove === 'function') {
                child.parent.remove(child);
            }
            if (!this.children.includes(child)) {
                this.children.push(child);
            }
            child.parent = this;
        },
        remove(child) {
            const index = this.children.indexOf(child);
            if (index >= 0) {
                this.children.splice(index, 1);
                child.parent = null;
            }
        }
    };
}

function createEngineHarness() {
    const engine = Object.create(GameEngine.prototype);
    const scene = createScene();
    const playerMesh = { position: new THREE.Vector3(), visible: false, parent: null };
    const environmentGroup = createGroup('environment');
    const entityGroup = createGroup('entities');
    const effectGroup = createGroup('effects');
    const keyLight = { id: 'key-light', parent: null };

    scene.add(environmentGroup);
    scene.add(entityGroup);
    scene.add(effectGroup);
    scene.add(keyLight);
    environmentGroup.add({ id: 'persistent-tree', parent: null });
    entityGroup.add({ id: 'stale-enemy-mesh', parent: null });
    effectGroup.add({ id: 'stale-effect-mesh', parent: null });

    engine.currentInstanceId = null;
    engine.remotePlayers = new Map();
    engine.enemies = [];
    engine.lootDrops = [];
    engine.effects = [];
    engine.hazards = new Map();
    engine.pendingInteraction = null;
    engine.combatIntent = null;
    engine.combatIntentSignature = '';
    engine.combatTargetHighlight = null;
    engine.highlightedCombatTarget = null;
    engine.cameraLocked = true;
    engine.renderSystem = {
        scene,
        environmentGroup,
        entityGroup,
        effectGroup,
        keyLight,
        add: jest.fn(mesh => entityGroup.add(mesh)),
        remove: jest.fn(mesh => mesh?.parent?.remove?.(mesh)),
        clearInstanceScene: jest.fn(() => {
            entityGroup.children.slice().forEach(child => entityGroup.remove(child));
            effectGroup.children.slice().forEach(child => effectGroup.remove(child));
        }),
        setupLights: jest.fn(),
        setCameraTarget: jest.fn(),
        preloadEnvironment: jest.fn().mockResolvedValue()
    };
    engine.chunkManager = {
        removeEntity: jest.fn(),
        updateEntityChunk: jest.fn()
    };
    engine.clearCombatTargetHighlight = GameEngine.prototype.clearCombatTargetHighlight;
    engine.detachCombatTargetHighlight = GameEngine.prototype.detachCombatTargetHighlight;
    engine.clearCombatIntentState = GameEngine.prototype.clearCombatIntentState;
    engine.refreshDungeonEntranceHint = jest.fn();
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
    engine.uiManager = {
        clearCombatIntent: jest.fn(),
        clearDungeonEntranceHint: jest.fn()
    };
    engine.abilityController = {
        pendingAbilityTarget: null,
        pendingAbilitySkill: null
    };
    engine.dungeonEntranceHint = null;

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

    test('enterInstance refreshes onboarding objectives after entering the overworld with no active quests', async () => {
        const engine = createEngineHarness();
        engine.player.quests = [];
        engine.uiManager = {
            updateQuestWindow: jest.fn(),
            updateJournal: jest.fn()
        };

        await engine.enterInstance('instance-2b', 'overworld', null);

        expect(engine.uiManager.updateQuestWindow).toHaveBeenCalledWith([]);
        expect(engine.uiManager.updateJournal).toHaveBeenCalledWith([]);
    });

    test('enterInstance preserves environment scene content and clears only dynamic groups', async () => {
        const engine = createEngineHarness();

        await engine.enterInstance('instance-3', 'overworld', null);

        expect(engine.renderSystem.clearInstanceScene).toHaveBeenCalled();
        expect(engine.renderSystem.environmentGroup.parent).toBe(engine.renderSystem.scene);
        expect(engine.renderSystem.entityGroup.parent).toBe(engine.renderSystem.scene);
        expect(engine.renderSystem.effectGroup.parent).toBe(engine.renderSystem.scene);
        expect(engine.renderSystem.scene.children).toContain(engine.renderSystem.keyLight);
        expect(engine.renderSystem.environmentGroup.children.map(child => child.id)).toContain('persistent-tree');
        expect(engine.renderSystem.entityGroup.children).toHaveLength(1);
        expect(engine.renderSystem.effectGroup.children).toHaveLength(0);
        expect(engine.player.mesh.parent).toBe(engine.renderSystem.entityGroup);
        expect(engine.renderSystem.scene.children).not.toContain(engine.player.mesh);
    });

    test('enterInstance removes remote player meshes through render-system ownership helpers', async () => {
        const engine = createEngineHarness();
        const remoteMesh = { id: 'remote-player-mesh', parent: null };
        const healthBar = { remove: jest.fn() };
        engine.renderSystem.entityGroup.add(remoteMesh);
        engine.remotePlayers.set('remote-1', { mesh: remoteMesh, healthBar });

        await engine.enterInstance('instance-4', 'overworld', null);

        expect(engine.renderSystem.remove).toHaveBeenCalledWith(remoteMesh);
        expect(healthBar.remove).toHaveBeenCalled();
    });

    test('enterInstance preserves scene groups when clearInstanceScene helper is unavailable', async () => {
        const engine = createEngineHarness();
        delete engine.renderSystem.clearInstanceScene;

        await engine.enterInstance('instance-5', 'overworld', null);

        expect(engine.renderSystem.environmentGroup.parent).toBe(engine.renderSystem.scene);
        expect(engine.renderSystem.entityGroup.parent).toBe(engine.renderSystem.scene);
        expect(engine.renderSystem.effectGroup.parent).toBe(engine.renderSystem.scene);
        expect(engine.renderSystem.scene.children).toContain(engine.renderSystem.keyLight);
        expect(engine.renderSystem.environmentGroup.children.map(child => child.id)).toContain('persistent-tree');
        expect(engine.player.mesh.parent).toBe(engine.renderSystem.entityGroup);
    });

    test('enterInstance clears stale transient combat/runtime state before rebuilding the next scene', async () => {
        const engine = createEngineHarness();
        const effect = { isActive: true, dispose: jest.fn() };
        const hazard = { removeFromScene: jest.fn(), dispose: jest.fn() };
        const pendingLoot = { id: 'pending-loot' };
        const targetRing = { parent: engine.renderSystem.effectGroup, visible: true };
        engine.renderSystem.effectGroup.add(targetRing);
        engine.effects = [effect];
        engine.hazards.set('hazard-1', hazard);
        engine.pendingInteraction = pendingLoot;
        engine.combatTargetHighlight = targetRing;
        engine.highlightedCombatTarget = { id: 'enemy-1' };

        await engine.enterInstance('instance-6', 'overworld', null);

        expect(effect.dispose).toHaveBeenCalledTimes(1);
        expect(engine.effects).toEqual([]);
        expect(hazard.removeFromScene).toHaveBeenCalledWith(engine.renderSystem.environmentGroup);
        expect(hazard.dispose).toHaveBeenCalledTimes(1);
        expect(engine.hazards.size).toBe(0);
        expect(engine.pendingInteraction).toBeNull();
        expect(engine.highlightedCombatTarget).toBeNull();
        expect(engine.combatTargetHighlight.visible).toBe(false);
        expect(engine.combatTargetHighlight.parent).toBeNull();
    });

    test('environmental hazards remove and dispose meshes from their current parent during instance teardown', async () => {
        const engine = createEngineHarness();
        const hazard = new EnvironmentalHazard('hazard-2', 'generic', { x: 0, y: 0, z: 0 }, { radius: 2 });
        const otherParent = new THREE.Group();
        const removedMeshes = [];
        otherParent.remove = jest.fn((mesh) => {
            removedMeshes.push(mesh);
            THREE.Group.prototype.remove.call(otherParent, mesh);
        });
        const meshCount = hazard.meshes.length;
        const geometryDisposals = hazard.meshes.map((mesh) => jest.spyOn(mesh.geometry, 'dispose'));
        const materialDisposals = hazard.meshes.map((mesh) => jest.spyOn(mesh.material, 'dispose'));

        hazard.meshes.forEach((mesh) => otherParent.add(mesh));
        engine.hazards.set(hazard.id, hazard);

        await engine.enterInstance('instance-7', 'overworld', null);

        expect(otherParent.remove).toHaveBeenCalledTimes(meshCount);
        expect(removedMeshes).toHaveLength(meshCount);
        geometryDisposals.forEach((disposeSpy) => {
            expect(disposeSpy).toHaveBeenCalledTimes(1);
        });
        materialDisposals.forEach((disposeSpy) => {
            expect(disposeSpy).toHaveBeenCalledTimes(1);
        });
        expect(engine.hazards.size).toBe(0);
    });
});
