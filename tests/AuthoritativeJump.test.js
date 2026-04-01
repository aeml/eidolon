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
    test('ctrl-left-click sends a jump request instead of starting a local jump arc', () => {
        const engine = createEngineHarness();

        const handled = engine.handlePrimaryClick({ ctrlKey: true });

        expect(handled).toBe(true);
        expect(engine.performRaycast).toHaveBeenCalledTimes(1);
        expect(engine.network.send).toHaveBeenCalledWith('jump', {
            x: 12,
            y: 0,
            z: 8
        });
        expect(engine.player.move).not.toHaveBeenCalled();
        expect(engine.playerJumpState).toBeNull();
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
            mesh: { visible: true, position: new THREE.Vector3(0, 0, 0) },
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
    });
});
