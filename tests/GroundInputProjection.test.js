import * as THREE from 'three';
import { planVisibleGroundStepInPage, projectGroundOffsetInPage } from './groundInputProjection.js';

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

test('visible-prefix planning preserves direction before strict movement and arrival are constructed', () => {
    const step = { dx: -12, dz: 0 };
    const full = projectGroundOffsetInPage({ deltaX: step.dx, deltaZ: step.dz, allowScaling: false });
    document.elementFromPoint = x => ({ tagName: x < full.x + 1 ? 'BUTTON' : 'CANVAS' });
    const visible = planVisibleGroundStepInPage(step);
    expect(visible).toEqual({ dx: -9, dz: 0 });
    expect(step).toEqual({ dx: -12, dz: 0 });
    const strict = projectGroundOffsetInPage({ deltaX: visible.dx, deltaZ: visible.dz, allowScaling: false });
    expect(strict).toMatchObject({ canvas: true, scale: 1 });
    expect(clickedWorld(strict).x).toBeCloseTo(window.game.player.position.x - 9, 7);
});

test('hidden ground, invalid vectors and sub-unit steps cannot become movement input', () => {
    expect(planVisibleGroundStepInPage({ dx: .5, dz: 0 })).toBeNull();
    expect(planVisibleGroundStepInPage({ dx: NaN, dz: 3 })).toBeNull();
    expect(planVisibleGroundStepInPage(null)).toBeNull();
    document.elementFromPoint = () => ({ tagName: 'BUTTON' });
    expect(planVisibleGroundStepInPage({ dx: 12, dz: 0 })).toBeNull();
});
