import { devices, expect, test } from '@playwright/test';
import { collectBrowserFailures, openGame } from './helpers.js';

test.use({ hasTouch: true, isMobile: true, userAgent: devices['Pixel 7'].userAgent });

for (const [width, height] of [[390, 844], [844, 390], [568, 320]]) {
    test(`${width}x${height}: status details fit their content and leave room for the encounter`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height });
        await openGame(page);
        await page.evaluate(async () => {
            const { UIManager } = await import('/src/ui/UIManager.js');
            const { Minimap } = await import('/src/ui/Minimap.js');
            document.body.classList.add('mobile-mode');
            document.getElementById('start-screen').style.display = 'none';
            const ui = new UIManager(true); ui.showHUD(); ui.toggleChat(true);
            const effects = [], minimap = new Minimap();
            minimap.setGameEngine({ isMobile: true, player: { id: 'compact-status' }, getActiveBuffs: () => effects });
            minimap._renderBuffList();
            window.__compactStatus = { effects, minimap, ui };
        });
        const panel = page.locator('#phone-status-panel');
        await page.locator('#btn-phone-status').tap();
        await expect(panel).toBeVisible();
        const empty = await panel.boundingBox();
        const content = await panel.evaluate(root => {
            const header = root.querySelector('.phone-status-header');
            const message = root.querySelector('.phone-status-empty');
            return header.getBoundingClientRect().height + message.getBoundingClientRect().height + 24;
        });
        expect(empty.height, 'an empty reading panel must not reserve a large blank window').toBeLessThanOrEqual(content);
        await page.evaluate(() => {
            const q = window.__compactStatus;
            q.effects.push({ id: 'arcane_shield', name: 'Arcane Shield', remainingSeconds: 19.5,
                detail: '834 shield remaining', isDebuff: false });
            q.minimap._renderBuffList();
        });
        await expect(panel.getByText('834 shield remaining', { exact: true })).toBeVisible();
        const one = await panel.boundingBox();
        if (height > width) expect(one.y + one.height, 'one shield must not obscure the center of portrait combat').toBeLessThan(height / 2);
        await page.locator('#btn-close-phone-status').tap();
        await expect(panel).toBeHidden();
        await page.locator('#btn-phone-status').tap();
        await page.screenshot({ path: testInfo.outputPath(`compact-status-${width}.png`) });
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
