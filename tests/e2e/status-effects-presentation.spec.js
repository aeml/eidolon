import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures, openGame } from './helpers.js';

for (const [width, height] of [[1280, 844], [1024, 768]]) {
    test(`${width}x${height}: status symbols and keyboard details survive timer updates`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height });
        await openGame(page);
        await page.evaluate(async () => {
            const { UIManager } = await import('/src/ui/UIManager.js');
            const { Minimap } = await import('/src/ui/Minimap.js');
            document.getElementById('start-screen').style.display = 'none';
            const ui = new UIManager(false); ui.showHUD();
            const buffs = [{ id: 'iron_fortress', name: 'Iron Fortress', remainingSeconds: 23.4,
                detail: '20% less damage · +50% armor · -20% movement speed' }];
            const minimap = new Minimap();
            minimap.setGameEngine({ player: { id: 'isolated-status-fixture' }, getActiveBuffs: () => buffs });
            minimap._renderBuffList();
            window.__statusPresentation = { minimap, buffs, ui };
        });
        const list = page.locator('#minimap-buff-list'), first = list.locator('button').first();
        expect(await first.locator('svg').count()).toBe(1);
        const one = await list.boundingBox();
        expect(one.width, 'one effect must not reserve an empty three-column panel').toBeLessThanOrEqual(64);
        expect((await first.locator('svg').boundingBox()).width).toBeGreaterThanOrEqual(24);
        await first.focus();
        const tooltip = page.getByRole('tooltip');
        await expect(tooltip).toContainText('Iron Fortress');
        await page.evaluate(() => {
            const { minimap, buffs } = window.__statusPresentation;
            window.__originalStatusButton = minimap.buffList.querySelector('button');
            buffs[0].remainingSeconds = 22.9; minimap._renderBuffList();
        });
        await expect(first).toBeFocused();
        expect(await page.evaluate(() => document.activeElement === window.__originalStatusButton)).toBe(true);
        await expect(tooltip).toContainText('22.9s');
        const bounds = await tooltip.boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.y).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
        await page.keyboard.press('Escape'); await expect(tooltip).toBeHidden();
        await expect(first).toBeFocused();
        await page.evaluate(() => {
            const { minimap, buffs } = window.__statusPresentation;
            buffs.push({ id: 'well_rested', name: 'Well Rested', remainingSeconds: 3600,
                timeLabel: '1h 00m / 2h · Resting', detail: '+10% all stats · +25% enemy-kill XP only' },
            { id: 'poison', name: 'Poisoned', remainingSeconds: 8.1, detail: '20 poison per tick', isDebuff: true });
            minimap._renderBuffList();
        });
        const rested = list.locator('[data-buff-id="well_rested"]');
        await rested.focus(); await expect(tooltip).toContainText('+25% enemy-kill XP only');
        await page.keyboard.press('Tab');
        await expect(list.locator('[data-buff-id="poison"]')).toBeFocused();
        await expect(tooltip).toContainText('20 poison per tick');
        await page.evaluate(() => {
            const { minimap, buffs } = window.__statusPresentation;
            buffs.splice(2, 1); minimap._renderBuffList();
        });
        await expect(tooltip).toBeHidden();
        expect(await list.locator('button').count()).toBe(2);
        await page.screenshot({ path: testInfo.outputPath('status-icons.png') });
        await writeFile(testInfo.outputPath('status-presentation.json'), JSON.stringify({
            viewport: { width, height }, singleEffectWidth: one.width, keyboardTooltipBounds: bounds,
            scope: 'Native isolated actual-HUD presentation, focus/countdown/expiry and font-independent SVG. No connected combat, device performance or final-art approval.'
        }, null, 2));
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
