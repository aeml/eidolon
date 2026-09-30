import * as THREE from 'three';
import { getShadowViewBounds } from '../src/core/ShadowViewCoverage.js';

describe('camera-fitted sun coverage', () => {
    const eye = new THREE.Vector3(100, 100, 100);
    const sun = new THREE.Vector3(-320, 500, 260);
    test.each([5, 15, 30].flatMap(zoom => [.46, 1.52, 2.4].map(aspect => [zoom, aspect])))(
        'covers all viewport corners and tall receivers at zoom %s / aspect %s', (zoom, aspect) => {
        const focus = new THREE.Vector3(2100, 0, -1400);
        const lag = new THREE.Vector3(3, 0, -4);
        const camera = new THREE.OrthographicCamera(-zoom * aspect, zoom * aspect, zoom, -zoom, .1, 2000);
        camera.position.copy(focus).add(lag).add(eye);
        camera.lookAt(focus.clone().add(lag)); camera.updateMatrixWorld(true);
        const bounds = getShadowViewBounds(camera, eye, sun, lag);
        expect(bounds.far).toBeGreaterThan(1);
        expect(bounds.far).toBeLessThan(1000);
        const shadow = new THREE.OrthographicCamera(bounds.left, bounds.right, bounds.top, bounds.bottom, 1, bounds.far);
        shadow.position.copy(focus).add(sun); shadow.lookAt(focus); shadow.updateMatrixWorld(true);
        for (const x of [-1, 1]) for (const y of [-1, 1]) for (const height of [-8, 0, 32, 64]) {
            const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(x, y), camera);
            const receiver = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -height), new THREE.Vector3());
            // Also verify a tall off-screen caster on the same incoming sun ray.
            for (const advance of [0, 60]) {
                const point = receiver.clone().addScaledVector(sun.clone().normalize(), advance).project(shadow);
                expect(Math.abs(point.x)).toBeLessThan(1);
                expect(Math.abs(point.y)).toBeLessThan(1);
                expect(Math.abs(point.z)).toBeLessThan(1);
            }
        }
        const edges = [bounds.left, bounds.right, bounds.bottom, bounds.top];
        for (const edge of edges) {
            expect(Math.abs(edge % 16)).toBe(0);
            expect(Math.abs(edge)).toBeLessThan(280);
        }
        const squareSide = Math.max(...edges.map(Math.abs)) * 2;
        expect((bounds.right - bounds.left) * (bounds.top - bounds.bottom)).toBeLessThan(squareSide ** 2 * .8);
    });

    test('widens for maximum zoom and ultrawide view rather than clipping shadows', () => {
        const normal = new THREE.OrthographicCamera(-23, 23, 15, -15);
        const wide = new THREE.OrthographicCamera(-150, 150, 30, -30);
        const a = getShadowViewBounds(normal, eye, sun), b = getShadowViewBounds(wide, eye, sun);
        expect(b.right - b.left).toBeGreaterThan(a.right - a.left);
    });

    test('widens depth for zoom, viewport and camera lag rather than culling by caster distance', () => {
        const camera = new THREE.OrthographicCamera(-60, 60, 30, -30);
        camera.zoom = 30;
        const close = getShadowViewBounds(camera, eye, sun);
        camera.zoom = 5;
        const wide = getShadowViewBounds(camera, eye, sun);
        expect(wide.far).toBeGreaterThan(close.far);
        const behindSun = sun.clone().normalize().multiplyScalar(-50);
        behindSun.y = 0;
        const lagged = getShadowViewBounds(camera, eye, sun, behindSun);
        expect(lagged.far).toBeGreaterThan(wide.far);
        expect(lagged.far % 16).toBe(0);
    });

    test('keeps legacy full coverage for unsupported horizontal camera or vertical sun', () => {
        const camera = new THREE.OrthographicCamera(-23, 23, 15, -15);
        for (const [offset, light] of [[new THREE.Vector3(100, 0, 100), sun], [eye, new THREE.Vector3(0, 500, 0)]]) {
            expect(getShadowViewBounds(camera, offset, light)).toEqual({ left: -280, right: 280, bottom: -280, top: 280, far: 1400 });
        }
    });
});
