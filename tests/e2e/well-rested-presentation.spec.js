import { expect, test } from '@playwright/test';
import { collectBrowserFailures, openGame } from './helpers.js';

for (const [width, height, mobile] of [[1280, 800, false], [390, 844, true], [568, 320, true]]) {
    test(`Well Rested bank and sanctuary explanation fit ${width}x${height}`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height });
        await openGame(page);
        await page.evaluate(async mobile => {
            const { UIManager } = await import('/src/ui/UIManager.js');
            const { Minimap } = await import('/src/ui/Minimap.js');
            const { wellRestedBuff } = await import('/src/core/WellRested.js');
            document.body.classList.toggle('mobile-mode', mobile);
            document.getElementById('start-screen').style.display = 'none';
            const ui = new UIManager(mobile); ui.showHUD(); ui.toggleChat(true);
            const actor = { id: 'rest-presentation', wellRestedSeconds: 3661, safeZoneId: 'lanternhold' };
            const minimap = new Minimap();
            minimap.setGameEngine({ isMobile: mobile, player: actor,
                getActiveBuffs: () => [{ ...wellRestedBuff(actor), remainingSeconds: actor.wellRestedSeconds }] });
            minimap._renderBuffList();
            window.__restPresentation = { actor, minimap, ui };
        }, mobile);
        if (mobile) {
            await page.locator('#btn-phone-status').click();
            const panel = page.locator('#phone-status-panel');
            await expect(panel).toBeVisible();
            await expect(panel).toContainText('1h 01m / 2h');
            await expect(panel).toContainText('+25% enemy-kill XP only');
            const bounds = await panel.boundingBox();
            expect(bounds.x).toBeGreaterThanOrEqual(0);
            expect(bounds.y).toBeGreaterThanOrEqual(0);
            expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
            expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
            expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
            await page.evaluate(() => {
                const { actor, minimap } = window.__restPresentation;
                actor.safeZoneId = ''; minimap._renderBuffList();
            });
            await expect(panel).toContainText('Counts down outside sanctuary');
        } else {
            const icon = page.locator('.minimap-buff-icon[data-buff-id="well_rested"]');
            await expect(icon).toHaveAttribute('aria-label', /1h 01m.*Resting/);
            await icon.hover();
            await expect(page.getByText(/Well Rested • 1h 01m/)).toBeVisible();
        }
        await page.screenshot({ path: testInfo.outputPath(`well-rested-${width}.png`) });
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
