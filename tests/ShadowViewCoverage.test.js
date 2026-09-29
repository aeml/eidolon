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
        const shadow = new THREE.OrthographicCamera(bounds.left, bounds.right, bounds.top, bounds.bottom, 1, 1400);
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
        for (const edge of Object.values(bounds)) {
            expect(Math.abs(edge % 16)).toBe(0);
            expect(Math.abs(edge)).toBeLessThan(280);
        }
        const squareSide = Math.max(...Object.values(bounds).map(Math.abs)) * 2;
        expect((bounds.right - bounds.left) * (bounds.top - bounds.bottom)).toBeLessThan(squareSide ** 2 * .8);
    });

    test('widens for maximum zoom and ultrawide view rather than clipping shadows', () => {
        const normal = new THREE.OrthographicCamera(-23, 23, 15, -15);
        const wide = new THREE.OrthographicCamera(-150, 150, 30, -30);
        const a = getShadowViewBounds(normal, eye, sun), b = getShadowViewBounds(wide, eye, sun);
        expect(b.right - b.left).toBeGreaterThan(a.right - a.left);
    });
});
