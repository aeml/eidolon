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

function createEngineHarness() {
    const engine = Object.create(GameEngine.prototype);
    engine.isMobile = false;
    engine.isMultiplayer = true;
    engine.hoveredEntity = null;
    engine.pendingInteraction = { id: 'pending-loot' };
    engine.activeEntitiesCache = [];
    engine.remotePlayers = new Map();
    engine.playerJumpState = null;
    engine.playerJumpVisualHeight = 0;
    engine.entityCreationQueue = [];
    engine.pendingEntityIds = new Set();
    engine.recentlyPickedUpLoot = new Set();
    engine.effects = [];
    engine.hazards = new Map();
    engine.raycastTimer = 0;
    engine.needsRaycast = false;
    engine.gameTime = 0;
    engine.frameCount = 0;
    engine.performRaycast = jest.fn();
    engine.clearCombatIntentState = jest.fn();
    engine.refreshCombatIntentState = jest.fn();
    engine.refreshDungeonEntranceHint = jest.fn();
    engine.spawnTransientEffect = jest.fn(() => true);
    engine.chunkManager = {
        updateEntityChunk: jest.fn(),
        update: jest.fn(),
        getActiveEntities: jest.fn(() => [engine.player])
    };
    engine.renderSystem = {
        camera: {},
        scene: { add: jest.fn(), remove: jest.fn(), traverse: jest.fn() },
        setCameraTarget: jest.fn(),
        updateEnvironmentLighting: jest.fn(),
        render: jest.fn()
    };
    engine.uiManager = {
        isEscMenuOpen: false,
        isPatchNotesOpen: false,
        isShopOpen: false,
        reportScreen: { style: { display: 'none' } },
        skillTree: { isOpen: false },
        showDeathScreen: jest.fn(),
        hideDeathScreen: jest.fn(),
        updatePlayerStats: jest.fn(),
        updateXP: jest.fn(),
        updateHotbarCooldowns: jest.fn(),
        updateEnemyBars: jest.fn(),
        updateSkillTreeResources: jest.fn(),
        refreshSkillTreeTalents: jest.fn(),
        updateCharacterSheet: jest.fn()
    };
    engine.minimap = { update: jest.fn() };
    engine.worldMap = { update: jest.fn() };
    engine.floatingTextManager = { update: jest.fn() };
    engine.network = {
        send: jest.fn(),
        drainMessages: jest.fn(() => []),
        messageQueue: [],
        latestServerTime: null
    };
    engine.abilityController = {
        pendingAbilityTarget: { id: 'ability-target' },
        pendingAbilitySkill: 'Fireball',
        processInputBuffer: jest.fn(),
        updatePendingTarget: jest.fn(),
        performAbility: jest.fn(),
        performAttack: jest.fn()
    };
    engine.inputManager = {
        keys: { control: false, alt: false },
        isMouseDown: false,
        getGroundIntersection: jest.fn(() => new THREE.Vector3(12, 0, 8))
    };
    engine.collisionManager = {
        constrainToDungeonWalkableArea: jest.fn(() => false),
        checkCollision: jest.fn(() => null)
    };
    engine.player = {
        id: 'player-1',
        position: new THREE.Vector3(0, 0, 0),
        rotation: new THREE.Quaternion(),
        radius: 1.25,
        state: 'MOVING',
        targetPosition: new THREE.Vector3(2, 0, 2),
        move: jest.fn(),
        playAnimation: jest.fn(),
        playJumpAnimation: jest.fn(),
        clearJumpAnimation: jest.fn(),
        restoreAnimationForState: jest.fn(),
        mesh: {
            position: new THREE.Vector3(0, 0, 0),
            lookAt: jest.fn(),
            quaternion: new THREE.Quaternion(),
            scale: new THREE.Vector3(1, 1, 1),
            userData: {},
            visible: true
        },
        render: jest.fn(function render() {
            this.mesh.position.copy(this.position);
        }),
        stats: {
            hp: 100,
            maxHp: 100,
            mana: 100,
            maxMana: 100
        }
    };
    engine.chunkManager.getActiveEntities.mockImplementation(() => [engine.player]);
    return engine;
}

describe('authoritative jump flow', () => {
    test('ctrl-left-click sends a jump request from the click coordinates and seeds a local predicted jump immediately', () => {
        const engine = createEngineHarness();
        engine.inputManager.getGroundIntersectionFromEvent = jest.fn(() => new THREE.Vector3(33, 0, -4));

        const handled = engine.handlePrimaryClick({ ctrlKey: true, clientX: 640, clientY: 120 });

        expect(handled).toBe(true);
        expect(engine.performRaycast).toHaveBeenCalledTimes(1);
        expect(engine.inputManager.getGroundIntersectionFromEvent).toHaveBeenCalledWith(expect.objectContaining({
            ctrlKey: true,
            clientX: 640,
            clientY: 120
        }));
        expect(engine.network.send).toHaveBeenCalledWith('jump', {
            x: 33,
            y: 0,
            z: -4
        });
        expect(engine.player.move).not.toHaveBeenCalled();
        expect(engine.playerJumpState).toEqual(expect.objectContaining({
            start: expect.any(THREE.Vector3),
            end: expect.any(THREE.Vector3),
            duration: expect.any(Number)
        }));
        expect(engine.playerJumpState.end.x).toBe(33);
        expect(engine.playerJumpState.end.z).toBe(-4);
        expect(engine.player.state).toBe('JUMPING');
        expect(engine.player.playJumpAnimation).toHaveBeenCalledWith(expect.objectContaining({
            duration: expect.any(Number),
            serverDriven: false
        }));
        expect(engine.pendingInteraction).toBeNull();
        expect(engine.abilityController.pendingAbilityTarget).toBeNull();
        expect(engine.abilityController.pendingAbilitySkill).toBeNull();
        expect(engine.player.targetPosition).toBeNull();
        expect(engine.inputManager.isMouseDown).toBe(false);
    });

    test('self delta jump state seeds authoritative jump visuals from server state without double-applying server airborne height', () => {
        const engine = createEngineHarness();
        engine.player.state = 'IDLE';
        engine.player.position.set(0, 0, 0);
        engine.player.targetPosition = new THREE.Vector3(9, 0, 9);

        engine.handleServerMessage({
            type: 'delta',
            payload: {
                u: {
                    'player-1': {
                        id: 'player-1',
                        state: 'JUMPING',
                        health: 100,
                        maxHealth: 100,
                        mana: 100,
                        maxMana: 100,
                        x: 4.5,
                        y: 4.242640687,
                        z: 0,
                        jumpStartX: 0,
                        jumpStartY: 0,
                        jumpStartZ: 0,
                        jumpTargetX: 18,
                        jumpTargetY: 0,
                        jumpTargetZ: 0,
                        jumpProgress: 0.25,
                        jumpHeight: 6
                    }
                },
                r: []
            }
        });

        expect(engine.player.targetPosition).toBeNull();
        expect(engine.playerJumpState).toEqual(expect.objectContaining({
            start: expect.any(THREE.Vector3),
            end: expect.any(THREE.Vector3),
            height: 6,
            serverDriven: true
        }));
        expect(engine.player.playJumpAnimation).toHaveBeenCalledWith(expect.objectContaining({
            height: 6,
            serverDriven: true
        }));
        expect(engine.playerJumpState.end.x).toBe(18);
        expect(engine.playerJumpState.elapsed).toBeCloseTo(engine.playerJumpState.duration * 0.25, 5);
        expect(engine.player.state).toBe('JUMPING');

        engine.updatePlayerJump(1 / 60);
        engine.applyPlayerJumpVisuals();

        expect(engine.player.position.y).toBe(0);
        expect(engine.player.mesh.position.y).toBeGreaterThanOrEqual(4.242640687);
        expect(engine.player.mesh.position.y).toBeLessThan(5);
    });
    test('predicted jump arc is preserved while awaiting server updates that only include jumping state and position', () => {
        const engine = createEngineHarness();
        engine.inputManager.getGroundIntersectionFromEvent = jest.fn(() => new THREE.Vector3(20, 0, 6));

        engine.handlePrimaryClick({ ctrlKey: true, clientX: 500, clientY: 220 });
        const seededJump = {
            end: engine.playerJumpState.end.clone(),
            duration: engine.playerJumpState.duration,
            height: engine.playerJumpState.height
        };

        engine.handleServerMessage({
            type: 'delta',
            payload: {
                u: {
                    'player-1': {
                        id: 'player-1',
                        state: 'JUMPING',
                        health: 100,
                        maxHealth: 100,
                        mana: 100,
                        maxMana: 100,
                        x: 4,
                        y: 1,
                        z: 2,
                        jumpProgress: 0.2
                    }
                },
                r: []
            }
        });

        expect(engine.playerJumpState).toEqual(expect.objectContaining({
            end: seededJump.end,
            duration: seededJump.duration,
            height: seededJump.height,
            serverDriven: true
        }));
        expect(engine.playerJumpState.height).toBeGreaterThan(0);
        expect(engine.playerJumpVisualHeight).toBeGreaterThan(0);
    });

    test('authoritative jump updates without explicit jump metadata still preserve the seeded arc progress and height', () => {
        const engine = createEngineHarness();
        engine.inputManager.getGroundIntersectionFromEvent = jest.fn(() => new THREE.Vector3(20, 0, 0));

        engine.handlePrimaryClick({ ctrlKey: true, clientX: 500, clientY: 220 });
        const seededHeight = engine.playerJumpState.height;
        const seededDuration = engine.playerJumpState.duration;

        engine.playerJumpState.elapsed = seededDuration / 2;

        engine.syncAuthoritativeJumpState(engine.player, {
            id: 'player-1',
            state: 'JUMPING',
            x: 10,
            y: 0,
            z: 0
        });

        expect(engine.playerJumpState.serverDriven).toBe(true);
        expect(engine.playerJumpState.height).toBeCloseTo(seededHeight, 5);
        expect(engine.getJumpVisualProgress(engine.playerJumpState)).toBeCloseTo(0.5, 2);

        engine.updatePlayerJump(1 / 60);
        engine.applyPlayerJumpVisuals();

        expect(engine.player.mesh.position.y).toBeGreaterThan(seededHeight * 0.9);
        expect(engine.player.mesh.quaternion.angleTo(engine.player.rotation)).toBeGreaterThan(2.5);
    });

    test('authoritative jump without explicit metadata keeps advancing progress from replicated travel instead of freezing into hover-glide', () => {
        const engine = createEngineHarness();
        engine.inputManager.getGroundIntersectionFromEvent = jest.fn(() => new THREE.Vector3(20, 0, 0));

        engine.handlePrimaryClick({ ctrlKey: true, clientX: 500, clientY: 220 });

        engine.syncAuthoritativeJumpState(engine.player, {
            id: 'player-1',
            state: 'JUMPING',
            x: 4,
            y: 2.5,
            z: 0
        });
        expect(engine.getJumpVisualProgress(engine.playerJumpState)).toBeCloseTo(0.2, 2);

        engine.syncAuthoritativeJumpState(engine.player, {
            id: 'player-1',
            state: 'JUMPING',
            x: 12,
            y: 5.5,
            z: 0
        });

        expect(engine.getJumpVisualProgress(engine.playerJumpState)).toBeCloseTo(0.6, 2);
        expect(engine.playerJumpState.visualHeight).toBeGreaterThan(5);

        engine.updatePlayerJump(1 / 60);
        engine.applyPlayerJumpVisuals();

        expect(engine.player.mesh.position.y).toBeGreaterThan(5);
        expect(engine.player.mesh.quaternion.angleTo(engine.player.rotation)).toBeGreaterThan(2.3);
    });

    test('self authoritative jump visually interpolates toward new server jump packets instead of snapping mesh horizontally', () => {
        const engine = createEngineHarness();
        engine.inputManager.getGroundIntersectionFromEvent = jest.fn(() => new THREE.Vector3(20, 0, 0));

        engine.handlePrimaryClick({ ctrlKey: true, clientX: 500, clientY: 220 });

        engine.syncAuthoritativeJumpState(engine.player, {
            id: 'player-1',
            state: 'JUMPING',
            x: 4,
            y: 2.5,
            z: 0
        });
        engine.updatePlayerJump(1 / 60);
        engine.applyPlayerJumpVisuals();
        const previousVisualX = engine.player.mesh.position.x;

        engine.syncAuthoritativeJumpState(engine.player, {
            id: 'player-1',
            state: 'JUMPING',
            x: 12,
            y: 5.5,
            z: 0
        });
        const snappedLogicalX = engine.player.position.x;

        engine.updatePlayerJump(1 / 60);
        engine.applyPlayerJumpVisuals();

        expect(snappedLogicalX).toBe(12);
        expect(engine.player.mesh.position.x).toBeGreaterThan(previousVisualX);
        expect(engine.player.mesh.position.x).toBeLessThan(snappedLogicalX);
    });

    test('self authoritative jump interpolation does not jitter backward on tiny correction packets', () => {
        const engine = createEngineHarness();
        engine.inputManager.getGroundIntersectionFromEvent = jest.fn(() => new THREE.Vector3(20, 0, 0));

        engine.handlePrimaryClick({ ctrlKey: true, clientX: 500, clientY: 220 });

        engine.syncAuthoritativeJumpState(engine.player, {
            id: 'player-1',
            state: 'JUMPING',
            x: 4,
            y: 2.5,
            z: 0
        });
        engine.applyPlayerJumpVisuals();

        engine.syncAuthoritativeJumpState(engine.player, {
            id: 'player-1',
            state: 'JUMPING',
            x: 12,
            y: 5.5,
            z: 0
        });
        for (let i = 0; i < 20; i += 1) {
            engine.applyPlayerJumpVisuals();
        }
        const forwardVisualX = engine.player.mesh.position.x;

        engine.syncAuthoritativeJumpState(engine.player, {
            id: 'player-1',
            state: 'JUMPING',
            x: 11.95,
            y: 5.45,
            z: 0
        });
        engine.applyPlayerJumpVisuals();

        expect(engine.player.position.x).toBeCloseTo(11.95, 5);
        expect(engine.player.mesh.position.x).toBeGreaterThanOrEqual(forwardVisualX);
    });

    test('server-driven player jumps advance smoothed display position during update before render', () => {
        const engine = createEngineHarness();
        engine.player.position.set(12, 0, 8);
        engine.playerJumpState = {
            start: new THREE.Vector3(0, 0, 0),
            end: new THREE.Vector3(20, 0, 12),
            progress: 0.6,
            elapsed: 0.6,
            duration: 0.8,
            height: 8,
            serverDriven: true,
            visualHeight: 4,
            displayPosition: new THREE.Vector3(6, 0, 4)
        };

        engine.updatePlayerJump(1 / 60);

        expect(engine.playerJumpState.displayPosition.x).toBeGreaterThan(6);
        expect(engine.playerJumpState.displayPosition.x).toBeLessThan(12);
        expect(engine.renderSystem.setCameraTarget).toHaveBeenCalledWith(engine.playerJumpState.displayPosition);
    });

    test('player jump render path does not apply a second interpolation pass after update smoothing', () => {
        const engine = createEngineHarness();
        engine.player.position.set(12, 0, 8);
        engine.playerJumpState = {
            start: new THREE.Vector3(0, 0, 0),
            end: new THREE.Vector3(20, 0, 12),
            progress: 0.6,
            elapsed: 0.6,
            duration: 0.8,
            height: 8,
            serverDriven: true,
            visualHeight: 4,
            displayPosition: new THREE.Vector3(6, 0, 4)
        };

        engine.updatePlayerJump(1 / 60);
        const displayXAfterUpdate = engine.playerJumpState.displayPosition.x;

        engine.applyPlayerJumpVisuals();

        expect(engine.playerJumpState.displayPosition.x).toBeCloseTo(displayXAfterUpdate, 5);
    });

    test('local correction visuals smooth mesh and camera after a large self correction while logical position stays authoritative', () => {
        const engine = createEngineHarness();
        engine.cameraLocked = true;
        engine.player.position.set(80, 0, 240);
        engine.playerCorrectionVisualState = {
            from: new THREE.Vector3(0, 0, 0),
            to: new THREE.Vector3(80, 0, 240),
            displayPosition: new THREE.Vector3(0, 0, 0),
            elapsed: 0,
            duration: 0.18
        };

        engine.update(1 / 60);
        engine.player.render();
        engine.applyPlayerJumpVisuals();
        engine.applyPlayerCorrectionVisuals();

        expect(engine.player.position.x).toBe(80);
        expect(engine.player.mesh.position.x).toBeGreaterThan(0);
        expect(engine.player.mesh.position.x).toBeLessThan(80);
        expect(engine.renderSystem.setCameraTarget).toHaveBeenCalledWith(engine.playerCorrectionVisualState.displayPosition);
    });

    test('local correction visuals expire and return camera follow to the authoritative player position', () => {
        const engine = createEngineHarness();
        engine.cameraLocked = true;
        engine.player.position.set(80, 0, 240);
        engine.playerCorrectionVisualState = {
            from: new THREE.Vector3(0, 0, 0),
            to: new THREE.Vector3(80, 0, 240),
            displayPosition: new THREE.Vector3(0, 0, 0),
            elapsed: 0.17,
            duration: 0.18
        };

        engine.update(1 / 60);

        expect(engine.playerCorrectionVisualState).toBeNull();
        expect(engine.renderSystem.setCameraTarget).toHaveBeenCalledWith(engine.player.position);
    });

    test('jump visuals keep priority over local correction smoothing', () => {
        const engine = createEngineHarness();
        engine.cameraLocked = true;
        engine.player.position.set(12, 0, 8);
        engine.playerCorrectionVisualState = {
            from: new THREE.Vector3(0, 0, 0),
            to: new THREE.Vector3(80, 0, 240),
            displayPosition: new THREE.Vector3(20, 0, 60),
            elapsed: 0,
            duration: 0.18
        };
        engine.playerJumpState = {
            start: new THREE.Vector3(0, 0, 0),
            end: new THREE.Vector3(20, 0, 12),
            progress: 0.6,
            elapsed: 0.6,
            duration: 0.8,
            height: 8,
            serverDriven: true,
            visualHeight: 4,
            displayPosition: new THREE.Vector3(6, 0, 4)
        };

        engine.update(1 / 60);

        expect(engine.renderSystem.setCameraTarget).toHaveBeenCalledWith(engine.playerJumpState.displayPosition);
    });

    test('predicted local jump is not cleared by self deltas that omit state', () => {
        const engine = createEngineHarness();
        engine.inputManager.getGroundIntersectionFromEvent = jest.fn(() => new THREE.Vector3(20, 0, 6));

        engine.handlePrimaryClick({ ctrlKey: true, clientX: 500, clientY: 220 });
        const seededEnd = engine.playerJumpState.end.clone();
        const seededDuration = engine.playerJumpState.duration;

        engine.handleServerMessage({
            type: 'delta',
            payload: {
                u: {
                    'player-1': {
                        id: 'player-1',
                        health: 100,
                        maxHealth: 100,
                        mana: 100,
                        maxMana: 100,
                        x: 2,
                        z: 1
                    }
                },
                r: []
            }
        });

        expect(engine.playerJumpState).toEqual(expect.objectContaining({
            end: seededEnd,
            duration: seededDuration,
            serverDriven: false
        }));
        expect(engine.player.state).toBe('JUMPING');
    });

    test('predicted local jump is not stomped by stale self moving state before authoritative jump arrives', () => {
        const engine = createEngineHarness();
        engine.inputManager.getGroundIntersectionFromEvent = jest.fn(() => new THREE.Vector3(20, 0, 6));

        engine.handlePrimaryClick({ ctrlKey: true, clientX: 500, clientY: 220 });

        engine.handleServerMessage({
            type: 'delta',
            payload: {
                u: {
                    'player-1': {
                        id: 'player-1',
                        state: 'MOVING',
                        health: 100,
                        maxHealth: 100,
                        mana: 100,
                        maxMana: 100,
                        x: 2,
                        z: 1
                    }
                },
                r: []
            }
        });

        expect(engine.playerJumpState).not.toBeNull();
        expect(engine.playerJumpState.serverDriven).toBe(false);
        expect(engine.player.state).toBe('JUMPING');
    });

    test('predicted local jump is not stomped by stale self moving state from full snapshots before authoritative jump arrives', () => {
        const engine = createEngineHarness();
        engine.inputManager.getGroundIntersectionFromEvent = jest.fn(() => new THREE.Vector3(20, 0, 6));

        engine.handlePrimaryClick({ ctrlKey: true, clientX: 500, clientY: 220 });

        engine.handleServerMessage({
            type: 'state',
            payload: [{
                id: 'player-1',
                state: 'MOVING',
                health: 100,
                maxHealth: 100,
                mana: 100,
                maxMana: 100,
                x: 2,
                z: 1,
                level: 1,
                experience: 0,
                maxExperience: 100
            }]
        });

        expect(engine.playerJumpState).not.toBeNull();
        expect(engine.playerJumpState.serverDriven).toBe(false);
        expect(engine.player.state).toBe('JUMPING');
    });

    test('server-driven jump visuals preserve descent-side flip progress instead of folding back after apex', () => {
        const engine = createEngineHarness();
        engine.player.state = 'IDLE';
        engine.player.position.set(16, 5, 0);

        engine.syncAuthoritativeJumpState(engine.player, {
            id: 'player-1',
            state: 'JUMPING',
            x: 16,
            y: 5,
            z: 0,
            jumpStartX: 0,
            jumpStartY: 0,
            jumpStartZ: 0,
            jumpTargetX: 20,
            jumpTargetY: 0,
            jumpTargetZ: 0,
            jumpProgress: 0.8,
            jumpHeight: 8,
            jumpDuration: 1
        });

        expect(engine.getJumpVisualProgress(engine.playerJumpState)).toBeCloseTo(0.8, 5);

        engine.updatePlayerJump(1 / 60);
        engine.applyPlayerJumpVisuals();

        expect(engine.player.mesh.quaternion.angleTo(engine.player.rotation)).toBeGreaterThan(1.2);
    });

    test('clearing a server-driven jump snaps the player back to the landing height instead of leaving them airborne', () => {
        const engine = createEngineHarness();
        engine.player.state = 'JUMPING';
        engine.player.position.set(18, 4.5, 6);

        engine.syncAuthoritativeJumpState(engine.player, {
            id: 'player-1',
            state: 'JUMPING',
            x: 18,
            y: 4.5,
            z: 6,
            jumpStartX: 0,
            jumpStartY: 0,
            jumpStartZ: 0,
            jumpTargetX: 18,
            jumpTargetY: 0,
            jumpTargetZ: 6,
            jumpProgress: 0.92,
            jumpHeight: 8,
            jumpDuration: 1
        });

        engine.clearAuthoritativeJumpState(engine.player);
        engine.applyPlayerJumpVisuals();

        expect(engine.playerJumpState).toBeNull();
        expect(engine.player.clearJumpAnimation).toHaveBeenCalledTimes(1);
        expect(engine.player.restoreAnimationForState).toHaveBeenCalledWith(true);
        expect(engine.player.position.y).toBe(0);
        expect(engine.player.mesh.position.y).toBe(0);
    });

    test('holding ctrl-click queues the next jump until landing and uses the current mouse position at takeoff time', () => {
        const engine = createEngineHarness();
        engine.isMultiplayer = false;
        engine.inputManager.keys.control = true;
        engine.inputManager.primaryMouseButtonDown = true;
        engine.inputManager.getGroundIntersectionFromEvent = jest.fn(() => new THREE.Vector3(10, 0, 0));
        engine.inputManager.getGroundIntersection = jest.fn(() => new THREE.Vector3(18, 0, 4));

        engine.handlePrimaryClick({ ctrlKey: true, clientX: 100, clientY: 100 });
        const firstDuration = engine.playerJumpState.duration;

        engine.updatePlayerJump(firstDuration / 2);
        expect(engine.playerJumpState.end).toEqual(expect.objectContaining({ x: 10, z: 0 }));
        expect(engine.playerQueuedJump).toBe(true);

        engine.inputManager.getGroundIntersection.mockReturnValue(new THREE.Vector3(24, 0, 12));
        engine.updatePlayerJump(firstDuration / 2);
        expect(engine.playerJumpState).toEqual(expect.objectContaining({
            start: expect.any(THREE.Vector3),
            end: expect.objectContaining({ x: 24, z: 12 })
        }));
        expect(engine.playerQueuedJump).toBe(false);
    });

    test('authoritative landing consumes a queued ctrl-held jump using the latest ground target', () => {
        const engine = createEngineHarness();
        engine.inputManager.keys.control = true;
        engine.inputManager.primaryMouseButtonDown = true;
        engine.inputManager.getGroundIntersection = jest.fn(() => new THREE.Vector3(26, 0, -6));
        engine.player.position.set(18, 4.5, 6);
        engine.playerQueuedJump = true;

        engine.playerJumpState = {
            start: new THREE.Vector3(0, 0, 0),
            end: new THREE.Vector3(18, 0, 6),
            progress: 0.92,
            elapsed: 0.92,
            duration: 1,
            height: 8,
            serverDriven: true,
            visualHeight: 3.5,
            displayPosition: new THREE.Vector3(16, 0, 5)
        };

        engine.clearAuthoritativeJumpState(engine.player);

        expect(engine.playerJumpState).toEqual(expect.objectContaining({
            start: expect.any(THREE.Vector3),
            end: expect.objectContaining({ x: 26, z: -6 }),
            serverDriven: false
        }));
        expect(engine.playerQueuedJump).toBe(false);
        expect(engine.player.state).toBe('JUMPING');
    });

    test('holding meta-click queues the next jump until landing and uses the current mouse position at takeoff time', () => {
        const engine = createEngineHarness();
        engine.isMultiplayer = false;
        engine.inputManager.keys.meta = true;
        engine.inputManager.primaryMouseButtonDown = true;
        engine.inputManager.getGroundIntersectionFromEvent = jest.fn(() => new THREE.Vector3(10, 0, 0));
        engine.inputManager.getGroundIntersection = jest.fn(() => new THREE.Vector3(24, 0, 12));

        engine.handlePrimaryClick({ metaKey: true, clientX: 100, clientY: 100 });
        const firstDuration = engine.playerJumpState.duration;

        engine.updatePlayerJump(firstDuration / 2);
        expect(engine.playerQueuedJump).toBe(true);

        engine.updatePlayerJump(firstDuration / 2);
        expect(engine.playerJumpState).toEqual(expect.objectContaining({
            start: expect.any(THREE.Vector3),
            end: expect.objectContaining({ x: 24, z: 12 })
        }));
        expect(engine.playerQueuedJump).toBe(false);
        expect(engine.player.state).toBe('JUMPING');
    });

    test('authoritative landing consumes a queued meta-held jump using the latest ground target', () => {
        const engine = createEngineHarness();
        engine.inputManager.keys.meta = true;
        engine.inputManager.primaryMouseButtonDown = true;
        engine.inputManager.getGroundIntersection = jest.fn(() => new THREE.Vector3(26, 0, -6));
        engine.player.position.set(18, 4.5, 6);
        engine.playerQueuedJump = true;

        engine.playerJumpState = {
            start: new THREE.Vector3(0, 0, 0),
            end: new THREE.Vector3(18, 0, 6),
            progress: 0.92,
            elapsed: 0.92,
            duration: 1,
            height: 8,
            serverDriven: true,
            visualHeight: 3.5,
            displayPosition: new THREE.Vector3(16, 0, 5)
        };

        engine.clearAuthoritativeJumpState(engine.player);

        expect(engine.playerJumpState).toEqual(expect.objectContaining({
            start: expect.any(THREE.Vector3),
            end: expect.objectContaining({ x: 26, z: -6 }),
            serverDriven: false
        }));
        expect(engine.playerQueuedJump).toBe(false);
        expect(engine.player.state).toBe('JUMPING');
    });

    test('remote authoritative jump updates mesh arc from replicated jump fields', () => {
        const engine = createEngineHarness();
        const remoteEntity = {
            position: new THREE.Vector3(0, 0, 0),
            targetServerPosition: null,
            targetServerRotation: undefined,
            rotation: new THREE.Quaternion(),
            state: 'IDLE',
            isCharging: false,
            isDead: false,
            deadTimer: 0,
            mesh: {
                visible: true,
                position: new THREE.Vector3(0, 0, 0),
                quaternion: new THREE.Quaternion(),
                scale: new THREE.Vector3(1, 1, 1),
                userData: {}
            },
            stats: { hp: 100, maxHp: 100, mana: 10, maxMana: 10, speed: 3, attackSpeed: 1 },
            playJumpAnimation: jest.fn(),
            clearJumpAnimation: jest.fn(),
            updateState: jest.fn(function updateState(nextState) {
                this.state = nextState;
            })
        };

        engine.syncRemoteEntity(remoteEntity, {
            id: 'remote-1',
            type: 'Player',
            state: 'JUMPING',
            x: 4,
            y: 0,
            z: 0,
            rotation: 0.75,
            jumpStartX: 0,
            jumpStartY: 0,
            jumpStartZ: 0,
            jumpTargetX: 20,
            jumpTargetY: 0,
            jumpTargetZ: 0,
            jumpProgress: 0.5,
            jumpHeight: 8,
            health: 100,
            maxHealth: 100,
            mana: 10,
            maxMana: 10
        });

        expect(remoteEntity.updateState).toHaveBeenCalledWith('JUMPING');
        expect(remoteEntity.targetServerPosition.x).toBe(4);
        expect(remoteEntity.jumpVisualState).toEqual(expect.objectContaining({
            start: expect.any(THREE.Vector3),
            end: expect.any(THREE.Vector3),
            progress: 0,
            authoritativeProgress: 0.5,
            height: 8
        }));
        expect(remoteEntity.jumpVisualState.visualHeight).toBeCloseTo(0, 5);
        expect(remoteEntity.playJumpAnimation).toHaveBeenCalledWith(expect.objectContaining({
            duration: expect.any(Number),
            serverDriven: true
        }));

        engine.activeEntitiesCache = [engine.player, remoteEntity];
        engine.updateRemoteJumpVisuals(remoteEntity.jumpVisualState.duration * 0.5);
        engine.applyEntityJumpVisuals(remoteEntity, remoteEntity.jumpVisualState);

        const upVector = new THREE.Vector3(0, 1, 0).applyQuaternion(remoteEntity.mesh.quaternion);
        expect(remoteEntity.mesh.position.x).toBeCloseTo(10, 5);
        expect(remoteEntity.mesh.position.y).toBeGreaterThan(remoteEntity.position.y);
        expect(remoteEntity.jumpVisualState.height).toBeGreaterThanOrEqual(7);
        expect(remoteEntity.mesh.position.y - remoteEntity.position.y).toBeGreaterThanOrEqual(7);
        expect(remoteEntity.mesh.quaternion.angleTo(remoteEntity.rotation)).toBeGreaterThan(1.5);
        expect(upVector.y).toBeLessThan(-0.75);
        expect(remoteEntity.mesh.scale.y).toBeLessThan(1.01);
        expect(remoteEntity.mesh.scale.z).toBeGreaterThan(1.05);

        remoteEntity.jumpVisualState.progress = 0.8;
        remoteEntity.jumpVisualState.visualHeight = Math.sin(0.8 * Math.PI) * remoteEntity.jumpVisualState.height;
        engine.applyEntityJumpVisuals(remoteEntity, remoteEntity.jumpVisualState);
        expect(remoteEntity.mesh.quaternion.angleTo(remoteEntity.rotation)).toBeGreaterThan(1.2);

        engine.clearAuthoritativeJumpState(remoteEntity);
        engine.updateRemoteJumpVisuals(remoteEntity.jumpVisualState.duration);

        expect(remoteEntity.clearJumpAnimation).toHaveBeenCalledTimes(1);
        expect(engine.spawnTransientEffect).toHaveBeenCalledWith(
            'jump_land',
            expect.objectContaining({ x: 20, y: 0, z: 0 }),
            0xd8d2c4,
            expect.objectContaining({ impact: 0.85, className: 'Object' })
        );
    });

    test('remote actor first seen mid-jump seeds from jump base height before visual sync', () => {
        const engine = createEngineHarness();
        const remoteEntity = {
            position: new THREE.Vector3(0, 0, 0),
            targetServerPosition: null,
            targetServerRotation: undefined,
            rotation: new THREE.Quaternion(),
            state: 'IDLE',
            isCharging: false,
            isDead: false,
            deadTimer: 0,
            visualOffset: new THREE.Vector3(0, 0, 0),
            mesh: {
                visible: true,
                position: new THREE.Vector3(0, 0, 0),
                quaternion: new THREE.Quaternion(),
                scale: new THREE.Vector3(1, 1, 1),
                userData: {}
            },
            stats: { hp: 100, maxHp: 100, mana: 10, maxMana: 10, speed: 3, attackSpeed: 1 },
            playJumpAnimation: jest.fn(),
            clearJumpAnimation: jest.fn(),
            updateState: jest.fn(function updateState(nextState) {
                this.state = nextState;
            })
        };
        const jumpSnapshot = {
            id: 'remote-1',
            type: 'Player',
            state: 'JUMPING',
            x: 5,
            y: 4.5,
            z: 0,
            jumpStartX: 0,
            jumpStartZ: 0,
            jumpTargetX: 20,
            jumpTargetZ: 0,
            jumpProgress: 0.25,
            jumpHeight: 8,
            health: 100,
            maxHealth: 100,
            mana: 10,
            maxMana: 10
        };

        remoteEntity.position.set(jumpSnapshot.x, engine.getInitialRemoteEntityY(jumpSnapshot), jumpSnapshot.z);
        engine.syncRemoteEntity(remoteEntity, { ...jumpSnapshot, _newlyCreated: true });
        engine.activeEntitiesCache = [engine.player, remoteEntity];
        engine.updateRemoteJumpVisuals(remoteEntity.jumpVisualState.duration * 0.25);
        engine.applyEntityJumpVisuals(remoteEntity, remoteEntity.jumpVisualState);

        expect(remoteEntity.position.y).toBe(0);
        expect(remoteEntity.targetServerPosition.y).toBe(0);
        expect(remoteEntity.jumpVisualState.start.y).toBe(0);
        expect(remoteEntity.jumpVisualState.visualProgress).toBeCloseTo(0.25, 5);
        expect(remoteEntity.jumpVisualState.visualHeight).toBeGreaterThan(5);
        expect(remoteEntity.mesh.position.x).toBeCloseTo(5, 5);
        expect(remoteEntity.mesh.position.y).toBeGreaterThan(5);
        expect(remoteEntity.mesh.quaternion.angleTo(remoteEntity.rotation)).toBeGreaterThan(1.2);
    });

    test('remote authoritative jump without explicit metadata still builds a visible airborne arc from replicated travel', () => {
        const engine = createEngineHarness();
        const remoteEntity = {
            position: new THREE.Vector3(0, 0, 0),
            targetServerPosition: null,
            targetServerRotation: undefined,
            rotation: new THREE.Quaternion(),
            state: 'IDLE',
            isCharging: false,
            isDead: false,
            deadTimer: 0,
            visualOffset: new THREE.Vector3(0, 0, 0),
            mesh: {
                visible: true,
                position: new THREE.Vector3(0, 0, 0),
                quaternion: new THREE.Quaternion(),
                scale: new THREE.Vector3(1, 1, 1),
                userData: {}
            },
            stats: { hp: 100, maxHp: 100, mana: 10, maxMana: 10, speed: 3, attackSpeed: 1 },
            updateState: jest.fn(function updateState(nextState) {
                this.state = nextState;
            })
        };

        engine.syncRemoteEntity(remoteEntity, {
            id: 'remote-1',
            type: 'Player',
            state: 'JUMPING',
            x: 4,
            y: 2.5,
            z: 0,
            rotation: 0.3,
            health: 100,
            maxHealth: 100,
            mana: 10,
            maxMana: 10
        });
        engine.syncRemoteEntity(remoteEntity, {
            id: 'remote-1',
            type: 'Player',
            state: 'JUMPING',
            x: 12,
            y: 5.5,
            z: 0,
            rotation: 0.3,
            health: 100,
            maxHealth: 100,
            mana: 10,
            maxMana: 10
        });
        engine.activeEntitiesCache = [engine.player, remoteEntity];
        engine.updateRemoteJumpVisuals(0.6);

        expect(remoteEntity.jumpVisualState).toEqual(expect.objectContaining({
            start: expect.any(THREE.Vector3),
            end: expect.any(THREE.Vector3)
        }));
        expect(remoteEntity.jumpVisualState.progress).toBeGreaterThan(0.45);
        expect(remoteEntity.jumpVisualState.visualHeight).toBeGreaterThan(5);

        engine.applyEntityJumpVisuals(remoteEntity, remoteEntity.jumpVisualState);

        expect(remoteEntity.mesh.position.y).toBeGreaterThan(5);
        expect(remoteEntity.mesh.quaternion.angleTo(remoteEntity.rotation)).toBeGreaterThan(1.5);
    });

    test('remote authoritative jump visually interpolates mesh travel between replicated jump packets', () => {
        const engine = createEngineHarness();
        const remoteEntity = {
            position: new THREE.Vector3(0, 0, 0),
            targetServerPosition: null,
            targetServerRotation: undefined,
            rotation: new THREE.Quaternion(),
            state: 'IDLE',
            isCharging: false,
            isDead: false,
            deadTimer: 0,
            visualOffset: new THREE.Vector3(0, 0, 0),
            mesh: {
                visible: true,
                position: new THREE.Vector3(0, 0, 0),
                quaternion: new THREE.Quaternion(),
                scale: new THREE.Vector3(1, 1, 1),
                userData: {}
            },
            stats: { hp: 100, maxHp: 100, mana: 10, maxMana: 10, speed: 3, attackSpeed: 1 },
            updateState: jest.fn(function updateState(nextState) {
                this.state = nextState;
            })
        };

        engine.syncRemoteEntity(remoteEntity, {
            id: 'remote-1',
            type: 'Player',
            state: 'JUMPING',
            x: 4,
            y: 2.5,
            z: 0,
            rotation: 0.3,
            health: 100,
            maxHealth: 100,
            mana: 10,
            maxMana: 10
        });
        engine.applyEntityJumpVisuals(remoteEntity, remoteEntity.jumpVisualState);
        const firstVisualX = remoteEntity.mesh.position.x;

        engine.syncRemoteEntity(remoteEntity, {
            id: 'remote-1',
            type: 'Player',
            state: 'JUMPING',
            x: 12,
            y: 5.5,
            z: 0,
            rotation: 0.3,
            health: 100,
            maxHealth: 100,
            mana: 10,
            maxMana: 10
        });
        const snappedLogicalX = remoteEntity.position.x;

        engine.applyEntityJumpVisuals(remoteEntity, remoteEntity.jumpVisualState);

        expect(snappedLogicalX).toBe(12);
        expect(remoteEntity.mesh.position.x).toBeGreaterThan(firstVisualX);
        expect(remoteEntity.mesh.position.x).toBeLessThan(snappedLogicalX);
    });

    test('remote jump deltas with scalar metadata still follow observed server positions', () => {
        const engine = createEngineHarness();
        const remoteEntity = {
            position: new THREE.Vector3(0, 0, 0),
            targetServerPosition: null,
            targetServerRotation: undefined,
            rotation: new THREE.Quaternion(),
            state: 'IDLE',
            isCharging: false,
            isDead: false,
            deadTimer: 0,
            visualOffset: new THREE.Vector3(0, 0, 0),
            mesh: {
                visible: true,
                position: new THREE.Vector3(0, 0, 0),
                quaternion: new THREE.Quaternion(),
                scale: new THREE.Vector3(1, 1, 1),
                userData: {}
            },
            stats: { hp: 100, maxHp: 100, mana: 10, maxMana: 10, speed: 3, attackSpeed: 1 },
            playJumpAnimation: jest.fn(),
            updateState: jest.fn(function updateState(nextState) {
                this.state = nextState;
            })
        };

        engine.syncRemoteEntity(remoteEntity, {
            id: 'remote-1',
            type: 'Player',
            state: 'JUMPING',
            x: 3,
            y: 2,
            z: 0,
            jumpProgress: 0.2,
            health: 100,
            maxHealth: 100,
            mana: 10,
            maxMana: 10
        });
        engine.applyEntityJumpVisuals(remoteEntity, remoteEntity.jumpVisualState);
        const firstVisualX = remoteEntity.mesh.position.x;

        engine.syncRemoteEntity(remoteEntity, {
            id: 'remote-1',
            type: 'Player',
            state: 'JUMPING',
            x: 8,
            y: 5,
            z: 0,
            jumpProgress: 0.55,
            health: 100,
            maxHealth: 100,
            mana: 10,
            maxMana: 10
        });
        engine.updateRemoteJumpVisuals(0.016);
        engine.applyEntityJumpVisuals(remoteEntity, remoteEntity.jumpVisualState);

        expect(remoteEntity.jumpVisualState.hasAuthoritativeTrajectory).toBe(false);
        expect(remoteEntity.jumpVisualState.end.x).toBeCloseTo(8, 5);
        expect(remoteEntity.mesh.position.x).toBeGreaterThan(firstVisualX);
        expect(remoteEntity.mesh.position.x).toBeGreaterThan(0);
        expect(remoteEntity.mesh.position.x).toBeLessThan(8);
    });

    test('remote authoritative jump does not restart animation for tiny metadata jitter', () => {
        const engine = createEngineHarness();
        const remoteEntity = {
            position: new THREE.Vector3(0, 0, 0),
            targetServerPosition: null,
            targetServerRotation: undefined,
            rotation: new THREE.Quaternion(),
            state: 'IDLE',
            isCharging: false,
            isDead: false,
            deadTimer: 0,
            visualOffset: new THREE.Vector3(0, 0, 0),
            mesh: {
                visible: true,
                position: new THREE.Vector3(0, 0, 0),
                quaternion: new THREE.Quaternion(),
                scale: new THREE.Vector3(1, 1, 1),
                userData: {}
            },
            stats: { hp: 100, maxHp: 100, mana: 10, maxMana: 10, speed: 3, attackSpeed: 1 },
            playJumpAnimation: jest.fn(),
            updateState: jest.fn(function updateState(nextState) {
                this.state = nextState;
            })
        };

        engine.syncRemoteEntity(remoteEntity, {
            id: 'remote-1',
            type: 'Player',
            state: 'JUMPING',
            x: 4,
            y: 0,
            z: 0,
            jumpStartX: 0,
            jumpStartY: 0,
            jumpStartZ: 0,
            jumpTargetX: 20,
            jumpTargetY: 0,
            jumpTargetZ: 0,
            jumpDuration: 1,
            jumpProgress: 0.2,
            health: 100,
            maxHealth: 100,
            mana: 10,
            maxMana: 10
        });
        engine.activeEntitiesCache = [engine.player, remoteEntity];
        engine.updateRemoteJumpVisuals(0.2);

        engine.syncRemoteEntity(remoteEntity, {
            id: 'remote-1',
            type: 'Player',
            state: 'JUMPING',
            x: 4.5,
            y: 0,
            z: 0,
            jumpStartX: 0.02,
            jumpStartY: 0,
            jumpStartZ: 0,
            jumpTargetX: 20.02,
            jumpTargetY: 0,
            jumpTargetZ: 0,
            jumpDuration: 1.02,
            jumpProgress: 0.18,
            health: 100,
            maxHealth: 100,
            mana: 10,
            maxMana: 10
        });

        expect(remoteEntity.playJumpAnimation).toHaveBeenCalledTimes(1);
        expect(remoteEntity.jumpVisualState.progress).toBeCloseTo(0.2, 5);
    });

    test('remote authoritative jump interpolation does not jitter backward on tiny correction packets', () => {
        const engine = createEngineHarness();
        const remoteEntity = {
            position: new THREE.Vector3(0, 0, 0),
            targetServerPosition: null,
            targetServerRotation: undefined,
            rotation: new THREE.Quaternion(),
            state: 'IDLE',
            isCharging: false,
            isDead: false,
            deadTimer: 0,
            visualOffset: new THREE.Vector3(0, 0, 0),
            mesh: {
                visible: true,
                position: new THREE.Vector3(0, 0, 0),
                quaternion: new THREE.Quaternion(),
                scale: new THREE.Vector3(1, 1, 1),
                userData: {}
            },
            stats: { hp: 100, maxHp: 100, mana: 10, maxMana: 10, speed: 3, attackSpeed: 1 },
            updateState: jest.fn(function updateState(nextState) {
                this.state = nextState;
            })
        };

        engine.syncRemoteEntity(remoteEntity, {
            id: 'remote-1',
            type: 'Player',
            state: 'JUMPING',
            x: 4,
            y: 2.5,
            z: 0,
            rotation: 0.3,
            health: 100,
            maxHealth: 100,
            mana: 10,
            maxMana: 10
        });
        engine.applyEntityJumpVisuals(remoteEntity, remoteEntity.jumpVisualState);

        engine.syncRemoteEntity(remoteEntity, {
            id: 'remote-1',
            type: 'Player',
            state: 'JUMPING',
            x: 12,
            y: 5.5,
            z: 0,
            rotation: 0.3,
            health: 100,
            maxHealth: 100,
            mana: 10,
            maxMana: 10
        });
        for (let i = 0; i < 20; i += 1) {
            engine.applyEntityJumpVisuals(remoteEntity, remoteEntity.jumpVisualState);
        }
        const forwardVisualX = remoteEntity.mesh.position.x;

        engine.syncRemoteEntity(remoteEntity, {
            id: 'remote-1',
            type: 'Player',
            state: 'JUMPING',
            x: 11.95,
            y: 5.45,
            z: 0,
            rotation: 0.3,
            health: 100,
            maxHealth: 100,
            mana: 10,
            maxMana: 10
        });
        engine.applyEntityJumpVisuals(remoteEntity, remoteEntity.jumpVisualState);

        expect(remoteEntity.position.x).toBeCloseTo(11.95, 5);
        expect(remoteEntity.mesh.position.x).toBeGreaterThanOrEqual(forwardVisualX);
    });

    test('remote authoritative jump visual progress advances between server packets', () => {
        const engine = createEngineHarness();
        const remoteEntity = {
            position: new THREE.Vector3(4, 0, 0),
            rotation: new THREE.Quaternion(),
            jumpVisualState: {
                start: new THREE.Vector3(0, 0, 0),
                end: new THREE.Vector3(20, 0, 0),
                progress: 0.25,
                elapsed: 0.25,
                duration: 1,
                height: 8,
                visualHeight: Math.sin(0.25 * Math.PI) * 8,
                serverDriven: true,
                displayPosition: new THREE.Vector3(4, 0, 0)
            },
            mesh: {
                position: new THREE.Vector3(4, 0, 0),
                quaternion: new THREE.Quaternion(),
                scale: new THREE.Vector3(1, 1, 1),
                userData: {}
            }
        };
        engine.activeEntitiesCache = [engine.player, remoteEntity];

        engine.updateRemoteJumpVisuals(0.2);

        expect(remoteEntity.jumpVisualState.progress).toBeCloseTo(0.45, 5);
        expect(remoteEntity.jumpVisualState.visualHeight).toBeGreaterThan(Math.sin(0.25 * Math.PI) * 8);
        expect(remoteEntity.jumpVisualState.displayPosition.x).toBeGreaterThanOrEqual(4);
    });

    test('remote jumps with authoritative trajectory render from start/end/progress instead of hovering toward server packets', () => {
        const engine = createEngineHarness();
        const remoteEntity = {
            position: new THREE.Vector3(4, 0, 0),
            targetServerPosition: null,
            targetServerRotation: undefined,
            rotation: new THREE.Quaternion(),
            state: 'IDLE',
            isCharging: false,
            isDead: false,
            deadTimer: 0,
            mesh: {
                visible: true,
                position: new THREE.Vector3(4, 0, 0),
                quaternion: new THREE.Quaternion(),
                scale: new THREE.Vector3(1, 1, 1),
                userData: {}
            },
            stats: { hp: 100, maxHp: 100, mana: 10, maxMana: 10, speed: 3, attackSpeed: 1 },
            playJumpAnimation: jest.fn(),
            updateState: jest.fn(function updateState(nextState) {
                this.state = nextState;
            })
        };

        engine.syncRemoteEntity(remoteEntity, {
            id: 'remote-1',
            type: 'Player',
            state: 'JUMPING',
            x: 4,
            y: 2,
            z: 0,
            jumpStartX: 0,
            jumpStartY: 0,
            jumpStartZ: 0,
            jumpTargetX: 20,
            jumpTargetY: 0,
            jumpTargetZ: 0,
            jumpProgress: 0.5,
            jumpHeight: 8,
            jumpDuration: 1,
            health: 100,
            maxHealth: 100,
            mana: 10,
            maxMana: 10
        });

        expect(remoteEntity.position.x).toBe(4);

        engine.activeEntitiesCache = [engine.player, remoteEntity];
        engine.updateRemoteJumpVisuals(0.5);
        engine.applyEntityJumpVisuals(remoteEntity, remoteEntity.jumpVisualState);

        expect(remoteEntity.jumpVisualState.hasAuthoritativeTrajectory).toBe(true);
        expect(remoteEntity.jumpVisualState.displayPosition.x).toBeCloseTo(10, 5);
        expect(remoteEntity.mesh.position.x).toBeCloseTo(10, 5);
        expect(remoteEntity.mesh.position.y).toBeGreaterThan(7);
        expect(remoteEntity.mesh.quaternion.angleTo(remoteEntity.rotation)).toBeGreaterThan(1.5);
    });

    test('remote jump visual progress is frontend-driven even when server packets arrive near landing', () => {
        const engine = createEngineHarness();
        const remoteEntity = {
            position: new THREE.Vector3(0, 0, 0),
            targetServerPosition: null,
            targetServerRotation: undefined,
            rotation: new THREE.Quaternion(),
            state: 'IDLE',
            isCharging: false,
            isDead: false,
            deadTimer: 0,
            visualOffset: new THREE.Vector3(0, 0, 0),
            mesh: {
                visible: true,
                position: new THREE.Vector3(0, 0, 0),
                quaternion: new THREE.Quaternion(),
                scale: new THREE.Vector3(1, 1, 1),
                userData: {}
            },
            stats: { hp: 100, maxHp: 100, mana: 10, maxMana: 10, speed: 3, attackSpeed: 1 },
            playJumpAnimation: jest.fn(),
            clearJumpAnimation: jest.fn(),
            updateState: jest.fn(function updateState(nextState) {
                this.state = nextState;
            })
        };

        engine.syncRemoteEntity(remoteEntity, {
            id: 'remote-1',
            type: 'Player',
            state: 'JUMPING',
            x: 19,
            y: 1,
            z: 0,
            jumpStartX: 0,
            jumpStartY: 0,
            jumpStartZ: 0,
            jumpTargetX: 20,
            jumpTargetY: 0,
            jumpTargetZ: 0,
            jumpProgress: 0.95,
            jumpHeight: 8,
            jumpDuration: 1,
            health: 100,
            maxHealth: 100,
            mana: 10,
            maxMana: 10
        });

        expect(remoteEntity.jumpVisualState.authoritativeProgress).toBeCloseTo(0.95, 5);
        expect(remoteEntity.jumpVisualState.visualProgress).toBe(0);
        engine.applyEntityJumpVisuals(remoteEntity, remoteEntity.jumpVisualState);
        expect(remoteEntity.mesh.quaternion.angleTo(remoteEntity.rotation)).toBeLessThan(0.05);

        engine.activeEntitiesCache = [engine.player, remoteEntity];
        engine.updateRemoteJumpVisuals(0.25);
        engine.applyEntityJumpVisuals(remoteEntity, remoteEntity.jumpVisualState);
        expect(remoteEntity.jumpVisualState.visualProgress).toBeCloseTo(0.25, 5);
        expect(remoteEntity.mesh.quaternion.angleTo(remoteEntity.rotation)).toBeGreaterThan(1.0);
        expect(remoteEntity.mesh.quaternion.angleTo(remoteEntity.rotation)).toBeLessThan(2.4);

        engine.clearAuthoritativeJumpState(remoteEntity);
        expect(remoteEntity.jumpVisualState.landingPending).toBe(true);
        engine.updateRemoteJumpVisuals(1);
        expect(remoteEntity.jumpVisualState).toBeNull();
        expect(remoteEntity.position.x).toBeCloseTo(19, 5);
        expect(remoteEntity.targetServerPosition.x).toBeCloseTo(19, 5);
        expect(remoteEntity.clearJumpAnimation).toHaveBeenCalledTimes(1);
        expect(engine.spawnTransientEffect).toHaveBeenCalledWith(
            'jump_land',
            expect.objectContaining({ x: 20, y: 0, z: 0 }),
            0xd8d2c4,
            expect.objectContaining({ impact: 0.85 })
        );
    });

    test('remote jump finishing does not snap logical actor position to jump target', () => {
        const engine = createEngineHarness();
        const remoteEntity = {
            position: new THREE.Vector3(8, 0, 0),
            targetServerPosition: new THREE.Vector3(12, 0, 0),
            rotation: new THREE.Quaternion(),
            jumpVisualState: {
                start: new THREE.Vector3(0, 0, 0),
                end: new THREE.Vector3(40, 0, 0),
                progress: 1,
                visualProgress: 1,
                elapsed: 1.28,
                duration: 1.28,
                height: 16,
                visualHeight: 0,
                authoritativeProgress: 1,
                serverDriven: true,
                hasAuthoritativeTrajectory: true,
                displayPosition: new THREE.Vector3(40, 0, 0)
            },
            mesh: {
                position: new THREE.Vector3(40, 0, 0),
                quaternion: new THREE.Quaternion(),
                scale: new THREE.Vector3(1, 1, 1),
                userData: {}
            },
            clearJumpAnimation: jest.fn()
        };

        engine.finishRemoteJumpVisual(remoteEntity);

        expect(remoteEntity.jumpVisualState).toBeNull();
        expect(remoteEntity.position.x).toBeCloseTo(8, 5);
        expect(remoteEntity.targetServerPosition.x).toBeCloseTo(12, 5);
        expect(engine.chunkManager.updateEntityChunk).not.toHaveBeenCalledWith(remoteEntity);
        expect(engine.spawnTransientEffect).toHaveBeenCalledWith(
            'jump_land',
            expect.objectContaining({ x: 40, y: 0, z: 0 }),
            0xd8d2c4,
            expect.objectContaining({ impact: 0.85 })
        );
    });

    test('local predicted and remote authoritative jumps render the same mesh pose for the same visual progress', () => {
        const engine = createEngineHarness();
        const start = new THREE.Vector3(0, 0, 0);
        const end = new THREE.Vector3(20, 0, 0);
        const duration = engine.getJumpTravelDuration(start.distanceTo(end));
        const height = engine.getJumpArcHeight(start.distanceTo(end));
        const progress = 0.5;
        const visualHeight = Math.sin(progress * Math.PI) * height;

        engine.player.position.copy(start).lerp(end, progress);
        engine.player.position.y = 0;
        engine.playerJumpState = engine.normalizeJumpVisualState({
            start: start.clone(),
            end: end.clone(),
            visualProgress: progress,
            elapsed: progress * duration,
            duration,
            height,
            serverDriven: false,
            displayPosition: engine.player.position.clone()
        }, engine.player.position);
        engine.playerJumpVisualHeight = engine.playerJumpState.visualHeight;
        engine.applyPlayerJumpVisuals();

        const localMeshPosition = engine.player.mesh.position.clone();
        const localMeshQuaternion = engine.player.mesh.quaternion.clone();
        const localMeshScale = engine.player.mesh.scale.clone();

        const remoteEntity = {
            position: start.clone().lerp(end, progress),
            rotation: new THREE.Quaternion(),
            jumpVisualState: engine.normalizeJumpVisualState({
                start: start.clone(),
                end: end.clone(),
                visualProgress: progress,
                elapsed: progress * duration,
                duration,
                height,
                visualHeight,
                serverDriven: true,
                displayPosition: start.clone().lerp(end, progress)
            }, start.clone().lerp(end, progress)),
            mesh: {
                position: new THREE.Vector3(),
                quaternion: new THREE.Quaternion(),
                scale: new THREE.Vector3(1, 1, 1),
                userData: {}
            }
        };

        engine.applyEntityJumpVisuals(remoteEntity, remoteEntity.jumpVisualState);

        expect(remoteEntity.mesh.position.distanceTo(localMeshPosition)).toBeLessThan(0.0001);
        expect(remoteEntity.mesh.quaternion.angleTo(localMeshQuaternion)).toBeLessThan(0.0001);
        expect(remoteEntity.mesh.scale.distanceTo(localMeshScale)).toBeLessThan(0.0001);
    });

    test('remote jump pose is reapplied after actor update resets the mesh upright', () => {
        const engine = createEngineHarness();
        const remoteEntity = {
            position: new THREE.Vector3(10, 0, 0),
            rotation: new THREE.Quaternion(),
            jumpVisualState: {
                start: new THREE.Vector3(0, 0, 0),
                end: new THREE.Vector3(20, 0, 0),
                progress: 0.5,
                visualProgress: 0.5,
                elapsed: 0.5,
                duration: 1,
                height: 8,
                visualHeight: 8,
                serverDriven: true,
                displayPosition: new THREE.Vector3(10, 0, 0)
            },
            mesh: {
                position: new THREE.Vector3(10, 0, 0),
                quaternion: new THREE.Quaternion(),
                scale: new THREE.Vector3(1, 1, 1),
                userData: {}
            }
        };
        engine.chunkManager.getActiveEntities.mockReturnValue([engine.player, remoteEntity]);

        remoteEntity.mesh.position.copy(remoteEntity.position);
        remoteEntity.mesh.quaternion.copy(remoteEntity.rotation);
        expect(remoteEntity.mesh.quaternion.angleTo(remoteEntity.rotation)).toBe(0);

        engine.applyRemoteJumpVisuals({ smoothDisplayPosition: false });

        expect(remoteEntity.jumpVisualState.displayPosition.x).toBe(10);
        expect(remoteEntity.mesh.position.y).toBe(8);
        expect(remoteEntity.mesh.quaternion.angleTo(remoteEntity.rotation)).toBeGreaterThan(2.5);
    });

    test('remote jump visual timer advances for known players outside active render chunks', () => {
        const engine = createEngineHarness();
        const remoteEntity = {
            id: 'remote-1',
            position: new THREE.Vector3(0, 0, 0),
            rotation: new THREE.Quaternion(),
            jumpVisualState: {
                start: new THREE.Vector3(0, 0, 0),
                end: new THREE.Vector3(20, 0, 0),
                progress: 0,
                visualProgress: 0,
                elapsed: 0,
                duration: 1,
                height: 8,
                visualHeight: 0,
                serverDriven: true,
                hasAuthoritativeTrajectory: true,
                displayPosition: new THREE.Vector3(0, 0, 0)
            },
            mesh: {
                position: new THREE.Vector3(0, 0, 0),
                quaternion: new THREE.Quaternion(),
                scale: new THREE.Vector3(1, 1, 1),
                userData: {}
            }
        };
        engine.activeEntitiesCache = [engine.player];
        engine.remotePlayers.set(remoteEntity.id, remoteEntity);

        engine.updateRemoteJumpVisuals(0.5);

        expect(remoteEntity.jumpVisualState.visualProgress).toBeCloseTo(0.5, 5);
        expect(remoteEntity.jumpVisualState.visualHeight).toBeGreaterThan(7);
        expect(remoteEntity.jumpVisualState.displayPosition.x).toBeCloseTo(10, 5);
    });

    test('syncRemoteEntity neutralises targetServerPosition.y to baseY during jump to prevent Actor lerp double-arc (Bug 1 fix)', () => {
        const engine = createEngineHarness();
        const remoteEntity = {
            position: new THREE.Vector3(0, 0, 0),
            targetServerPosition: null,
            targetServerRotation: undefined,
            rotation: new THREE.Quaternion(),
            state: 'IDLE',
            isCharging: false,
            isDead: false,
            deadTimer: 0,
            mesh: {
                visible: true,
                position: new THREE.Vector3(0, 0, 0),
                quaternion: new THREE.Quaternion(),
                scale: new THREE.Vector3(1, 1, 1),
                userData: {}
            },
            stats: { hp: 100, maxHp: 100, mana: 10, maxMana: 10, speed: 3, attackSpeed: 1 },
            playJumpAnimation: jest.fn(),
            clearJumpAnimation: jest.fn(),
            updateState: jest.fn(function updateState(nextState) { this.state = nextState; })
        };

        // pData.y = 4.5 is the server-side arc Y (base + arc height combined).
        // syncAuthoritativeJumpState computes baseY ~0 from the trajectory and sets
        // entity.position.y = baseY.  The fix must also clamp targetServerPosition.y
        // to baseY so Actor.update() lerp does not re-introduce the arc height, which
        // would cause applyEntityJumpVisuals to add visualHeight on top => double arc.
        engine.syncRemoteEntity(remoteEntity, {
            id: 'remote-1',
            type: 'Player',
            state: 'JUMPING',
            x: 5,
            y: 4.5,          // server arc Y -- includes arc height
            z: 0,
            jumpStartX: 0,
            jumpStartY: 0,
            jumpStartZ: 0,
            jumpTargetX: 20,
            jumpTargetY: 0,
            jumpTargetZ: 0,
            jumpProgress: 0.25,
            jumpHeight: 8,
            health: 100,
            maxHealth: 100,
            mana: 10,
            maxMana: 10
        });

        expect(remoteEntity.targetServerPosition).not.toBeNull();
        // targetServerPosition.y must match entity.position.y (baseY), NOT pData.y (4.5).
        expect(remoteEntity.targetServerPosition.y).toBeCloseTo(remoteEntity.position.y, 5);
        expect(remoteEntity.targetServerPosition.y).not.toBeCloseTo(4.5, 1);
    });

    test('updateRemoteJumpVisuals does not lerp displayPosition X/Z; applyEntityJumpVisuals is the single lerp site per frame (Bug 2 fix)', () => {
        const engine = createEngineHarness();
        // Entity is mid-jump: displayPosition.x lags behind logical position.x.
        const remoteEntity = {
            position: new THREE.Vector3(8, 0, 0),
            rotation: new THREE.Quaternion(),
            jumpVisualState: {
                start: new THREE.Vector3(0, 0, 0),
                end: new THREE.Vector3(20, 0, 0),
                progress: 0.4,
                elapsed: 0.4,
                duration: 1,
                height: 8,
                visualHeight: Math.sin(0.4 * Math.PI) * 8,
                serverDriven: true,
                displayPosition: new THREE.Vector3(4, 0, 0)  // lags behind position.x=8
            },
            mesh: {
                position: new THREE.Vector3(4, 0, 0),
                quaternion: new THREE.Quaternion(),
                scale: new THREE.Vector3(1, 1, 1),
                userData: {}
            }
        };
        engine.activeEntitiesCache = [engine.player, remoteEntity];

        // Update pass: X/Z must NOT advance — only Y sync is allowed here.
        engine.updateRemoteJumpVisuals(0.016);
        expect(remoteEntity.jumpVisualState.displayPosition.x).toBe(4);

        // Render pass: X/Z must advance toward entity.position.x = 8 via single lerp.
        engine.applyEntityJumpVisuals(remoteEntity, remoteEntity.jumpVisualState);
        expect(remoteEntity.jumpVisualState.displayPosition.x).toBeGreaterThan(4);
        expect(remoteEntity.jumpVisualState.displayPosition.x).toBeLessThan(8);
        expect(remoteEntity.mesh.position.x).toBeGreaterThan(4);
    });
});
