import { expect, test } from '@playwright/test';
import {
    assertWebSocketReachable,
    collectBrowserFailures,
    openGame,
    productionWebSocketURL
} from './helpers.js';

test('anonymous release surface, runtime dependencies, and server are healthy', async ({ page, request, baseURL }) => {
    const failures = collectBrowserFailures(page, baseURL);
    const response = await openGame(page, { waitUntil: 'networkidle' });

    expect(response?.status()).toBe(200);
    await expect(page.locator('.start-version-row__label')).toContainText('Alpha');

    expect(await page.evaluate(() => typeof globalThis.protobuf)).toBe('object');
    const vendorManifest = await request.get(`${baseURL}/vendor/manifest.json`);
    expect(vendorManifest.ok()).toBe(true);
    expect(await vendorManifest.json()).toMatchObject({
        protobufjs: '8.7.1',
        three: '0.181.2'
    });

    await page.locator('#login-patch-notes-link').click();
    await expect(page.locator('#patch-notes-screen')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#patch-notes-screen')).toBeHidden();

    await assertWebSocketReachable(page, process.env.EIDOLON_E2E_WS_URL || productionWebSocketURL);

    const expectedCommit = process.env.EIDOLON_EXPECTED_COMMIT;
    if (expectedCommit) {
        const releaseResponse = await request.get(`${baseURL}/release.json?expected=${expectedCommit}`, {
            headers: { 'Cache-Control': 'no-cache' }
        });
        expect(releaseResponse.ok()).toBe(true);
        expect((await releaseResponse.json()).commit).toBe(expectedCommit);

        const healthURL = process.env.EIDOLON_E2E_HEALTH_URL;
        expect(healthURL, 'EIDOLON_E2E_HEALTH_URL is required with EIDOLON_EXPECTED_COMMIT').toBeTruthy();
        const healthResponse = await request.get(`${healthURL}?expected=${expectedCommit}`, {
            headers: { 'Cache-Control': 'no-cache' }
        });
        expect(healthResponse.ok()).toBe(true);
        const health = await healthResponse.json();
        expect(health.status).toBe('ok');
        expect(health.commit).toBe(expectedCommit);
        expect(health.database).toBe('ready');
    }

    expect(failures, failures.join('\n')).toEqual([]);
});
