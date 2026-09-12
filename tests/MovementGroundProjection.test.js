import { jest } from '@jest/globals';
import * as THREE from 'three';
import { projectMovementGroundOffset } from './movementGroundProjection.js';

const original = { width: window.innerWidth, height: window.innerHeight, hit: document.elementFromPoint };
function fixture(zoom, width = 1280, height = 720) {
    window.innerWidth = width; window.innerHeight = height;
    document.elementFromPoint = jest.fn(() => ({ tagName: 'CANVAS' }));
    const position = new THREE.Vector3(-1.25, 0, 200);
    const camera = new THREE.OrthographicCamera(-zoom * width / height, zoom * width / height, zoom, -zoom, .1, 2000);
    camera.position.copy(position).addScalar(100); camera.lookAt(position); camera.updateMatrixWorld(true);
    window.game = { player: { position }, renderSystem: { camera } };
    return { position, camera };
}
function groundDistance(x, y) {
    const ray = new THREE.Raycaster(), game = window.game;
    ray.setFromCamera(new THREE.Vector2(x / window.innerWidth * 2 - 1, 1 - y / window.innerHeight * 2), game.renderSystem.camera);
    return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3()).distanceTo(game.player.position);
}
afterEach(() => {
    delete window.game; window.innerWidth = original.width; window.innerHeight = original.height;
    document.elementFromPoint = original.hit;
});

test('the observed 150-degree fractional projection truncates beyond the dead zone', () => {
    const { position, camera } = fixture(15), angle = 150 * Math.PI / 180;
    const target = position.clone().add(new THREE.Vector3(Math.cos(angle) * .05, 0, Math.sin(angle) * .05));
    const screen = target.clone().project(camera);
    expect(groundDistance(Math.floor((screen.x + 1) * 640), Math.floor((1 - screen.y) * 360))).toBeCloseTo(.11023963796103939, 10);
    const corrected = projectMovementGroundOffset({ deltaX: Math.cos(angle) * .05, deltaZ: Math.sin(angle) * .05 });
    expect(corrected).toMatchObject({ x: 639, y: 360, canvas: true });
    expect(groundDistance(corrected.x, corrected.y)).toBeCloseTo(1 / 24, 10);
});

test.each([5, 15, 30].flatMap(zoom => [[1280, 720], [1920, 1080]].map(([width, height]) => ({ zoom, width, height }))))(
    'all 72 sub-arrival directions remain within the dead zone at zoom$zoom $width x $height', ({ zoom, width, height }) => {
        fixture(zoom, width, height);
        for (let index = 0; index < 72; index++) {
            const angle = index * Math.PI / 36;
            const point = projectMovementGroundOffset({ deltaX: Math.cos(angle) * .05, deltaZ: Math.sin(angle) * .05 });
            expect(Number.isInteger(point.x) && Number.isInteger(point.y)).toBe(true);
            expect(point.canvas).toBe(true);
            expect(groundDistance(point.x, point.y)).toBeLessThan(.1);
        }
    });

test('missing scene and obstructed screen coordinates cannot become valid clicks', () => {
    expect(projectMovementGroundOffset({ deltaX: 0, deltaZ: 0 })).toBeNull();
    fixture(15); document.elementFromPoint = () => ({ tagName: 'BUTTON' });
    expect(projectMovementGroundOffset({ deltaX: 0, deltaZ: 0 }).canvas).toBe(false);
});
