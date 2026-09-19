import { test, expect } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld } from './helpers.js';

// Mutation QA is opt-in and loopback-only, with two newly created disposable
// accounts supplied by the Go fixture. Never aim this route at the live game.
test.use({ trace: 'off', screenshot: 'off', video: 'off' });
test('confirmed administration controls save grants and transition both rendered players', async ({ page, browser, baseURL }) => {
    test.skip(process.env.EIDOLON_E2E_ADMIN_DISPOSABLE !== '1', 'Requires disposable administration fixture');
    test.setTimeout(180_000);
    page.setDefaultTimeout(15_000);
    expect(new URL(baseURL).hostname).toBe('127.0.0.1');
    expect(new URL(process.env.EIDOLON_E2E_WS_URL).hostname).toBe('127.0.0.1');
    const operator = credentialsFromEnvironment(), member = credentialsFromEnvironment('_SECONDARY');
    const context = await browser.newContext({ baseURL });
    const observer = await context.newPage();
    const failures = collectBrowserFailures(page, baseURL);
    const observerFailures = collectBrowserFailures(observer, baseURL);
    try {
        await loginAndEnterWorld(page, operator);
        await loginAndEnterWorld(observer, member);
        await page.keyboard.press('Escape');
        await page.locator('#btn-administration').click();
        const dialog = page.getByRole('dialog', { name: 'Administration', exact: true });
        await expect(dialog).toBeVisible();
        await expect(dialog.locator('li').filter({ hasText: member.username })).toHaveCount(1);
        await dialog.locator('li').filter({ hasText: member.username }).getByRole('button', { name: 'Select for operation' }).click();
        const controls = dialog.locator('.administration-operations');
        await expect(controls.getByLabel('Target account', { exact: true })).toHaveValue(member.username);
        const goldBefore = await observer.evaluate(() => window.game.player.gold);
        const confirm = async () => {
            await controls.getByLabel('Reason', { exact: true }).fill('Disposable rendered administration verification');
            await controls.getByRole('button', { name: 'Review change', exact: true }).click();
            await expect(controls.getByRole('button', { name: 'Confirm change', exact: true })).toBeFocused();
            await controls.getByRole('button', { name: 'Confirm change', exact: true }).click();
            await expect.poll(() => page.evaluate(() => window.game.uiManager.admin.operations.operation === null)).toBe(true);
        };
        await controls.getByLabel('Gold amount', { exact: true }).fill('123');
        await confirm();
        await expect(controls.locator('[data-result]')).toContainText('Granted 123 Gold.');
        await expect.poll(() => observer.evaluate(() => window.game.player.gold)).toBe(goldBefore + 123);

        await controls.getByRole('combobox', { name: 'Operation', exact: true }).selectOption('item');
        await controls.getByRole('combobox', { name: 'Item', exact: true }).selectOption('iron-sword');
        await controls.getByRole('combobox', { name: 'Rarity', exact: true }).selectOption('Rare');
        await controls.getByLabel('Level', { exact: true }).fill('30');
        await controls.getByLabel('Quantity', { exact: true }).fill('2');
        await confirm();
        await expect(controls.locator('[data-result]')).toContainText('Created 2');
        await expect.poll(() => observer.evaluate(() => window.game.player.inventory.filter(item => item?.rarity?.name === 'Rare' && item?.level === 30).length)).toBe(2);

        for (const mode of ['to-player', 'bring-player', 'town']) {
            const moved = mode === 'to-player' ? page : observer;
            const before = await moved.evaluate(() => window.game.movementNetworkState?.recoveryContext);
            await controls.getByRole('combobox', { name: 'Operation', exact: true }).selectOption(mode);
            await confirm();
            await expect(controls.locator('[data-result]')).toContainText('Teleported character');
            await expect.poll(() => moved.evaluate(() => window.game.movementNetworkState?.recoveryContext)).not.toBe(before);
            await expect.poll(() => moved.evaluate(() => {
                const game = window.game, player = game.player;
                return Boolean(player.mesh?.visible && player.mesh.parent && game.currentInstanceType === 'overworld' &&
                    Number.isFinite(player.position.x) && Number.isFinite(player.position.z) && game.network.socket.readyState === WebSocket.OPEN);
            })).toBe(true);
        }
        await dialog.getByRole('button', { name: 'Close administration' }).click();
        await expect(dialog).toBeHidden();
        await observer.keyboard.press('Escape');
        await expect.poll(() => observer.evaluate(() => window.game.uiManager.admin.pending === null)).toBe(true);
        await expect(observer.locator('#btn-administration')).toBeHidden();
        expect(failures).toEqual([]);
        expect(observerFailures).toEqual([]);
    } finally {
        await context.close();
    }
});
