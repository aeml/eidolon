import { expect, test } from '@playwright/test';
import {
    assertWebSocketReachable,
    collectBrowserFailures,
    getJSONWithRetry,
    openGame
} from './helpers.js';

test('anonymous release surface, runtime dependencies, and server are healthy', async ({ page, request, baseURL }) => {
    test.setTimeout(360_000);
    const failures = collectBrowserFailures(page, baseURL);
    const response = await openGame(page, { waitUntil: 'networkidle' });

    expect(response?.status()).toBe(200);
    await expect(page.locator('.start-version-row__label')).toContainText('Alpha');

    expect(await page.evaluate(() => typeof globalThis.protobuf)).toBe('object');
    const vendorManifest = await getJSONWithRetry(
        request,
        `${baseURL}/vendor/manifest.json`,
        (json) => json?.protobufjs === '8.7.1' && json?.three === '0.181.2',
        'vendor manifest'
    );
    expect(vendorManifest).toMatchObject({
        protobufjs: '8.7.1',
        three: '0.181.2'
    });

    await page.locator('#login-patch-notes-link').click();
    await expect(page.locator('#patch-notes-screen')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#patch-notes-screen')).toBeHidden();

    if (process.env.EIDOLON_E2E_WS_URL) {
        await assertWebSocketReachable(page, process.env.EIDOLON_E2E_WS_URL);
    }

    const expectedCommit = process.env.EIDOLON_EXPECTED_COMMIT;
    if (expectedCommit) {
        const release = await getJSONWithRetry(
            request,
            `${baseURL}/release.json?expected=${expectedCommit}`,
            (json) => json?.commit === expectedCommit,
            'frontend release identity'
        );
        expect(release.commit).toBe(expectedCommit);

        const healthURL = process.env.EIDOLON_E2E_HEALTH_URL;
        expect(healthURL, 'EIDOLON_E2E_HEALTH_URL is required with EIDOLON_EXPECTED_COMMIT').toBeTruthy();
        const health = await getJSONWithRetry(
            request,
            `${healthURL}?expected=${expectedCommit}`,
            (json) => json?.status === 'ok' && json?.database === 'ready' && json?.commit === expectedCommit,
            'backend health identity'
        );
        expect(health.status).toBe('ok');
        expect(health.commit).toBe(expectedCommit);
        expect(health.database).toBe('ready');
    }

    expect(failures, failures.join('\n')).toEqual([]);
});
