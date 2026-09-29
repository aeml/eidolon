import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

for (const [width, height] of [[1440, 900], [1024, 600]]) {
    test(`desktop ${width}: item inspection compares and scrolls without accidental equip`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async () => {
            const { UIManager } = await import('/src/ui/UIManager.js');
            const { InputManager } = await import('/src/core/InputManager.js');
            const { BASE_ITEMS, RARITY, SET_DEFINITIONS, UNIQUE_EFFECTS } = await import('/src/core/ItemSystem.js');
            document.body.classList.remove('mobile-mode');
            document.getElementById('start-screen').style.display = 'none';
            const ui = new UIManager(false), input = new InputManager(null, null);
            input.subscribe('onEscape', () => ui.handleEscape());
            const blade = { ...BASE_ITEMS.find(i => i.slot === 'mainHand'), id: 'review-blade',
                name: 'Oath of the Last Lantern', rarity: RARITY.RARE, level: 45, potency: 5,
                setId: Object.keys(SET_DEFINITIONS)[0], uniqueEffect: Object.keys(UNIQUE_EFFECTS)[0],
                description: 'Carried through the shattered passes by the last keeper of the western watch.',
                stats: { damage: 120, strength: 28, vitality: 16, defense: -2, critChance: 3 }, sockets: 3 };
            const player = { subType: 'Fighter', level: 50, gold: 250, xp: 1, xpToNextLevel: 100, statPoints: 0,
                isMultiplayer: true, inventory: [blade], equipment: { mainHand: { ...blade, id: 'worn',
                    name: 'Worn Lantern Sword', potency: 1, setId: null, uniqueEffect: null, stats: { damage: 84, strength: 12 } } },
                stats: { hp: 100, maxHp: 100, mana: 100, maxMana: 100 }, baseStats: {} };
            const calls = []; player.equipItem = item => { calls.push(item.id); return true; };
            ui.lastPlayerRef = player; ui.showHUD(); ui.toggleChat(true); ui.inventory.toggleInventory();
            window.__inspect = { ui, input, calls, player };
        });
        const row = page.locator('#inventory-grid .inv-slot').first(), dialog = page.locator('#phone-item-details');
        await row.click({ button: 'right' });
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText('Oath of the Last Lantern');
        expect(await page.evaluate(() => window.__inspect.calls)).toEqual([]);
        await page.locator('#phone-item-compare').click();
        await expect(page.locator('#phone-item-comparison')).toContainText('Worn Lantern Sword');
        await expect(page.locator('#phone-item-comparison')).toContainText('+36');
        const scroll = dialog.locator('.phone-item-scroll');
        await scroll.evaluate(el => { el.scrollTop = el.scrollHeight; });
        await expect(page.locator('#phone-item-equip')).toBeInViewport();
        expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
        const bounds = await dialog.boundingBox();
        expect(bounds.y).toBeGreaterThanOrEqual(0); expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
        await scroll.evaluate(el => { el.scrollTop = 0; });
        await page.screenshot({ path: testInfo.outputPath('item-comparison.png') });
        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden(); await expect(row).toBeFocused();
        await expect(page.locator('#inventory-screen')).toBeVisible(); await expect(page.locator('#chat-box')).toBeVisible();
        await page.keyboard.press('Shift+F10'); await expect(dialog).toBeVisible();
        await page.locator('#phone-item-compare').click();
        await page.evaluate(() => {
            const q = window.__inspect;
            q.player.inventory[0].stats.damage = 150;
            q.ui.inventory.updateInventory(q.player);
        });
        await expect(page.locator('#phone-item-description')).toContainText('+150');
        await expect(page.locator('#phone-item-comparison')).toContainText('+66');
        await expect(page.locator('#phone-item-compare')).toBeFocused();
        expect(await page.evaluate(() => window.__inspect.calls)).toEqual([]);
        await page.locator('#phone-item-back').click();
        await page.evaluate(() => {
            const q = window.__inspect, blade = q.player.inventory[0];
            q.player.inventory = Array.from({ length: 25 }, (_, i) => ({ ...blade, id: `bag-${i}`, name: `Lanternkeeper's Ceremonial Sword ${i + 1}` }));
            q.player.stash = Array.from({ length: 100 }, (_, i) => ({ ...blade, id: `stored-${i}`, name: `Earthwarden's Relic of the Western Watch ${i + 1}` }));
            q.ui.inventory.onStashDeposit = id => q.calls.push(`deposit:${id}`);
            q.ui.inventory.onStashWithdraw = id => q.calls.push(`withdraw:${id}`);
            q.ui.inventory.toggleStash();
        });
        const stash = page.locator('#stash-screen'), browser = page.locator('#stash-browser');
        await expect(stash).toBeVisible(); await expect(page.locator('#inventory-screen')).toBeHidden();
        await expect(page.locator('#stash-browser-inventory-title')).toContainText('25 / 25');
        await expect(page.locator('#stash-browser-stash-title')).toContainText('100 / 100');
        const panes = browser.locator('.stash-browser-list');
        for (const pane of await panes.all()) {
            expect(await pane.evaluate(el => el.scrollHeight > el.clientHeight && el.scrollWidth <= el.clientWidth)).toBe(true);
        }
        const stashBounds = await stash.boundingBox();
        expect(stashBounds.x).toBeGreaterThanOrEqual(0); expect(stashBounds.y).toBeGreaterThanOrEqual(0);
        expect(stashBounds.x + stashBounds.width).toBeLessThanOrEqual(width);
        expect(stashBounds.y + stashBounds.height).toBeLessThanOrEqual(height);
        await page.screenshot({ path: testInfo.outputPath('desktop-stash.png') });
        await browser.locator('input').fill('Western Watch 100');
        const stored = browser.locator('[data-item-id="stored-99"]');
        await expect(stored).toBeVisible(); await expect(stored).toHaveAttribute('data-slot-index', '99');
        await stored.click(); await expect(dialog).toBeVisible();
        expect(await page.evaluate(() => window.__inspect.calls)).toEqual([]);
        await page.locator('#phone-item-withdraw').click(); await expect(dialog).toBeHidden();
        expect(await page.evaluate(() => window.__inspect.calls)).toEqual(['withdraw:stored-99']);
        await browser.locator('input').fill('');
        const bag = browser.locator('[data-item-id="bag-0"]');
        await bag.click({ button: 'right' });
        expect(await page.evaluate(() => window.__inspect.calls)).toEqual(['withdraw:stored-99', 'deposit:bag-0']);
        await bag.click();
        await page.evaluate(() => {
            const q = window.__inspect; q.player.inventory[0] = { ...q.player.inventory[0], potency: 6 };
            q.ui.inventory.updateInventory(q.player);
        });
        await expect(page.locator('#phone-item-description')).toContainText('Potency +6');
        await page.locator('#phone-item-back').click(); await expect(bag).toBeFocused();
        expect(await page.evaluate(() => window.__inspect.player.inventory.length)).toBe(25);
        await page.locator('#btn-close-stash').click(); await expect(stash).toBeHidden();
        await page.evaluate(() => { window.__inspect.input.dispose(); window.__inspect.ui.characterPreview.dispose(); });
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
