import { expect, test } from '@playwright/test';
import { measureJumpWallClock } from './jump-clock-observation.js';

// Native frame-loop/render proof with the supplied Fighter, without a server
// or populated world. Authoritative packet handling is covered separately.
test('slow native frames preserve the accepted jump duration', async ({ page }, testInfo) => {
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    const result = await page.evaluate(measureJumpWallClock);
    await testInfo.attach('jump-wall-clock', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
    expect(result.errors).toEqual([]);
    if (process.env.EIDOLON_E2E_REQUIRE_NATIVE_GPU === '1') expect(result.renderer).not.toMatch(/swiftshader|llvmpipe|software/i);
    expect(result.samples.map(sample => sample.fps)).toEqual([15, 60]);
    for (const sample of result.samples) {
        expect(sample.acceptedDurationMs).toBe(1100);
        expect(sample.elapsedMs).toBeGreaterThanOrEqual(sample.acceptedDurationMs);
        expect(sample.elapsedMs).toBeLessThan(1550);
        expect(sample.positionError).toBeLessThan(0.01);
        expect(sample.renderError).toBeLessThan(0.01);
    }
});
