import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test.use({ hasTouch: true, isMobile: true, actionTimeout: 12_000 });

for (const [width, height] of [[360, 800], [390, 844], [844, 390]]) {
    test(`${width}x${height}: phone bag and equipped details are readable deliberate routes`, async ({ page, context, baseURL }) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'networkidle' });
        // Production markup, UI and icons, with seeded display data only.
        // This fixture does not establish authoritative equip/drop behavior.
        await page.evaluate(async () => {
            const { UIManager } = await import('/src/ui/UIManager.js');
            const { InputManager } = await import('/src/core/InputManager.js');
            const { BASE_ITEMS, RARITY } = await import('/src/core/ItemSystem.js');
            document.body.classList.add('mobile-mode');
            document.getElementById('start-screen').style.display = 'none';
            const ui = new UIManager(true);
            const input = new InputManager(null, null);
            input.subscribe('onEscape', () => ui.handleEscape());
            const sword = BASE_ITEMS.find(item => item.slot === 'mainHand');
            const inventory = Array.from({ length: 25 }, (_, i) => ({ ...sword, baseName: sword.name, id: `bag-${i}`, name: `Lanternhold expedition blade ${i + 1}`,
                rarity: RARITY.RARE, level: 5, stats: { damage: 12, strength: 2 }, sockets: 2, potency: 1 }));
            inventory[0] = { id: 'chronicle-item-seed', name: 'Elderroot Memory of the First Crystal', description: 'A memory held beneath the old roots of Eidolon.',
                type: 'RELIC', slot: 'relic', rarity: RARITY.RARE, level: 1, stack: 3 };
            const player = { subType: 'Fighter', isMultiplayer: true, level: 10, xp: 1, xpToNextLevel: 100, statPoints: 0,
                stats: { hp: 100, maxHp: 100, mana: 100, maxMana: 100 }, baseStats: {}, inventory, gold: 250,
                equipment: { mainHand: { ...inventory[1], id: 'equipped', name: 'Worn Lantern Sword' } } };
            const calls = [];
            player.equipItem = item => { calls.push(['equip', item.id]); return true; };
            ui.inventory.onUnequipRequest = slot => calls.push(['unequip', slot]);
            ui.lastPlayerRef = player;
            window.__phoneBag = { ui, input, player, calls };
            ui.showHUD(); ui.toggleChat(true); ui.inventory.toggleInventory();
        });
        const bag = page.locator('#inventory-screen');
        const rows = bag.locator('.inv-slot');
        await expect(rows).toHaveCount(25);
        expect(await rows.first().evaluate(el => getComputedStyle(el.querySelector('strong')).fontSize)).toBe('16px');
        expect(await rows.first().evaluate(el => {
            const rect = el.getBoundingClientRect();
            return el.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
        }), 'No neighboring row may cover the first item tap target').toBe(true);
        await page.screenshot({ path: `/tmp/eidolon-phone-bag-${width}.png` });
        await rows.first().tap();
        const details = page.locator('#phone-item-details');
        await expect(details).toBeVisible();
        await expect(page.locator('#phone-item-title')).toContainText('Elderroot Memory');
        await expect(page.locator('#phone-item-equip')).toBeHidden();
        await expect(page.locator('#phone-item-drop')).toBeHidden();
        await expect(page.locator('#phone-item-description')).toContainText('old roots of Eidolon');
        const chat = await page.locator('#chat-box').boundingBox();
        const bounds = await details.boundingBox();
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(chat.y);
        await page.locator('#phone-item-back').tap();

        // Native touch scrolling must pan the bag rather than start an item drag.
        const grid = page.locator('#inventory-grid');
        const rect = await grid.boundingBox();
        const cdp = await context.newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 7, x: rect.x + 80, y: rect.y + rect.height - 20 }] });
        for (let i = 1; i <= 6; i++) {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 7, x: rect.x + 80, y: rect.y + rect.height - 20 - i * (rect.height - 50) / 6 }] });
            await page.waitForTimeout(25);
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await cdp.detach();
        await expect.poll(() => grid.evaluate(el => el.scrollTop)).toBeGreaterThan(20);
        await rows.last().scrollIntoViewIfNeeded();
        const scroll = await grid.evaluate(el => el.scrollTop);
        await rows.last().tap();
        expect(await page.evaluate(() => window.__phoneBag.calls)).toEqual([]);
        await page.locator('#phone-item-compare').tap();
        await expect(page.locator('#phone-item-comparison')).toContainText('Worn Lantern Sword');
        for (const button of await details.locator('button:visible').all()) {
            await expect(button).toBeInViewport();
            const box = await button.boundingBox();
            expect(box.height).toBeGreaterThanOrEqual(44);
        }
        expect(await details.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
        await page.screenshot({ path: `/tmp/eidolon-phone-item-${width}.png` });
        await page.keyboard.press('Escape');
        await expect(details).toBeHidden();
        await expect(bag).toBeVisible();
        expect(await grid.evaluate(el => el.scrollTop)).toBeCloseTo(scroll, 0);
        await page.locator('#btn-close-inventory').tap();
        await page.evaluate(() => window.__phoneBag.ui.toggleCharacterSheet());
        await page.locator('#slot-mainhand').scrollIntoViewIfNeeded();
        await page.locator('#slot-mainhand').tap();
        await expect(details).toBeVisible();
        expect(await page.evaluate(() => window.__phoneBag.calls)).toEqual([]);
        await expect(page.locator('#phone-item-unequip')).toBeVisible();
        await page.locator('#phone-item-back').tap();
        await expect(page.locator('#chat-box')).toBeVisible();
        await page.evaluate(() => { window.__phoneBag.input.dispose(); window.__phoneBag.ui.characterPreview.dispose(); });
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
