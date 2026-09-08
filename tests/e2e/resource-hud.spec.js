import { expect, test } from '@playwright/test';
import { collectBrowserFailures, openGame } from './helpers.js';

// Explicit presentation fixture. No account, server resource grant or claimed
// combat balance evidence: render successive replicated-style HUD snapshots.
for (const [width, height] of [[1280, 720], [390, 844], [844, 390]]) {
    test.describe(`${width}x${height} resource HUD`, () => {
        test.use({ viewport: { width, height }, isMobile: width < 900, hasTouch: width < 900 });
        test('zero mana is visibly empty and later recovery updates in place', async ({ page, baseURL }, testInfo) => {
            const failures = collectBrowserFailures(page, baseURL);
            await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
            await openGame(page);
            await page.evaluate(async mobile => {
                const { UIManager } = await import('/src/ui/UIManager.js');
                document.body.classList.toggle('mobile-mode', mobile);
                document.getElementById('start-screen').style.display = 'none';
                const ui = new UIManager(mobile);
                const player = { stats: { hp: 50, maxHp: 200, mana: 30, maxMana: 160 },
                    abilityName: 'Fireball', abilityDescription: 'A fiery orb.', abilityManaCost: 30,
                    abilityCooldown: 0, subType: 'Wizard' };
                ui.showHUD(); ui.updatePlayerStats(player);
                window.__resourceHUD = { ui, player };
            }, width < 900);
            await expect(page.locator('#player-mana-text')).toHaveText('30 / 160');
            await page.evaluate(() => {
                const q = window.__resourceHUD;
                q.player.stats.mana = 0; q.ui.updatePlayerStats(q.player);
            });
            await expect(page.locator('#player-mana-text')).toHaveText('0 / 160');
            await expect(page.locator('#player-mana-text')).toBeVisible();
            await expect(page.locator('#player-mana-bar')).toHaveCSS('width', '0px');
            await expect(page.locator('#player-hp-text')).toHaveText('50 / 200');
            await page.screenshot({ path: testInfo.outputPath('empty-mana.png') });
            await page.evaluate(() => {
                const q = window.__resourceHUD;
                q.player.stats.mana = 1; q.ui.updatePlayerStats(q.player);
            });
            await expect(page.locator('#player-mana-text')).toHaveText('1 / 160');
            await expect.poll(() => page.locator('#player-mana-bar').evaluate(el =>
                el.getBoundingClientRect().width)).toBeGreaterThan(0);
            expect(await page.evaluate(() => window.__resourceHUD.player.stats.mana)).toBe(1);
            expect(failures, failures.join('\n')).toEqual([]);
        });
    });
}
