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
    engine.spawnTransientEffect = jest.fn(() => true);
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
            quaternion: new THREE.Quaternion(),
            scale: new THREE.Vector3(1, 1, 1),
            userData: {}
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
        expect(duration).toBeGreaterThanOrEqual(0.95);

        engine.updatePlayerJump(duration / 2);
        engine.applyPlayerJumpVisuals();

        expect(engine.player.position.x).toBeCloseTo(10, 1);
        expect(engine.player.position.z).toBeCloseTo(0, 5);
        expect(engine.playerJumpState.height).toBeGreaterThanOrEqual(7);
        expect(engine.playerJumpVisualHeight).toBeGreaterThan(0);
        expect(engine.playerJumpVisualHeight).toBeGreaterThanOrEqual(7);
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

    test('jump visuals complete a full 360 front flip over the course of the jump', () => {
        const engine = createEngineHarness();
        const destination = new THREE.Vector3(20, 0, 0);

        expect(engine.startPlayerJump(destination)).toBe(true);
        const duration = engine.playerJumpState.duration;

        engine.updatePlayerJump(duration / 2);
        engine.applyPlayerJumpVisuals();

        const upVector = new THREE.Vector3(0, 1, 0).applyQuaternion(engine.player.mesh.quaternion);
        expect(engine.player.mesh.position.y).toBeGreaterThan(engine.player.position.y);
        expect(engine.player.mesh.quaternion.angleTo(engine.player.rotation)).toBeGreaterThan(2.5);
        expect(upVector.y).toBeLessThan(-0.75);

        engine.updatePlayerJump(duration * 0.25);
        engine.applyPlayerJumpVisuals();

        const lateAirAngle = engine.player.mesh.quaternion.angleTo(engine.player.rotation);
        expect(lateAirAngle).toBeGreaterThan(1.5);

        engine.updatePlayerJump(duration * 0.25);
        engine.applyPlayerJumpVisuals();

        expect(engine.player.mesh.quaternion.angleTo(engine.player.rotation)).toBeCloseTo(0, 5);
    });

    test('jump visuals build anticipation at takeoff and landing squash before settling', () => {
        const engine = createEngineHarness();
        const destination = new THREE.Vector3(20, 0, 0);

        expect(engine.startPlayerJump(destination)).toBe(true);

        engine.applyPlayerJumpVisuals();
        expect(engine.player.mesh.scale.y).toBeLessThan(1);
        expect(engine.player.mesh.scale.x).toBeGreaterThan(1);

        const duration = engine.playerJumpState.duration;
        engine.updatePlayerJump(duration * 0.55);
        engine.applyPlayerJumpVisuals();
        expect(engine.player.mesh.scale.y).toBeGreaterThan(1.04);

        engine.updatePlayerJump(duration * 0.45);
        engine.playerJumpLandingVisual = {
            startTime: Date.now(),
            duration: 180,
            impact: 0.9,
            baseScale: new THREE.Vector3(1, 1, 1)
        };
        engine.applyPlayerJumpVisuals();
        expect(engine.player.mesh.scale.y).toBeLessThan(1);

        engine.playerJumpLandingVisual.startTime = Date.now() - 250;
        engine.applyPlayerJumpVisuals();
        expect(engine.player.mesh.scale.x).toBeCloseTo(1, 5);
        expect(engine.player.mesh.scale.y).toBeCloseTo(1, 5);
    });

    test('jump style profile varies by class identity', () => {
        const engine = createEngineHarness();
        engine.player.constructor = { name: 'Wizard' };
        const wizardStyle = engine.getJumpStyleProfile(engine.player);

        engine.player.constructor = { name: 'Fighter' };
        const fighterStyle = engine.getJumpStyleProfile(engine.player);

        expect(wizardStyle.flip).toBeLessThan(fighterStyle.flip);
        expect(wizardStyle.roll).toBeGreaterThan(fighterStyle.roll);
        expect(wizardStyle.stretch).toBeGreaterThan(fighterStyle.stretch);
    });

    test('jump landing triggers a dust-ring impact effect', () => {
        const engine = createEngineHarness();
        const destination = new THREE.Vector3(20, 0, 0);

        expect(engine.startPlayerJump(destination)).toBe(true);
        const duration = engine.playerJumpState.duration;

        engine.updatePlayerJump(duration);

        expect(engine.spawnTransientEffect).toHaveBeenCalledWith(
            'jump_land',
            expect.objectContaining({ x: 20, y: 0, z: 0 }),
            0xd8d2c4,
            expect.objectContaining({ impact: 0.9, className: 'Object' })
        );
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
