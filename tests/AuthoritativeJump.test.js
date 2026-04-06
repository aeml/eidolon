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
    engine.playerJumpState = null;
    engine.playerJumpVisualHeight = 0;
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
        render: jest.fn()
    };
    engine.uiManager = {
        isEscMenuOpen: false,
        isPatchNotesOpen: false,
        isShopOpen: false,
        reportScreen: { style: { display: 'none' } },
        updatePlayerStats: jest.fn(),
        updateXP: jest.fn(),
        updateHotbarCooldowns: jest.fn(),
        updateEnemyBars: jest.fn()
    };
    engine.minimap = { update: jest.fn() };
    engine.worldMap = { update: jest.fn() };
    engine.network = { send: jest.fn() };
    engine.abilityController = {
        pendingAbilityTarget: { id: 'ability-target' },
        pendingAbilitySkill: 'Fireball'
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
        expect(engine.pendingInteraction).toBeNull();
        expect(engine.abilityController.pendingAbilityTarget).toBeNull();
        expect(engine.abilityController.pendingAbilitySkill).toBeNull();
        expect(engine.player.targetPosition).toBeNull();
        expect(engine.inputManager.isMouseDown).toBe(false);
    });

    test('self delta jump state seeds authoritative jump visuals from server state', () => {
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
                        x: 0,
                        y: 0,
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
        expect(engine.playerJumpState.end.x).toBe(18);
        expect(engine.playerJumpState.elapsed).toBeCloseTo(0.25, 5);
        expect(engine.player.state).toBe('JUMPING');
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
        expect(engine.playerJumpVisualHeight).toBe(0);
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
            progress: 0.5,
            height: 8
        }));
        expect(remoteEntity.jumpVisualState.visualHeight).toBeCloseTo(8, 5);

        engine.applyEntityJumpVisuals(remoteEntity, remoteEntity.jumpVisualState);

        const upVector = new THREE.Vector3(0, 1, 0).applyQuaternion(remoteEntity.mesh.quaternion);
        expect(remoteEntity.mesh.position.y).toBeGreaterThan(remoteEntity.position.y);
        expect(remoteEntity.jumpVisualState.height).toBeGreaterThanOrEqual(7);
        expect(remoteEntity.mesh.position.y - remoteEntity.position.y).toBeGreaterThanOrEqual(7);
        expect(remoteEntity.mesh.quaternion.angleTo(remoteEntity.rotation)).toBeGreaterThan(2.5);
        expect(upVector.y).toBeLessThan(-0.75);
        expect(remoteEntity.mesh.scale.y).toBeLessThan(1.01);
        expect(remoteEntity.mesh.scale.z).toBeGreaterThan(1.05);

        remoteEntity.jumpVisualState.progress = 0.8;
        remoteEntity.jumpVisualState.visualHeight = Math.sin(0.8 * Math.PI) * remoteEntity.jumpVisualState.height;
        engine.applyEntityJumpVisuals(remoteEntity, remoteEntity.jumpVisualState);
        expect(remoteEntity.mesh.quaternion.angleTo(remoteEntity.rotation)).toBeGreaterThan(1.2);

        engine.clearAuthoritativeJumpState(remoteEntity);

        expect(engine.spawnTransientEffect).toHaveBeenCalledWith(
            'jump_land',
            expect.objectContaining({ x: 4, y: 0, z: 0 }),
            0xd8d2c4,
            expect.objectContaining({ impact: 0.85, className: 'Object' })
        );
    });
});
