import { expect } from '@playwright/test';

// Unlike navigation's projectGroundOffset, a cast inspection must not silently
// shorten an off-screen vector. Reproject the exact Y=0 point while the camera
// settles, then verify what the production input ray actually sees.
export async function aimAtGroundPoint(page, destination) {
    let screen;
    let observation;
    try { await expect.poll(async () => {
        screen = await page.evaluate(({ x, z }) => {
            const game = window.game;
            const point = game.player.position.clone().set(x, 0, z).project(game.renderSystem.camera);
            const sx = (point.x + 1) * window.innerWidth / 2;
            const sy = (1 - point.y) * window.innerHeight / 2;
            return { x: sx, y: sy, canvas: Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1 &&
                Math.abs(point.z) <= 1 && document.elementFromPoint(sx, sy)?.tagName === 'CANVAS' };
        }, destination);
        if (!screen.canvas) return false;
        await page.mouse.move(screen.x, screen.y);
        observation = await page.evaluate(({ x, z }) => {
            const game = window.game;
            const point = game.inputManager.getGroundIntersection();
            return { point: point ? { x: point.x, z: point.z } : null,
                distance: point ? Math.hypot(point.x - x, point.z - z) : null,
                hovered: game.hoveredEntity?.constructor?.name,
                clear: !game.hoveredEntity || game.hoveredEntity === game.player };
        }, destination);
        return observation.distance !== null && observation.distance < .075 && observation.clear;
    }, { timeout: 10_000, message: 'The real cursor must aim at the exact unshortened ground point' }).toBe(true);
    } catch (error) {
        throw new Error(`Ground aim failed: ${JSON.stringify({ destination, screen, observation })}`, { cause: error });
    }
    return screen;
}
