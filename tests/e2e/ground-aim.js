import { expect } from '@playwright/test';

// Unlike navigation's projectGroundOffset, a cast inspection must not silently
// shorten an off-screen vector. Reproject the exact Y=0 point while the camera
// settles, then verify what the production input ray actually sees.
export async function aimAtGroundPoint(page, destination) {
    let screen;
    await expect.poll(async () => {
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
        return page.evaluate(({ x, z }) => {
            const game = window.game;
            const point = game.inputManager.getGroundIntersection();
            return Boolean(point && Math.hypot(point.x - x, point.z - z) < .075 &&
                (!game.hoveredEntity || game.hoveredEntity === game.player));
        }, destination);
    }, { timeout: 10_000, message: 'The real cursor must aim at the exact unshortened ground point' }).toBe(true);
    return screen;
}
