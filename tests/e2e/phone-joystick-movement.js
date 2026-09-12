import { expect } from '@playwright/test';
import { phoneJoystickDirection } from '../phoneJoystickDirection.js';

// Hold the actual on-screen stick, then release it after measured forward
// progress. No keyboard fallback, pointer interaction, forced movement or hit.
export async function moveByPhoneJoystick(page, x, z) {
    const direction = phoneJoystickDirection(x, z), distance = Math.hypot(x, z);
    const bounds = await page.locator('#joystick-zone').boundingBox();
    expect(bounds).not.toBeNull();
    const before = await page.evaluate(() => {
        const g = window.game, p = g.player;
        return { x: p.position.x, z: p.position.z, hp: p.stats.hp, instance: g.currentInstanceId, mobile: g.isMobile };
    });
    expect(before.mobile).toBe(true); expect(before.hp).toBeGreaterThan(0);
    const stick = { id: 41, x: bounds.x + bounds.width / 2 + 30 * direction.x,
        y: bounds.y + bounds.height / 2 + 30 * direction.y };
    const cdp = await page.context().newCDPSession(page);
    try {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [stick] });
        await expect.poll(() => page.evaluate(({ before, x, z, distance }) => {
            const g = window.game, p = g.player;
            if (p.state === 'DEAD' || p.stats.hp <= 0 || g.currentInstanceId !== before.instance) {
                throw new Error('Joystick movement must remain living in the same instance');
            }
            return ((p.position.x - before.x) * x + (p.position.z - before.z) * z) / distance;
        }, { before, x, z, distance }), { intervals: [25, 50], timeout: 5_000 }).toBeGreaterThan(distance * .75);
    } finally {
        try {
            if (!page.isClosed()) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        } finally { await cdp.detach(); }
    }
    await expect.poll(() => page.evaluate(() => window.game.inputManager.joystickVector.lengthSq())).toBe(0);
}
