import { expect, test } from '@playwright/test';
import { measureJumpWallClock } from './jump-clock-observation.js';

// Native frame-loop/render proof with the supplied Fighter, without a server
// or populated world. Authoritative packet handling is covered separately.
test('slow native frames preserve 1.3-second jump travel', async ({ page }, testInfo) => {
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    const result = await page.evaluate(measureJumpWallClock);
    await testInfo.attach('jump-wall-clock', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
    expect(result.errors).toEqual([]);
    for (const sample of result.samples) {
        expect(sample.elapsedMs).toBeGreaterThanOrEqual(1300);
        expect(sample.elapsedMs).toBeLessThan(1550);
        expect(sample.positionError).toBeLessThan(0.01);
        expect(sample.renderError).toBeLessThan(0.01);
    }
});
