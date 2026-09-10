import * as THREE from 'three';
import { projectGroundOffsetInPage } from './groundInputProjection.js';

beforeEach(() => {
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, .1, 1000);
    camera.position.set(20015, 40, 19623);
    camera.lookAt(20015, 0, 19583);
    camera.updateMatrixWorld(true);
    window.game = { player: { position: new THREE.Vector3(20015.826, .5, 19583.042) },
        renderSystem: { camera }, inputManager: { groundPlane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0) } };
    document.elementFromPoint = () => ({ tagName: 'CANVAS' });
});
afterEach(() => { delete window.game; delete document.elementFromPoint; });

function clickedWorld(screen) {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(screen.x / window.innerWidth * 2 - 1,
        1 - screen.y / window.innerHeight * 2), window.game.renderSystem.camera);
    return ray.ray.intersectPlane(window.game.inputManager.groundPlane, new THREE.Vector3());
}

test.each([0, .5, 4])('click resolves the exact planned ground vector at actor height %s', height => {
    window.game.player.position.y = height;
    const before = window.game.player.position.clone();
    const screen = projectGroundOffsetInPage({ deltaX: -8.919, deltaZ: 1.201, allowScaling: false });
    expect(screen.canvas).toBe(true);
    const world = clickedWorld(screen);
    expect(world.x).toBeCloseTo(before.x - 8.919, 7);
    expect(world.z).toBeCloseTo(before.z + 1.201, 7);
    expect(world.y).toBe(0);
    expect(window.game.player.position.equals(before)).toBe(true);
});

test('old elevated projection demonstrably aimed away from the planned floor point', () => {
    const p = window.game.player.position.clone().add(new THREE.Vector3(-8.919, 0, 1.201));
    const projected = p.clone().project(window.game.renderSystem.camera);
    const clicked = clickedWorld({ x: (projected.x + 1) * window.innerWidth / 2,
        y: (1 - projected.y) * window.innerHeight / 2 });
    expect(Math.hypot(clicked.x - p.x, clicked.z - p.z)).toBeGreaterThan(.4);
});

test('strict checked paths never shrink silently to a different destination', () => {
    const strict = projectGroundOffsetInPage({ deltaX: 150, deltaZ: 0, allowScaling: false });
    expect(strict.canvas).toBe(false);
    expect(strict.scale).toBe(1);
    const fallback = projectGroundOffsetInPage({ deltaX: 150, deltaZ: 0 });
    expect(fallback.canvas).toBe(true);
    expect(fallback.scale).toBeLessThan(1);
});
