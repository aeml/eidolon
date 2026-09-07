import { expect } from '@playwright/test';

// Unlike navigation's projectGroundOffset, a cast inspection must not silently
// shorten an off-screen vector. Reproject the exact Y=0 point while the camera
// settles, then verify what the production input ray actually sees.
export async function aimAtGroundPoint(page, destination) {
    let screen;
    let observation;
    try {
        await expect.poll(async () => {
        screen = await page.evaluate(({ x, z }) => {
            const game = window.game;
            const point = game.player.position.clone().set(x, 0, z).project(game.renderSystem.camera);
            // MouseEvent coordinates are integer CSS pixels. Select the nearest
            // pixel and compare with that pixel's ground ray, not an impossible
            // fractional-pixel destination (especially at maximum zoom-out).
            const sx = Math.round((point.x + 1) * window.innerWidth / 2);
            const sy = Math.round((1 - point.y) * window.innerHeight / 2);
            const ray = new game.inputManager.raycaster.constructor();
            ray.setFromCamera(game.inputManager.mouse.clone().set(sx / innerWidth * 2 - 1,
                1 - sy / innerHeight * 2), game.renderSystem.camera);
            const ground = ray.ray.intersectPlane(game.inputManager.groundPlane, game.player.position.clone());
            return { x: sx, y: sy, ground: ground ? { x: ground.x, z: ground.z } : null,
                canvas: Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1 &&
                Math.abs(point.z) <= 1 && document.elementFromPoint(sx, sy)?.tagName === 'CANVAS' };
        }, destination);
        if (!screen.canvas || !screen.ground) return false;
        await page.mouse.move(screen.x, screen.y);
        observation = await page.evaluate(({ x, z }) => {
            const game = window.game;
            const point = game.inputManager.getGroundIntersection();
            return { point: point ? { x: point.x, z: point.z } : null,
                distance: point ? Math.hypot(point.x - x, point.z - z) : null,
                hovered: game.hoveredEntity?.constructor?.name,
                clear: !game.hoveredEntity || game.hoveredEntity === game.player };
        }, screen.ground);
        return observation.distance !== null && observation.distance < .025 && observation.clear;
    }, { timeout: 10_000, message: 'The real cursor must aim at the exact unshortened ground point' }).toBe(true);
    } catch (error) {
        throw new Error(`Ground aim failed: ${JSON.stringify({ destination, screen, observation })}`, { cause: error });
    }
    return screen;
}
