import { expect, test } from '@playwright/test';
import { collectBrowserFailures, openGame } from './helpers.js';

for (const width of [1280, 390]) test(`${width}px: incompatible server offers reload before world entry`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 844 });
    const failures = collectBrowserFailures(page, baseURL);
    let current = false, joins = 0;
    await page.routeWebSocket(/\/ws(?:\?|$)/, socket => socket.onMessage(data => {
        const packet = JSON.parse(data);
        if (packet.type === 'join') joins++;
        if (packet.type === 'login') socket.send(JSON.stringify({ type: 'login_success', payload: {
            hasCharacter: true, characterType: 'Fighter',
            ...(current ? { gameplayProtocol: 'stationary-actions-roofs-v1' } : {})
        } }));
    }));
    const login = async () => {
        await page.locator('#auth-username').fill('update-fixture');
        await page.locator('#auth-password').fill('disposable-ui-only');
        await page.locator('#btn-login').click();
    };
    await openGame(page);
    await login();
    await expect(page.locator('#auth-status')).toContainText('Reload this page');
    await expect(page.locator('#play-container')).toBeHidden();
    const reload = page.getByRole('button', { name: 'Reload game', exact: true });
    await expect(reload).toBeVisible();
    await expect(reload).toBeFocused();
    expect(joins).toBe(0);
    expect(await page.evaluate(() => Boolean(window.game))).toBe(false);
    // A real navigation, with no forced reload before the player requests it.
    current = true;
    await Promise.all([page.waitForEvent('domcontentloaded'), reload.click()]);
    await expect(page.locator('html')).toHaveAttribute('data-eidolon-ready', 'true');
    await login();
    await expect(page.locator('#btn-play-character')).toBeVisible();
    await expect(page.locator('#session-reload-game')).toHaveCount(0);
    expect(joins).toBe(0);
    expect(failures).toEqual([]);
});
