import { expect, test } from '@playwright/test';
import {
    assertWebSocketReachable,
    collectBrowserFailures,
    getJSONWithRetry,
    openGame
} from './helpers.js';

test('login project credit stays readable and keyboard-accessible on desktop and mobile', async ({ page }) => {
    await openGame(page);
    const note = page.locator('#login-panel .auth-project-note');
    const link = note.getByRole('link', { name: 'View on GitHub (opens in a new tab)' });
    for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 667 }]) {
        await page.setViewportSize(viewport);
        await expect(note).toContainText('Eidolon is an open-source project.');
        await page.locator('#btn-register').focus();
        await page.keyboard.press('Tab');
        await expect(link).toBeFocused();
        await expect(link).toBeInViewport();
        await expect(link).toHaveAttribute('href', 'https://github.com/aeml/eidolon');
        await expect(link).toHaveAttribute('target', '_blank');
        const bounds = await note.boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
        await expect(link).toHaveCSS('outline-style', 'solid');
    }
});

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
