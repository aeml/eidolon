import { jest } from '@jest/globals';
import * as THREE from 'three';
import { prepareGroundInputInPage } from './groundInputPreparation.js';

beforeEach(() => {
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, .1, 1000);
    camera.position.set(20015, 40, 19623); camera.lookAt(20015, 0, 19583); camera.updateMatrixWorld(true);
    window.game = { player: { position: new THREE.Vector3(20015.826, .5, 19583.042), stats: { hp: 100 },
        state: 'IDLE', radius: 1.25 }, renderSystem: { camera },
    inputManager: { groundPlane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0) },
    collisionManager: { checkCollision: jest.fn(() => null) },
    handlePrimaryClick: jest.fn(), handleServerMessage: jest.fn(), requestDungeonStatus: jest.fn() };
    document.elementFromPoint = () => ({ tagName: 'CANVAS' });
});
afterEach(() => {
    delete window.game; delete document.elementFromPoint;
    delete window.__entranceClickProbe; delete window.__entranceClickProbeInstalled;
});

test('one preparation retains origin, entire collision path and exact unscaled projection without input', () => {
    const game = window.game, origin = game.player.position.clone(), click = game.handlePrimaryClick;
    const result = prepareGroundInputInPage({ deltaX: -8.919, deltaZ: 1.201 });
    expect(result.before).toMatchObject({ x: origin.x, z: origin.z, state: 'IDLE', health: 100 });
    expect(result.clear).toBe(true); expect(result.target).toMatchObject({ canvas: true, scale: 1 });
    expect(result.target.world.x).toBeCloseTo(origin.x - 8.919, 7);
    expect(result.target.world.z).toBeCloseTo(origin.z + 1.201, 7);
    expect(result.target.world.y).toBe(0);
    expect(game.collisionManager.checkCollision).toHaveBeenCalledTimes(Math.ceil(Math.hypot(8.919, 1.201) / .25));
    expect(game.player.position.equals(origin)).toBe(true); expect(click).not.toHaveBeenCalled();
    expect(window.__entranceClickProbe.click).toBeNull();
});

test.each(['wall', 'dead', 'no-health', 'no-collision', 'invalid', 'zero'])(
    '%s cannot prepare a usable movement target', mode => {
        const game = window.game;
        if (mode === 'wall') game.collisionManager.checkCollision.mockImplementation(point => point.clone().add(new THREE.Vector3(1, 0, 0)));
        if (mode === 'dead') game.player.state = 'DEAD';
        if (mode === 'no-health') game.player.stats.hp = 0;
        if (mode === 'no-collision') delete game.collisionManager;
        const result = prepareGroundInputInPage({ deltaX: mode === 'invalid' ? NaN : mode === 'zero' ? 0 : 8, deltaZ: 0 });
        expect(result).toMatchObject({ clear: false, target: null });
    });

test('offscreen and covered projections remain unavailable rather than shrinking the checked path', () => {
    const far = prepareGroundInputInPage({ deltaX: 150, deltaZ: 0 });
    expect(far.clear).toBe(true); expect(far.target).toMatchObject({ canvas: false, scale: 1 });
    document.elementFromPoint = () => ({ tagName: 'BUTTON' });
    expect(prepareGroundInputInPage({ deltaX: 2, deltaZ: 0 }).target.canvas).toBe(false);
});
