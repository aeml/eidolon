import { expect } from '@playwright/test';
import { phoneJoystickDirection } from '../phoneJoystickDirection.js';

// Short real stick touches. Release is queued on the driver clock, without
// waiting for a browser evaluation or touch-start acknowledgement while moving.
// No keyboard fallback, pointer interaction, forced movement or hit.
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
    const samples = [];
    let releasePending = false;
    try {
        for (let pulse = 0; pulse < 8; pulse++) {
            // Attach rejection handling immediately; still wait for both actual
            // protocol receipts before inspecting movement or issuing a pulse.
            releasePending = true;
            const started = cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [stick] })
                .then(() => null, error => error);
            await new Promise(resolve => setTimeout(resolve, 80));
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            releasePending = false;
            const startError = await started;
            if (startError) throw startError;
            const sample = await page.evaluate(({ before, x, z, distance }) => {
                const g = window.game, p = g.player;
                return { x: p.position.x, z: p.position.z, hp: p.stats.hp, state: p.state, instance: g.currentInstanceId,
                    progress: ((p.position.x - before.x) * x + (p.position.z - before.z) * z) / distance,
                    joystick: g.inputManager.joystickVector.lengthSq(),
                    blocked: p.blockedTargetPosition ? { x: p.blockedTargetPosition.x, z: p.blockedTargetPosition.z } : null };
            }, { before, x, z, distance });
            samples.push(sample);
            expect(sample.hp).toBeGreaterThan(0); expect(sample.state).not.toBe('DEAD');
            expect(sample.instance).toBe(before.instance); expect(sample.joystick).toBe(0);
            if (sample.progress > distance * .75) return { before, samples };
        }
        throw new Error(`Joystick pulses did not reach required forward progress: ${JSON.stringify({ before, x, z, samples })}`);
    } finally {
        try {
            if (releasePending && !page.isClosed()) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        } finally { await cdp.detach(); }
    }
}
