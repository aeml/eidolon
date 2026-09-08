import { expect } from '@playwright/test';
import { projectEntity } from './helpers.js';

export async function walkToIlyra(page, context) {
    const cdp = await context.newCDPSession(page);
    const box = await page.locator('#joystick-zone').boundingBox();
    let started = false;
    try {
        await expect.poll(async () => {
            const delta = await page.evaluate(() => {
                const player = window.game.player.position;
                return { x: 17 - player.x, z: 215 - player.z };
            });
            if (Math.hypot(delta.x, delta.z) < 1.5) return true;
            const jx = delta.x - delta.z, jy = delta.x + delta.z;
            const length = Math.hypot(jx, jy);
            await cdp.send('Input.dispatchTouchEvent', { type: started ? 'touchMove' : 'touchStart', touchPoints: [
                { id: 81, x: box.x + box.width / 2 + 32 * jx / length, y: box.y + box.height / 2 + 32 * jy / length }
            ] });
            started = true;
            return false;
        }, { timeout: 20_000, intervals: [100] }).toBe(true);
    } finally {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await cdp.detach();
    }
    await expect.poll(() => page.evaluate(() => window.game.inputManager.joystickVector.lengthSq())).toBe(0);
    const point = await projectEntity(page, 'story-wizard-1');
    expect(point?.visible, 'Ilyra is visible at the default phone camera framing').toBe(true);
    await page.touchscreen.tap(point.x, point.y);
    await expect(page.locator('#quest-window')).toBeVisible();
}
