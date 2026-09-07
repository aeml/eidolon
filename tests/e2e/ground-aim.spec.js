import { expect, test } from '@playwright/test';
import { aimAtGroundPoint } from './ground-aim.js';

test('exact cast aiming tolerates browser pixel quantization without shortening the destination', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const destination = await page.evaluate(async () => {
        const THREE = await import('three');
        const { InputManager } = await import('/src/core/InputManager.js');
        const canvas = document.createElement('canvas');
        canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:99999;background:#14202b';
        document.body.appendChild(canvas);
        const aspect = innerWidth / innerHeight;
        const camera = new THREE.OrthographicCamera(-30 * aspect, 30 * aspect, 30, -30, .1, 2000);
        camera.position.set(20100, 100.5, 20100);
        camera.lookAt(20000, .5, 20000); camera.updateMatrixWorld(true);
        window.game = { player: { position: new THREE.Vector3(20000, .5, 20000) },
            renderSystem: { camera }, inputManager: new InputManager(camera, new THREE.Scene(), canvas) };
        // A fractional pixel near its upper boundary exposes MouseEvent's
        // integer coordinates. Select it by geometry, not a private game action.
        const ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2(641.99 / innerWidth * 2 - 1,
            1 - 361.99 / innerHeight * 2), camera);
        const target = ray.ray.intersectPlane(window.game.inputManager.groundPlane, new THREE.Vector3());
        return { x: target.x, z: target.z };
    });
    await aimAtGroundPoint(page, destination);
    const distance = await page.evaluate(({ x, z }) => {
        const actual = window.game.inputManager.getGroundIntersection();
        return Math.hypot(actual.x - x, actual.z - z);
    }, destination);
    expect(distance).toBeLessThan(.15);
});
