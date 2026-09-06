import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test.use({ hasTouch: true, isMobile: true, actionTimeout: 12_000 });
for (const [width, height] of [[360, 800], [390, 844], [844, 390], [568, 320]]) {
    test(`${width}x${height}: legacy recovery stays readable and reachable above chat`, async ({ page, baseURL }) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async () => {
            const { UIManager } = await import('/src/ui/UIManager.js');
            const { BASE_ITEMS, RARITY } = await import('/src/core/ItemSystem.js');
            document.body.classList.add('mobile-mode');
            document.getElementById('start-screen').style.display = 'none';
            const ui = new UIManager(true);
            const sword = BASE_ITEMS.find(item => item.slot === 'mainHand');
            const player = { subType: 'Wizard', level: 1, gold: 0, xp: 0, xpToNextLevel: 100, statPoints: 0,
                stats: { hp: 100, maxHp: 100, mana: 100, maxMana: 100 }, baseStats: {},
                inventory: Array.from({ length: 25 }, (_, i) => ({ ...sword, id: `gear-${i}`, rarity: RARITY.COMMON, level: 1 })),
                equipment: Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`legacy-${i}`, {
                    id: `legacy-gem-${i}`, name: `Chipped Sapphire from the Lanternhold expedition ${i + 1}`,
                    type: 'GEM', slot: 'gem', stack: 5, rarity: RARITY.COMMON }])) };
            const calls = [];
            ui.inventory.onUnequipRequest = (slot, itemId) => calls.push({ slot, itemId });
            ui.lastPlayerRef = player;
            ui.showHUD(); ui.toggleChat(true); ui.inventory.toggleInventory();
            window.__recoveryLayout = { ui, player, calls };
        });
        const panel = page.locator('#inventory-recovery');
        await expect(panel).toBeVisible();
        await expect(page.locator('#btn-close-inventory')).toBeInViewport();
        expect((await page.locator('#inventory-grid').boundingBox()).height).toBeGreaterThanOrEqual(44);
        await panel.locator('summary').tap();
        const buttons = panel.getByRole('button');
        for (const index of [0, 7]) {
            const button = buttons.nth(index);
            await button.scrollIntoViewIfNeeded();
            await expect(button).toBeInViewport();
            const bounds = await button.boundingBox();
            expect(bounds.height).toBeGreaterThanOrEqual(44);
            const panelBounds = await panel.boundingBox();
            expect(Math.min(bounds.y + bounds.height, panelBounds.y + panelBounds.height) -
                Math.max(bounds.y, panelBounds.y), 'The whole minimum-height hit area must be visible, not clipped').toBeGreaterThanOrEqual(44);
            expect(await button.evaluate(el => {
                const r = el.getBoundingClientRect();
                return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
            })).toBe(true);
            await button.tap();
        }
        expect(await page.evaluate(() => window.__recoveryLayout.calls)).toEqual([
            { slot: 'legacy-0', itemId: 'legacy-gem-0' }, { slot: 'legacy-7', itemId: 'legacy-gem-7' }
        ]);
        expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
        const chat = await page.locator('#chat-box').boundingBox();
        const box = await panel.boundingBox();
        expect(box.y + box.height).toBeLessThanOrEqual(chat.y);
        await page.screenshot({ path: `/tmp/eidolon-equipment-recovery-${width}.png` });
        await page.locator('#btn-close-inventory').tap();
        await expect(page.locator('#inventory-screen')).toBeHidden();
        await expect(page.locator('#chat-box')).toBeVisible();
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
