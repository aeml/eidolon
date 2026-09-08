import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

// Prepared UI fixture, not evidence of earned inventory or a database listing.
for (const [width, height] of [[1280, 900], [390, 844]]) {
    test(`${width}: trading selection cannot silently retarget a changed bag`, async ({ page, baseURL }) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async ({ mobile }) => {
            const { UIManager } = await import('/src/ui/UIManager.js');
            const { BASE_ITEMS, RARITY } = await import('/src/core/ItemSystem.js');
            if (mobile) document.body.classList.add('mobile-mode');
            document.getElementById('start-screen').style.display = 'none';
            const ui = new UIManager(true);
            const base = BASE_ITEMS.find(item => item.slot === 'mainHand');
            const player = { level: 30, gold: 1234, xp: 0, xpToNextLevel: 100,
                stats: { hp: 17, maxHp: 100, mana: 70, maxMana: 100 }, baseStats: {}, equipment: {},
                inventory: [{ ...base, id: 'selected-item', name: 'Selected Staff', stack: 1, rarity: RARITY.RARE }, ...Array(24).fill(null)] };
            ui.lastPlayerRef = player;
            ui.showHUD();
            ui.toggleChat(true);
            ui.trading.toggle();
            const calls = [];
            ui.trading.onTradingCreate = (...args) => calls.push(args);
            window.__listingSelection = { ui, player, calls };
        }, { mobile: width < 600 });
        await page.locator('#tab-trading-list').click();
        await page.locator('#trading-inventory-list .inv-slot').first().click();
        await page.locator('#trading-input-bid').fill('100');
        await page.locator('#trading-input-buyout').fill('500');
        await page.evaluate(() => {
            const { ui, player } = window.__listingSelection;
            player.inventory[0] = { ...player.inventory[0], id: 'replacement-item', name: 'Replacement Staff' };
            ui.updateInventory(player);
        });
        await expect(page.locator('#trading-sell-slot')).toHaveText('+');
        await expect(page.locator('#trading-house-guidance')).toContainText('Select the item again');
        await page.locator('#btn-trading-create').click();
        expect(await page.evaluate(() => window.__listingSelection.calls)).toEqual([]);
        await page.screenshot({ path: `/tmp/eidolon-trading-selection-${width}.png` });
        await page.locator('#trading-inventory-list .inv-slot').first().click();
        await expect(page.locator('#trading-house-guidance')).toContainText('Replacement Staff');
        const duration = await page.locator('#trading-input-duration').inputValue();
        await page.locator('#btn-trading-create').click();
        expect(await page.evaluate(() => window.__listingSelection.calls)).toEqual([
            [0, 100, 500, Number(duration), 'replacement-item', 1]
        ]);
        await expect(page.locator('#chat-box')).toBeVisible();
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
