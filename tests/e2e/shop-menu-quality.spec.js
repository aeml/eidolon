import { test, expect } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

for (const phone of [false, true]) test(`merchant offers show exact prices and responsive equipment menus ${phone ? 'phone' : 'desktop'}`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize(phone ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async phone => {
        const { UIManager } = await import('/src/ui/UIManager.js');
        const { BASE_ITEMS, RARITY } = await import('/src/core/ItemSystem.js');
        document.getElementById('start-screen').style.display = 'none'; document.body.classList.toggle('mobile-mode', phone);
        const equipment = Object.fromEntries([['chest', 'Plate Mail'], ['mainHand', 'Iron Sword'], ['offHand', 'Wooden Shield']]
            .map(([slot, name]) => [slot, { ...BASE_ITEMS.find(item => item.name === name), id: `real-${slot}`, baseName: name, rarity: RARITY.RARE, level: 7, potency: 0 }]));
        const player = { id: 'shop-quality', subType: 'Fighter', level: 7, xp: 0, xpToNextLevel: 1000, statPoints: 0,
            equipment, inventory: Array(25).fill(null), gold: 500,
            stats: { hp: 180, maxHp: 180, mana: 50, maxMana: 50, strength: 20, dexterity: 12, intelligence: 10, vitality: 18, wisdom: 10, damage: 30, defense: 12 },
            baseStats: { strength: 20, dexterity: 12, intelligence: 10, vitality: 18, wisdom: 10 } };
        player.inventory[0] = { ...equipment.mainHand, id: 'bag-sword' };
        const ui = new UIManager(phone), sent = []; ui.lastPlayerRef = player; ui.inventory.onBuyGamble = slot => sent.push(slot);
        ui.showHUD(); ui.openManagedWindow('character'); ui.openManagedWindow('inventory'); ui.updateCharacterSheet(player); ui.updateInventory(player); ui.updatePlayerStats(player); ui.updateXP(player);
        window.__shopQuality = { ui, player, sent };
    }, phone);
    await expect(page.locator('#bag-usage')).toHaveText('1 / 25');
    if (!phone) {
        await expect(page.locator('#character-sheet .character-preview-stage canvas')).toBeVisible();
        await expect.poll(() => page.evaluate(() => window.__shopQuality.ui.characterPreview.model?.userData.equipmentVisualItemCount)).toBe(3);
        await page.screenshot({ path: testInfo.outputPath('character-and-bag.png') });
    }
    await page.evaluate(() => window.__shopQuality.ui.inventory.toggleShop());
    const shop = page.locator('#shop-screen'), first = shop.getByRole('button', { name: 'Mystery Helm, 245 Gold', exact: true });
    await expect(shop).toBeVisible(); await expect(shop.locator('.shop-item')).toHaveCount(12);
    await expect(first).toBeEnabled();
    await expect(shop.locator('#shop-purchase-status')).toContainText('245 Gold');
    expect(await shop.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect((await first.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await first.scrollIntoViewIfNeeded(); await first.focus(); await page.keyboard.press('Enter');
    expect(await page.evaluate(() => window.__shopQuality.sent)).toEqual(['head']);
    expect(await page.evaluate(() => window.__shopQuality.player.gold)).toBe(500);
    await page.screenshot({ path: testInfo.outputPath('merchant-offers.png') });
    const handle = await first.elementHandle();
    await page.evaluate(() => { const { ui, player } = window.__shopQuality; player.gold = 10; ui.updateInventory(player); });
    await expect(first).toBeDisabled(); await expect(shop.locator('#shop-purchase-status')).toContainText('You need 245 Gold');
    expect(await handle.evaluate(node => node.isConnected)).toBe(true);
    await page.evaluate(() => { const { ui, player } = window.__shopQuality; player.gold = 5000; player.inventory = Array.from({ length: 25 }, (_, i) => ({ ...player.equipment.mainHand, id: `bag-${i}` })); ui.updateInventory(player); });
    await expect(first).toBeDisabled(); await expect(shop.locator('#shop-purchase-status')).toContainText('bag is full');
    await page.evaluate(() => { const { ui, player } = window.__shopQuality; player.inventory[0] = null; ui.updateInventory(player); });
    await expect(first).toBeEnabled();
    await page.locator('#btn-close-shop-header').click();
    await page.evaluate(() => window.__shopQuality.ui.inventory.toggleShop());
    await expect(first).toBeEnabled(); await expect(page.locator('#bag-usage')).toHaveText('24 / 25');
    await page.evaluate(() => window.__shopQuality.ui.dispose());
    expect(failures, failures.join('\n')).toEqual([]);
});

test.describe('merchant touch controls', () => {
    test.use({ hasTouch: true, isMobile: true });
    test('phone taps buy once, switch tabs and close without changing local money', async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async () => {
            const { UIManager } = await import('/src/ui/UIManager.js');
            document.getElementById('start-screen').style.display = 'none'; document.body.classList.add('mobile-mode');
            const player = { id: 'merchant-touch', subType: 'Fighter', level: 7, gold: 500, equipment: {}, inventory: Array(25).fill(null) };
            const ui = new UIManager(true), sent = []; ui.lastPlayerRef = player;
            ui.inventory.onBuyGamble = slot => sent.push(slot); ui.showHUD(); ui.inventory.toggleShop();
            window.__shopTouch = { ui, player, sent };
        });
        const shop = page.locator('#shop-screen');
        const first = shop.getByRole('button', { name: 'Mystery Helm, 245 Gold', exact: true });
        await first.tap(); expect(await page.evaluate(() => window.__shopTouch.sent)).toEqual(['head']);
        expect(await page.evaluate(() => window.__shopTouch.player.gold)).toBe(500);
        await shop.locator('#tab-shop-buyback').tap(); await expect(shop.locator('#shop-content-buyback')).toBeVisible();
        await shop.locator('#tab-shop-main').tap(); await expect(first).toBeVisible();
        for (const action of ['#btn-sell-common', '#btn-sell-uncommon', '#btn-sell-rare']) expect((await shop.locator(action).boundingBox()).height).toBeGreaterThanOrEqual(44);
        await shop.screenshot({ path: testInfo.outputPath('touch-merchant.png') });
        await shop.locator('#btn-close-shop-header').tap(); await expect(shop).toBeHidden();
        await page.evaluate(() => window.__shopTouch.ui.dispose());
        expect(failures, failures.join('\n')).toEqual([]);
    });
});
