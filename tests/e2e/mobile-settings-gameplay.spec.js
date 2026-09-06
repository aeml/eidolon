import { devices, expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld } from './helpers.js';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
    userAgent: devices['Pixel 7'].userAgent, actionTimeout: 12_000,
    trace: 'off', screenshot: 'off', video: 'off' });

test('phone settings change readable text and preferences without changing world framing', async ({ page, baseURL }) => {
    const credentials = credentialsFromEnvironment();
    test.skip(!credentials.username || !credentials.password || process.env.EIDOLON_E2E_REGISTER !== '1', 'Requires a fresh disposable character');
    test.setTimeout(120_000);
    const failures = collectBrowserFailures(page, baseURL);
    await page.goto('/'); await page.evaluate(() => localStorage.setItem('eidolon.uiScale', '85'));
    await loginAndEnterWorld(page, credentials);
    expect(await page.evaluate(() => window.game.uiManager.getBrightnessLevel())).toBe(50);
    expect(await page.evaluate(() => window.game.renderSystem.brightnessLevel)).toBe(50);
    const before = await page.evaluate(() => ({ zoom: window.game.renderSystem.currentZoom, position: window.game.player.position.toArray() }));
    const open = async () => { await page.locator('#btn-mobile-menu').tap(); await page.locator('#btn-settings').tap(); };
    const tapRange = async (id, right) => {
        const input = page.locator(`#${id}`); await input.scrollIntoViewIfNeeded();
        const box = await input.boundingBox();
        await page.touchscreen.tap(right ? box.x + box.width - 4 : box.x + 4, box.y + box.height / 2);
    };
    await open(); await tapRange('ui-scale', true); await expect(page.locator('#ui-scale')).toHaveValue('125');
    expect(await page.evaluate(() => window.game.renderSystem.currentZoom)).toBe(before.zoom);
    expect(await page.evaluate(() => localStorage.getItem('eidolon.uiScale'))).toBe('85');
    await page.locator('#graphics-quality').selectOption('low');
    expect(await page.evaluate(() => window.game.renderSystem.graphicsQuality)).toBe('low');
    await page.locator('.phone-settings-tabs').getByRole('button', { name: 'Play', exact: true }).tap();
    await page.locator('#auto-loot-enabled').scrollIntoViewIfNeeded(); await page.locator('#auto-loot-enabled').tap();
    await expect(page.locator('#auto-loot-enabled')).toBeChecked();
    await page.setViewportSize({ width: 844, height: 390 });
    await page.locator('.phone-settings-tabs').getByRole('button', { name: 'Sound', exact: true }).tap();
    await page.locator('#audio-enabled').scrollIntoViewIfNeeded(); await page.locator('#audio-enabled').tap();
    await expect(page.locator('#audio-enabled')).not.toBeChecked();
    await tapRange('audio-volume', false); await expect(page.locator('#audio-volume')).toHaveValue('0');
    await page.locator('#chat-mobile-toggle').tap();
    await expect(page.locator('#settings-screen')).not.toBeVisible(); await expect(page.locator('#esc-menu')).not.toBeVisible();
    await page.locator('#chat-input').tap(); await page.locator('#chat-input').fill('Phone settings checked.'); await page.locator('#chat-input').press('Enter');
    await expect(page.locator('#chat-messages')).toContainText('Phone settings checked.');
    await page.locator('#chat-mobile-toggle').tap();
    const after = await page.evaluate(() => ({ zoom: window.game.renderSystem.currentZoom, position: window.game.player.position.toArray() }));
    expect(after.zoom).toBe(before.zoom);
    expect(Math.hypot(after.position[0] - before.position[0], after.position[2] - before.position[2])).toBeLessThan(0.1);
    await page.reload({ waitUntil: 'networkidle' }); await loginAndEnterWorld(page, credentials);
    expect(await page.evaluate(() => ({ scale: window.game.uiManager.getUiScale(), quality: window.game.renderSystem.graphicsQuality,
        audio: window.game.uiManager.getAudioEnabled(), volume: window.game.uiManager.getAudioVolume(), autoLoot: window.game.uiManager.getAutoLootEnabled() })))
        .toEqual({ scale: 1.25, quality: 'low', audio: false, volume: 0, autoLoot: true });
    expect(await page.evaluate(() => localStorage.getItem('eidolon.uiScale'))).toBe('85');
    console.log('[phone-settings] touch changes, unchanged zoom/position, usable chat and persisted preferences verified');
    expect(failures, failures.join('\n')).toEqual([]);
});
