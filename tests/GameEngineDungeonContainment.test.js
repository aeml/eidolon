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

test('legacy menu socket follows the active connection after reconnect', () => {
    const engine = Object.create(GameEngine.prototype);
    const departed = { send: jest.fn(), readyState: WebSocket.CLOSED };
    const resumed = { send: jest.fn(), readyState: WebSocket.OPEN };
    engine.network = { socket: departed };
    expect(engine.socket).toBe(departed);
    engine.network.socket = resumed;
    const message = JSON.stringify({ type: 'enter_dungeon', payload: {} });
    engine.socket.send(message);
    expect(resumed.send).toHaveBeenCalledWith(message);
    expect(departed.send).not.toHaveBeenCalled();
    engine.network.socket = null;
    expect(engine.socket).toBeNull();
});

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
    const staticEnvironmentGroup = createGroup('static-environment');
    const instanceEnvironmentGroup = createGroup('instance-environment');
    const entityGroup = createGroup('entities');
    const effectGroup = createGroup('effects');
    const keyLight = { id: 'key-light', parent: null };

    environmentGroup.add(staticEnvironmentGroup);
    environmentGroup.add(instanceEnvironmentGroup);
    scene.add(environmentGroup);
    scene.add(entityGroup);
    scene.add(effectGroup);
    scene.add(keyLight);
    staticEnvironmentGroup.add({ id: 'persistent-tree', parent: null });
    instanceEnvironmentGroup.add({ id: 'stale-dungeon-floor', parent: null });
    entityGroup.add({ id: 'stale-enemy-mesh', parent: null });
    effectGroup.add({ id: 'stale-effect-mesh', parent: null });

    engine.currentInstanceId = null;
    engine.remotePlayers = new Map();
    engine.enemies = [];
    engine.lootDrops = [];
    engine.effects = [];
    engine.hazards = new Map();
    engine.entityCreationQueue = [];
    engine.pendingEntityIds = new Set();
    engine.pendingInteraction = null;
    engine.combatIntent = null;
    engine.combatIntentSignature = '';
    engine.combatTargetHighlight = null;
    engine.highlightedCombatTarget = null;
    engine.lastRenderHudSignature = 'old-hud';
    engine.lastRenderXpSignature = 'old-xp';
    engine.lastRenderHotbarCooldownSignature = 'old-hotbar';
    engine.lastRenderEnemyBarSignature = 'old-enemy-bars';
    engine.lastRenderCharacterSheetSignature = 'old-character-sheet';
    engine.lastRenderWorldMapSignature = 'old-world-map';
    engine.cameraLocked = true;
    engine.renderSystem = {
        scene,
        environmentGroup,
        staticEnvironmentGroup,
        instanceEnvironmentGroup,
        entityGroup,
        effectGroup,
        keyLight,
        add: jest.fn(mesh => entityGroup.add(mesh)),
        remove: jest.fn(mesh => mesh?.parent?.remove?.(mesh)),
        clearInstanceScene: jest.fn(() => {
            instanceEnvironmentGroup.children.slice().forEach(child => instanceEnvironmentGroup.remove(child));
            entityGroup.children.slice().forEach(child => entityGroup.remove(child));
            effectGroup.children.slice().forEach(child => effectGroup.remove(child));
        }),
        setupLights: jest.fn(),
        setEnvironmentContext: jest.fn(),
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
        clearDungeonEntranceHint: jest.fn(),
        resetDisplaySignatures: jest.fn()
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
        expect(worldGeneratorInstances[0].scene).toBe(engine.renderSystem.instanceEnvironmentGroup);
        expect(worldGeneratorInstances[0][generatorMethod]).toHaveBeenCalledWith(0, 0, layout);
        expect(engine.renderSystem.setEnvironmentContext).toHaveBeenCalledWith(instanceType, engine.player.position, true);
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
        expect(worldGeneratorInstances[0].createTown).toHaveBeenCalledWith(0, 200, 100, { shouldAttach: expect.any(Function) });
        expect(worldGeneratorInstances[0].createOverworldStructures).toHaveBeenCalled();
        expect(engine.renderSystem.setEnvironmentContext).toHaveBeenCalledWith('overworld', engine.player.position, true);
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
        expect(engine.renderSystem.staticEnvironmentGroup.parent).toBe(engine.renderSystem.environmentGroup);
        expect(engine.renderSystem.instanceEnvironmentGroup.parent).toBe(engine.renderSystem.environmentGroup);
        expect(engine.renderSystem.entityGroup.parent).toBe(engine.renderSystem.scene);
        expect(engine.renderSystem.effectGroup.parent).toBe(engine.renderSystem.scene);
        expect(engine.renderSystem.scene.children).toContain(engine.renderSystem.keyLight);
        expect(engine.renderSystem.staticEnvironmentGroup.children.map(child => child.id)).toContain('persistent-tree');
        expect(engine.renderSystem.instanceEnvironmentGroup.children.map(child => child.id)).not.toContain('stale-dungeon-floor');
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

    test('removeRemoteEntity detaches fallback meshes from their current parent after reparenting', () => {
        const engine = createEngineHarness();
        const remoteMesh = { id: 'remote-player-mesh', parent: null };
        const otherParent = createGroup('other-parent');
        const healthBar = { remove: jest.fn() };
        const remoteEntity = {
            id: 'remote-2',
            mesh: remoteMesh,
            healthBar,
            position: { x: 12, z: 34 }
        };

        engine.chunkManager = {
            getChunkKey: jest.fn(() => '12,34'),
            chunks: new Map([['12,34', new Set([remoteEntity])]])
        };
        otherParent.add(remoteMesh);
        engine.remotePlayers.set('remote-2', remoteEntity);

        engine.removeRemoteEntity('remote-2');

        expect(otherParent.children).not.toContain(remoteMesh);
        expect(engine.renderSystem.remove).not.toHaveBeenCalledWith(remoteMesh);
        expect(healthBar.remove).toHaveBeenCalledTimes(1);
        expect(engine.chunkManager.chunks.get('12,34').has(remoteEntity)).toBe(false);
        expect(engine.remotePlayers.has('remote-2')).toBe(false);
    });

    test('enterInstance preserves scene groups when clearInstanceScene helper is unavailable', async () => {
        const engine = createEngineHarness();
        delete engine.renderSystem.clearInstanceScene;

        await engine.enterInstance('instance-5', 'overworld', null);

        expect(engine.renderSystem.environmentGroup.parent).toBe(engine.renderSystem.scene);
        expect(engine.renderSystem.staticEnvironmentGroup.parent).toBe(engine.renderSystem.environmentGroup);
        expect(engine.renderSystem.instanceEnvironmentGroup.parent).toBe(engine.renderSystem.environmentGroup);
        expect(engine.renderSystem.entityGroup.parent).toBe(engine.renderSystem.scene);
        expect(engine.renderSystem.effectGroup.parent).toBe(engine.renderSystem.scene);
        expect(engine.renderSystem.scene.children).toContain(engine.renderSystem.keyLight);
        expect(engine.renderSystem.staticEnvironmentGroup.children.map(child => child.id)).toContain('persistent-tree');
        expect(engine.renderSystem.instanceEnvironmentGroup.children.map(child => child.id)).not.toContain('stale-dungeon-floor');
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
        engine.entityCreationQueue.push({ id: 'queued-old-enemy', type: 'Enemy' });
        engine.pendingEntityIds.add('queued-old-enemy');
        engine.pendingInteraction = pendingLoot;
        engine.combatTargetHighlight = targetRing;
        engine.highlightedCombatTarget = { id: 'enemy-1' };

        await engine.enterInstance('instance-6', 'overworld', null);

        expect(effect.dispose).toHaveBeenCalledTimes(1);
        expect(engine.effects).toEqual([]);
        expect(hazard.removeFromScene).toHaveBeenCalledWith(engine.renderSystem.environmentGroup);
        expect(hazard.dispose).toHaveBeenCalledTimes(1);
        expect(engine.hazards.size).toBe(0);
        expect(engine.entityCreationQueue).toEqual([]);
        expect(engine.pendingEntityIds.size).toBe(0);
        expect(engine.pendingInteraction).toBeNull();
        expect(engine.highlightedCombatTarget).toBeNull();
        expect(engine.combatTargetHighlight.visible).toBe(false);
        expect(engine.combatTargetHighlight.parent).toBeNull();
    });

    test('a superseded town load cannot overwrite a newer dungeon scene', async () => {
        const engine = createEngineHarness();
        let finishPreload;
        engine.renderSystem.preloadEnvironment = jest.fn(() => new Promise(resolve => { finishPreload = resolve; }));
        const returning = engine.enterInstance('', 'overworld', null);
        const townGenerator = worldGeneratorInstances.at(-1);
        await engine.enterInstance('new-dungeon', 'verdant_bastion_catacombs', {
            rooms: [{ x: 20000, z: 20000, width: 100 }]
        });
        finishPreload();
        await returning;
        expect(engine.currentInstanceId).toBe('new-dungeon');
        expect(engine.player.position.x).toBe(20000);
        expect(engine.player.position.z).toBe(20000);
        expect(townGenerator.createTown).not.toHaveBeenCalled();
    });

    test('dungeon diagnostics retain the exact replay identity without numeric rounding', () => {
        const engine = createEngineHarness();
        engine.currentInstanceId = 'dungeon_replay';
        engine.currentInstanceType = 'abyssal_well';
        engine.currentDungeonLayout = {
            rooms: [], corridors: [], walkRects: [{ x: 50000, z: 20000, width: 100, height: 100 }],
            generationSeed: '9223372036854775807', generatorVersion: 1, generationAttempt: 2
        };
        expect(engine.getDungeonDebugOverlayData()).toMatchObject({
            instanceId: 'dungeon_replay', dungeonType: 'abyssal_well', generationSeed: '9223372036854775807',
            generatorVersion: 1, generationAttempt: 2, generationFallback: false
        });
    });

    test('town transition cancels predicted and server-driven movement from the old dungeon', async () => {
        const engine = createEngineHarness();
        engine.playerJumpState = { start: new THREE.Vector3(20000, 0, 20000), end: new THREE.Vector3(20010, 0, 20000) };
        engine.playerQueuedJump = true;
        engine.playerCorrectionVisualState = { displayPosition: new THREE.Vector3(20000, 0, 20000) };
        engine.player.isCharging = true;
        engine.abilityController = { pendingAbilityTarget: { id: 'old-boss' }, pendingAbilitySkill: 'Charge', inputBuffer: [{ skill: 'Charge' }] };
        await engine.enterInstance('', 'overworld', null);
        expect(engine.playerJumpState).toBeNull();
        expect(engine.playerQueuedJump).toBe(false);
        expect(engine.playerCorrectionVisualState).toBeNull();
        expect(engine.player.isCharging).toBe(false);
        expect(engine.abilityController.inputBuffer).toEqual([]);
        expect(engine.abilityController.pendingAbilityTarget).toBeNull();
    });

    test('enterInstance resets render and UI display signatures so the first new-scene frame refreshes UI', async () => {
        const engine = createEngineHarness();

        await engine.enterInstance('instance-6b', 'overworld', null);

        expect(engine.lastRenderHudSignature).toBe('');
        expect(engine.lastRenderXpSignature).toBe('');
        expect(engine.lastRenderHotbarCooldownSignature).toBe('');
        expect(engine.lastRenderEnemyBarSignature).toBe('');
        expect(engine.lastRenderCharacterSheetSignature).toBe('');
        expect(engine.lastRenderWorldMapSignature).toBe('');
        expect(engine.uiManager.resetDisplaySignatures).toHaveBeenCalledTimes(1);
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
