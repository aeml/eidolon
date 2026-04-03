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
    engine.abilityController = {
        pendingAbilityTarget: { id: 'ability-target' },
        pendingAbilitySkill: 'Fireball'
    };
    engine.inputManager = {
        keys: { control: false, alt: false },
        getGroundIntersection: jest.fn(() => new THREE.Vector3(12, 0, 8)),
        getGroundIntersectionFromEvent: jest.fn(() => new THREE.Vector3(12, 0, 8))
    };
    engine.collisionManager = {
        constrainToDungeonWalkableArea: jest.fn(() => false),
        checkCollision: jest.fn(() => null)
    };
    engine.player = {
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
            quaternion: new THREE.Quaternion()
        },
        render: jest.fn(function render() {
            this.mesh.position.copy(this.position);
        })
    };
    engine.chunkManager.getActiveEntities.mockImplementation(() => [engine.player]);
    return engine;
}

describe('GameEngine ctrl-click jump', () => {
    test('ctrl-left-click starts a jump from the click event coordinates instead of normal click-to-move', () => {
        const engine = createEngineHarness();
        engine.inputManager.getGroundIntersectionFromEvent.mockReturnValue(new THREE.Vector3(-6, 0, 14));

        engine.handlePrimaryClick({ ctrlKey: true, clientX: 123, clientY: 456 });

        expect(engine.performRaycast).toHaveBeenCalledTimes(1);
        expect(engine.inputManager.getGroundIntersectionFromEvent).toHaveBeenCalledWith(expect.objectContaining({
            ctrlKey: true,
            clientX: 123,
            clientY: 456
        }));
        expect(engine.player.move).not.toHaveBeenCalled();
        expect(engine.pendingInteraction).toBeNull();
        expect(engine.abilityController.pendingAbilityTarget).toBeNull();
        expect(engine.abilityController.pendingAbilitySkill).toBeNull();
        expect(engine.player.targetPosition).toBeNull();
        expect(engine.playerJumpState).toEqual(expect.objectContaining({
            start: expect.any(THREE.Vector3),
            end: expect.any(THREE.Vector3),
            duration: expect.any(Number)
        }));
        expect(engine.playerJumpState.end.x).toBeCloseTo(-6, 5);
        expect(engine.playerJumpState.end.z).toBeCloseTo(14, 5);
    });

    test('plain left click keeps existing ground move behavior', () => {
        const engine = createEngineHarness();

        engine.handlePrimaryClick();

        expect(engine.performRaycast).toHaveBeenCalledTimes(1);
        expect(engine.player.move).toHaveBeenCalledTimes(1);
        expect(engine.player.move).toHaveBeenCalledWith(expect.objectContaining({ x: 12, y: 0, z: 8 }));
        expect(engine.playerJumpState).toBeNull();
    });

    test('jump update creates an airborne arc and lands on the destination', () => {
        const engine = createEngineHarness();
        const destination = new THREE.Vector3(20, 0, 0);

        expect(engine.startPlayerJump(destination)).toBe(true);
        const duration = engine.playerJumpState.duration;

        engine.updatePlayerJump(duration / 2);
        engine.applyPlayerJumpVisuals();

        expect(engine.player.position.x).toBeCloseTo(10, 1);
        expect(engine.player.position.z).toBeCloseTo(0, 5);
        expect(engine.playerJumpVisualHeight).toBeGreaterThan(0);
        expect(engine.player.mesh.position.y).toBeCloseTo(engine.playerJumpVisualHeight, 5);
        expect(engine.chunkManager.updateEntityChunk).toHaveBeenCalled();
        expect(engine.renderSystem.setCameraTarget).toHaveBeenCalledWith(engine.player.position);

        engine.updatePlayerJump(duration / 2);
        engine.applyPlayerJumpVisuals();

        expect(engine.player.position.x).toBeCloseTo(20, 5);
        expect(engine.player.position.z).toBeCloseTo(0, 5);
        expect(engine.playerJumpState).toBeNull();
        expect(engine.playerJumpVisualHeight).toBe(0);
        expect(engine.player.mesh.position.y).toBeCloseTo(engine.player.position.y, 5);
        expect(engine.player.state).toBe('IDLE');
    });

    test('jump visuals apply a distinct airborne flip and reset to facing rotation on landing', () => {
        const engine = createEngineHarness();
        const destination = new THREE.Vector3(20, 0, 0);

        expect(engine.startPlayerJump(destination)).toBe(true);
        const duration = engine.playerJumpState.duration;

        engine.updatePlayerJump(duration / 2);
        engine.applyPlayerJumpVisuals();

        expect(engine.player.mesh.position.y).toBeGreaterThan(engine.player.position.y);
        expect(engine.player.mesh.quaternion.angleTo(engine.player.rotation)).toBeGreaterThan(1.0);

        engine.updatePlayerJump(duration / 2);
        engine.applyPlayerJumpVisuals();

        expect(engine.player.mesh.quaternion.angleTo(engine.player.rotation)).toBeCloseTo(0, 5);
    });

    test('jump landing is clamped back inside dungeon walkable geometry', () => {
        const engine = createEngineHarness();
        engine.isMultiplayer = false;
        engine.inputManager.getGroundIntersection.mockReturnValue(new THREE.Vector3(30, 0, 30));
        engine.collisionManager.constrainToDungeonWalkableArea.mockImplementation((position) => {
            position.x = 7;
            position.z = 5;
            return true;
        });

        engine.handlePrimaryClick({ ctrlKey: true });

        expect(engine.collisionManager.constrainToDungeonWalkableArea).toHaveBeenCalledTimes(2);
        expect(engine.playerJumpState.end.x).toBe(7);
        expect(engine.playerJumpState.end.z).toBe(5);
    });
});
