import { devices, expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld } from './helpers.js';
import { openPhoneStash } from './phone-stash-route.js';
import { readPhoneInventoryState } from './phone-inventory-observation.js';

test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true,
    userAgent: devices['Pixel 7'].userAgent, trace: 'off', screenshot: 'off', video: 'off' });

test('fresh phone town entry opens storage after orientation changes', async ({ page, baseURL }, testInfo) => {
    test.setTimeout(240_000);
    const credentials = credentialsFromEnvironment();
    test.skip(!credentials.username || !credentials.password, 'Requires a dedicated disposable QA character');
    const failures = collectBrowserFailures(page, baseURL);
    try {
        for (let attempt = 0; attempt < 8; attempt++) {
            await loginAndEnterWorld(page, credentials);
            await page.locator('#btn-mobile-menu').tap();
            await page.locator('#btn-recall').tap();
            await expect.poll(() => page.evaluate(() => Math.hypot(window.game.player.position.x + 1.25,
                window.game.player.position.z - 200) < 3)).toBe(true);
            const [width, height] = attempt % 2 ? [844, 390] : [390, 844];
            await page.setViewportSize({ width, height });
            await openPhoneStash(page);
            await page.locator('#btn-close-stash').tap();
            console.log(`[phone-stash-entry] ${attempt + 1}/8 ${width}x${height} passed`);
        }
        expect(failures, failures.join('\n')).toEqual([]);
    } catch (error) {
        console.log('[phone-stash-entry] failure', JSON.stringify(await readPhoneInventoryState(page)));
        if (await page.locator('#btn-mobile-attack').isVisible()) {
            await page.screenshot({ path: testInfo.outputPath('failed-stash-entry.png') });
        }
        throw error;
    }
});
