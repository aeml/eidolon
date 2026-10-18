import { qaChromeLaunchOptions } from './browserLaunchPolicy.js';
import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

// This suite verifies native DOM/keyboard behavior, without a WebGL workload.
test.use({ launchOptions: qaChromeLaunchOptions({ args: ['--disable-gpu'] }) });

for (const [width, mobile] of [[1280, false], [390, true]]) {
    test(`${width}px merchant buyback keeps keyboard intent, visible prices and item identity through refresh`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height: 844 });
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async mobile => {
            const { UIManager } = await import('/src/ui/UIManager.js');
            const { BASE_ITEMS, RARITY } = await import('/src/core/ItemSystem.js');
            document.getElementById('start-screen').style.display = 'none';
            document.body.classList.toggle('mobile-mode', mobile);
            const ui = new UIManager(mobile), inventory = ui.inventory;
            const player = { id: 'buyback-keyboard', level: 1, equipment: {}, inventory: [], gold: 1000 };
            ui.lastPlayerRef = player;
            const sword = BASE_ITEMS.find(item => item.name === 'Iron Sword');
            const items = Array.from({ length: 36 }, (_, i) => ({ ...sword, id: `blade-${i}`, name: `Old Sword ${i}`,
                value: 25, rarity: RARITY.RARE, stack: 1 }));
            items[0] = { ...items[0], name: 'Phoenix Blade', value: 125, stack: 2 };
            items.push({ id: 'legacy', name: 'Legacy Token', value: 0, stack: 3, rarity: RARITY.COMMON });
            const calls = [];
            inventory.onBuyback = id => calls.push(id);
            inventory.toggleShop();
            inventory.tabShopBuyback.click();
            inventory.updateBuybackList(items);
            window.__buybackKeyboard = { ui, inventory, player, items, calls };
        }, mobile);

        const group = page.getByRole('group', { name: 'Items available to buy back', exact: true });
        await expect(group).toBeVisible();
        expect(await group.evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length)).toBe(mobile ? 1 : 2);
        await page.locator('#tab-shop-buyback').focus();
        await page.keyboard.press('Tab');
        const legacy = group.getByRole('button', { name: 'Buy back Legacy Token ×3 for 3 Gold', exact: true });
        await expect(legacy).toBeFocused();
        await expect(legacy).toContainText('3 Gold');
        await page.keyboard.press('Enter');
        expect(await page.evaluate(() => window.__buybackKeyboard.calls)).toEqual(['legacy']);

        const blade = group.getByRole('button', { name: 'Buy back Phoenix Blade ×2 for 250 Gold', exact: true });
        await blade.focus();
        const scroll = await group.evaluate(node => node.scrollTop);
        expect(scroll).toBeGreaterThan(0);
        await page.keyboard.down('Space');
        await page.evaluate(() => {
            const state = window.__buybackKeyboard;
            state.old = document.activeElement;
            state.inventory.updateBuybackList(JSON.parse(JSON.stringify(state.items)));
        });
        expect(await page.evaluate(() => window.__buybackKeyboard.old === document.activeElement)).toBe(true);
        expect(await group.evaluate(node => node.scrollTop)).toBe(scroll);
        await page.keyboard.up('Space');
        expect(await page.evaluate(() => window.__buybackKeyboard.calls)).toEqual(['legacy', 'blade-0']);
        await page.evaluate(() => {
            const state = window.__buybackKeyboard;
            state.items.reverse(); state.inventory.updateBuybackList(state.items);
        });
        await expect(blade).toBeFocused();
        expect(await blade.evaluate(node => {
            const bounds = node.getBoundingClientRect(), area = node.parentElement.getBoundingClientRect();
            return bounds.top >= area.top && bounds.bottom <= area.bottom;
        })).toBe(true);
        await page.keyboard.press('Enter');
        expect(await page.evaluate(() => window.__buybackKeyboard.calls)).toEqual(['legacy', 'blade-0', 'blade-0']);
        expect(await blade.evaluate(node => node.offsetHeight >= 44 && node.offsetWidth >= 44)).toBe(true);
        expect(await page.locator('.shop-window').evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
        await page.screenshot({ path: testInfo.outputPath('merchant-buyback-keyboard.png') });

        await page.evaluate(() => {
            const state = window.__buybackKeyboard;
            state.items = state.items.map(item => item.id === 'blade-0' ? { ...item, value: 20, stack: 3 } : item);
            state.inventory.updateBuybackList(state.items);
            state.old.onclick();
        });
        const changed = group.getByRole('button', { name: 'Buy back Phoenix Blade ×3 for 60 Gold', exact: true });
        await expect(changed).toBeFocused();
        expect(await page.evaluate(() => window.__buybackKeyboard.calls.length)).toBe(3);
        await page.keyboard.down('Space');
        await page.evaluate(() => {
            const state = window.__buybackKeyboard;
            state.inventory.updateBuybackList(state.items.filter(item => item.id !== 'blade-0'));
        });
        await page.keyboard.up('Space');
        await expect(group).toBeFocused();
        expect(await page.evaluate(() => window.__buybackKeyboard.calls.length)).toBe(3);
        await page.evaluate(() => window.__buybackKeyboard.inventory.updateBuybackList([]));
        await expect(group).toHaveText('No items available to buy back.');
        await expect(group).toBeFocused();
        await page.evaluate(() => {
            const state = window.__buybackKeyboard;
            state.inventory.updateBuybackList(state.items);
            const choice = state.inventory.buybackGrid.querySelector('button');
            state.inventory.dispose(); choice.click();
        });
        expect(await page.evaluate(() => ({ calls: window.__buybackKeyboard.calls,
            gold: window.__buybackKeyboard.player.gold, inventory: window.__buybackKeyboard.player.inventory })))
            .toEqual({ calls: ['legacy', 'blade-0', 'blade-0'], gold: 1000, inventory: [] });
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
