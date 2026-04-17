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
const { LootDrop } = await import('../src/entities/LootDrop.js');

function createEngineHarness() {
    const engine = Object.create(GameEngine.prototype);
    engine.frameCount = 0;
    engine.gameTime = 0;
    engine.raycastTimer = 0;
    engine.needsRaycast = false;
    engine.isMobile = false;
    engine.isMultiplayer = true;
    engine.hoveredEntity = null;
    engine.pendingInteraction = null;
    engine.activeEntitiesCache = [];
    engine.entityCreationQueue = [];
    engine.pendingEntityIds = new Set();
    engine.remotePlayers = new Map();
    engine.recentlyPickedUpLoot = new Set();
    engine.playerJumpState = null;
    engine.playerJumpVisualHeight = 0;
    engine.network = {
        messageQueue: [],
        latestServerTime: null,
        drainMessages: jest.fn(() => []),
        send: jest.fn()
    };
    engine.performRaycast = jest.fn();
    engine.updatePlayerJump = jest.fn();
    engine.updateLootVisualFeedback = jest.fn();
    engine.processAutoLoot = jest.fn();
    engine.refreshCombatIntentState = jest.fn();
    engine.refreshDungeonEntranceHint = jest.fn();
    engine.clearCombatIntentState = jest.fn();
    engine.applyPlayerJumpVisuals = jest.fn();
    engine.isPlayerDead = jest.fn(() => false);
    engine.chunkManager = {
        getActiveEntities: jest.fn(() => [engine.player]),
        update: jest.fn(),
        updateEntityChunk: jest.fn()
    };
    engine.renderSystem = {
        scene: { add: jest.fn(), remove: jest.fn(), traverse: jest.fn() },
        render: jest.fn(),
        setCameraTarget: jest.fn(),
        updateEnvironmentLighting: jest.fn(),
        cameraTarget: new THREE.Vector3(0, 0, 0)
    };
    engine.uiManager = {
        isEscMenuOpen: false,
        isPatchNotesOpen: false,
        isShopOpen: false,
        reportScreen: { style: { display: 'none' } },
        showDeathScreen: jest.fn(),
        hideDeathScreen: jest.fn(),
        updatePlayerStats: jest.fn(),
        updateXP: jest.fn(),
        updateHotbarCooldowns: jest.fn(),
        updateEnemyBars: jest.fn(),
        updateInventory: jest.fn()
    };
    engine.minimap = { update: jest.fn() };
    engine.worldMap = { update: jest.fn() };
    engine.abilityController = {
        processInputBuffer: jest.fn(),
        performAbility: jest.fn(),
        pendingAbilityTarget: null,
        pendingAbilitySkill: null,
        updatePendingTarget: jest.fn(),
        performAttack: jest.fn()
    };
    engine.inputManager = {
        isMouseDown: true,
        isRightMouseDown: false,
        keys: { control: true, alt: false },
        getGroundIntersection: jest.fn(() => new THREE.Vector3(12, 0, 8)),
        clearInputState: jest.fn(),
        getMovementDirection: jest.fn(() => new THREE.Vector3(0, 0, 0))
    };
    engine.collisionManager = {
        checkCollision: jest.fn(() => null),
        constrainToDungeonWalkableArea: jest.fn(() => false)
    };
    engine.floatingTextManager = { update: jest.fn() };
    engine.effects = [];
    engine.hazards = new Map();
    engine.lastPickupTime = 0;
    engine.player = {
        id: 'player-1',
        position: new THREE.Vector3(0, 0, 0),
        rotation: new THREE.Quaternion(),
        state: 'IDLE',
        targetPosition: null,
        radius: 1.25,
        lastAttackTime: 0,
        stats: { attackSpeed: 1, hp: 100, maxHp: 100, mana: 100, maxMana: 100, speed: 5, damage: 10 },
        mesh: {
            lookAt: jest.fn(),
            quaternion: new THREE.Quaternion(),
            position: new THREE.Vector3(0, 0, 0)
        },
        playAnimation: jest.fn(),
        getAttackHitDelay: jest.fn(() => 0),
        render: jest.fn(),
        move: jest.fn()
    };
    return engine;
}

describe('GameEngine ctrl-click hold regression', () => {
    test('multiplayer ctrl-click request clears held mouse state so update loop does not immediately force an attack animation', () => {
        const engine = createEngineHarness();

        const handled = engine.handlePrimaryClick({ ctrlKey: true });
        engine.update(1 / 60);

        expect(handled).toBe(true);
        expect(engine.network.send).toHaveBeenCalledWith('jump', { x: 12, y: 0, z: 8 });
        expect(engine.inputManager.isMouseDown).toBe(false);
        expect(engine.player.playAnimation).not.toHaveBeenCalledWith('Attack', false);
        expect(engine.player.state).not.toBe('ATTACKING');
    });

    test('spamming ctrl-click while airborne still clears held mouse state instead of leaking into attack logic', () => {
        const engine = createEngineHarness();

        engine.handlePrimaryClick({ ctrlKey: true });
        expect(engine.playerJumpState).not.toBeNull();

        engine.inputManager.isMouseDown = true;
        engine.handlePrimaryClick({ ctrlKey: true });
        engine.update(1 / 60);

        expect(engine.playerQueuedJump).toBe(true);
        expect(engine.inputManager.isMouseDown).toBe(false);
        expect(engine.player.playAnimation).not.toHaveBeenCalledWith('Attack', false);
        expect(engine.player.state).not.toBe('ATTACKING');
    });

    test('ctrl-hold during a jump does not early-return the whole update loop on attack cooldown', () => {
        const engine = createEngineHarness();
        engine.cameraLocked = true;
        engine.playerJumpState = {
            start: new THREE.Vector3(0, 0, 0),
            end: new THREE.Vector3(12, 0, 8),
            elapsed: 0.2,
            duration: 0.8,
            height: 8,
            serverDriven: false
        };
        engine.inputManager.isMouseDown = true;
        engine.inputManager.keys.control = true;
        engine.player.lastAttackTime = Date.now();

        engine.update(1 / 60);

        expect(engine.chunkManager.update).toHaveBeenCalled();
        expect(engine.renderSystem.setCameraTarget).toHaveBeenCalled();
        expect(engine.player.state).not.toBe('ATTACKING');
    });

    test('camera follows smoothed jump display position during authoritative jumps instead of snapped logical position', () => {
        const engine = createEngineHarness();
        engine.cameraLocked = true;
        engine.player.position.set(12, 0, 8);
        engine.playerJumpState = {
            start: new THREE.Vector3(0, 0, 0),
            end: new THREE.Vector3(20, 0, 12),
            elapsed: 0.25,
            duration: 0.8,
            height: 8,
            serverDriven: true,
            visualHeight: 4,
            displayPosition: new THREE.Vector3(6, 0, 4)
        };
        engine.inputManager.isMouseDown = false;
        engine.updatePlayerJump = jest.fn(() => true);

        engine.update(1 / 60);

        expect(engine.renderSystem.setCameraTarget).toHaveBeenCalledWith(engine.playerJumpState.displayPosition);
        expect(engine.renderSystem.setCameraTarget).not.toHaveBeenCalledWith(engine.player.position);
    });

    test('midair held mouse input does not trigger attack or ability loops', () => {
        const engine = createEngineHarness();
        engine.playerJumpState = {
            start: new THREE.Vector3(0, 0, 0),
            end: new THREE.Vector3(12, 0, 8),
            elapsed: 0.25,
            duration: 0.8,
            height: 8,
            serverDriven: false
        };
        engine.inputManager.isMouseDown = true;
        engine.inputManager.isRightMouseDown = true;

        engine.update(1 / 60);

        expect(engine.abilityController.performAbility).not.toHaveBeenCalled();
        expect(engine.abilityController.performAttack).not.toHaveBeenCalled();
        expect(engine.player.playAnimation).not.toHaveBeenCalledWith('Attack', false);
    });

    test('local loot pickup fallback removes a reparented pendingInteraction mesh from its current parent', () => {
        const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(1000);
        const engine = createEngineHarness();
        const pendingMesh = { children: [], parent: null };
        const otherParent = {
            children: [],
            add(mesh) {
                if (!this.children.includes(mesh)) {
                    this.children.push(mesh);
                }
                mesh.parent = this;
            },
            remove: jest.fn(function (mesh) {
                this.children = this.children.filter(child => child !== mesh);
                if (mesh.parent === this) {
                    mesh.parent = null;
                }
            })
        };
        const pendingInteraction = Object.create(LootDrop.prototype);
        pendingInteraction.id = 'loot-local-1';
        pendingInteraction.isActive = true;
        pendingInteraction.position = new THREE.Vector3(0, 0.5, 0);
        pendingInteraction.item = { name: 'Radiant Ruby' };
        pendingInteraction.mesh = pendingMesh;
        pendingInteraction.dispose = undefined;

        otherParent.add(pendingMesh);
        engine.pendingInteraction = pendingInteraction;
        engine.isMultiplayer = false;
        engine.chunkManager = {
            getActiveEntities: jest.fn(() => [engine.player]),
            update: jest.fn(),
            updateEntityChunk: jest.fn(),
            getChunkKey: jest.fn(() => '0:0'),
            chunks: new Map([['0:0', new Set([pendingInteraction])]])
        };
        engine.player.targetPosition = new THREE.Vector3(0, 0, 0);
        engine.player.state = 'MOVING';
        engine.player.addToInventory = jest.fn(() => true);
        engine.player.getAttackHitDelay = jest.fn(() => Infinity);
        engine.inputManager.isMouseDown = false;
        engine.inputManager.keys.control = false;
        engine.inputManager.keys.meta = false;
        engine.getInteractionRangeForEntity = jest.fn(() => 5);

        engine.update(1 / 60);

        // Sanity: pickup path should have run and cleared the interaction.
        expect(engine.player.addToInventory).toHaveBeenCalledWith(pendingInteraction.item);
        expect(otherParent.remove).toHaveBeenCalledWith(pendingMesh);
        expect(otherParent.children).toHaveLength(0);
        expect(engine.renderSystem.scene.remove).not.toHaveBeenCalledWith(pendingMesh);
        expect(engine.pendingInteraction).toBeNull();
        expect(engine.chunkManager.chunks.get('0:0').has(pendingInteraction)).toBe(false);
        dateNowSpy.mockRestore();
    });

    test('meta-hold uses the same modifier-held branch as ctrl-hold instead of falling back to click-to-move', () => {
        const engine = createEngineHarness();
        engine.cameraLocked = true;
        engine.playerJumpState = null;
        engine.inputManager.isMouseDown = true;
        engine.inputManager.keys.control = false;
        engine.inputManager.keys.meta = true;
        engine.player.lastAttackTime = Date.now();

        engine.update(1 / 60);

        expect(engine.chunkManager.update).toHaveBeenCalled();
        expect(engine.renderSystem.setCameraTarget).toHaveBeenCalled();
        expect(engine.player.move).not.toHaveBeenCalled();
        expect(engine.player.playAnimation).not.toHaveBeenCalledWith('Attack', false);
        expect(engine.player.state).not.toBe('ATTACKING');
    });
});
