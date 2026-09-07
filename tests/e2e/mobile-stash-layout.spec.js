import { devices, expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test.use({ hasTouch: true, isMobile: true, userAgent: devices['Pixel 7'].userAgent, actionTimeout: 12_000 });
for (const [width, height] of [[360, 800], [390, 844], [844, 390], [568, 320]]) {
    test(`${width}x${height}: full stash uses one readable touch surface and explicit moves`, async ({ page, context, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'networkidle' });
        // Seeded layout data and observed callbacks only, not a server transfer.
        await page.evaluate(async () => {
            const { UIManager } = await import('/src/ui/UIManager.js');
            const { InputManager } = await import('/src/core/InputManager.js');
            const { BASE_ITEMS, RARITY } = await import('/src/core/ItemSystem.js');
            document.body.classList.add('mobile-mode'); document.getElementById('start-screen').style.display = 'none';
            const ui = new UIManager(true), input = new InputManager(null, null);
            input.subscribe('onEscape', () => ui.handleEscape());
            const base = BASE_ITEMS.find(item => item.slot === 'mainHand');
            const makeItem = (prefix, i) => ({ ...base, baseName: base.name, id: `${prefix}-${i}`,
                name: `Lanternhold expedition blade of the remembered crystal ${i + 1}`, rarity: RARITY.RARE,
                level: 5, stats: { damage: 12, strength: 2 }, sockets: 2, potency: 1 });
            const inventory = Array.from({ length: 25 }, (_, i) => makeItem('bag', i));
            inventory[0] = { id: 'chronicle-item-seed', name: 'Elderroot Memory', description: 'A memory of the first crystal.',
                type: 'RELIC', slot: 'relic', rarity: RARITY.RARE, level: 1, stack: 3 };
            const player = { subType: 'Wizard', isMultiplayer: true, level: 10, xp: 1, xpToNextLevel: 100, statPoints: 0,
                stats: { hp: 100, maxHp: 100, mana: 100, maxMana: 100 }, baseStats: {}, inventory,
                stash: Array.from({ length: 100 }, (_, i) => makeItem('stored', i)), gold: 250, equipment: {} };
            const calls = [];
            ui.inventory.onStashDeposit = id => calls.push(['deposit', id]);
            ui.inventory.onStashWithdraw = id => calls.push(['withdraw', id]);
            ui.lastPlayerRef = player;
            window.__stashQA = { ui, input, player, calls };
            ui.showHUD(); ui.toggleChat(true); ui.toggleStash();
        });
        const screen = page.locator('#stash-screen'), list = page.locator('#phone-stash-list');
        await expect(screen).toBeVisible(); await expect(page.locator('#inventory-screen')).toBeHidden();
        await expect(list.locator('button')).toHaveCount(25);
        await list.locator('button').first().tap();
        await expect(page.locator('#phone-item-stash')).toBeHidden();
        await page.locator('#phone-item-back').tap();
        await list.locator('button').nth(1).tap();
        const details = page.locator('#phone-item-details');
        for (const button of await details.locator('button:visible').all()) {
            await expect(button).toBeInViewport(); expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
        }
        expect(await details.locator('.phone-item-scroll').evaluate(node => node.clientHeight)).toBeGreaterThan(35);
        expect(await details.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
        await page.screenshot({ path: testInfo.outputPath(`stash-detail-${width}.png`) });
        expect(await page.evaluate(() => window.__stashQA.calls)).toEqual([]);
        await page.locator('#phone-item-stash').tap();
        expect(await page.evaluate(() => window.__stashQA.calls)).toEqual([['deposit', 'bag-1']]);
        await page.getByRole('tab', { name: 'Stash (100)', exact: true }).tap();
        await expect(list.locator('button')).toHaveCount(100);
        expect(await list.locator('strong').first().evaluate(node => getComputedStyle(node).fontSize)).toBe('16px');
        const bounds = await list.boundingBox(), cdp = await context.newCDPSession(page);
        const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height * .8;
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        for (let step = 1; step <= 8; step++) {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - bounds.height * .6 * step / 8 }] });
            await page.waitForTimeout(25);
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach();
        await expect.poll(() => list.evaluate(node => node.scrollTop)).toBeGreaterThan(20);
        await list.locator('button').last().scrollIntoViewIfNeeded();
        const scroll = await list.evaluate(node => node.scrollTop);
        await page.screenshot({ path: testInfo.outputPath(`stash-list-${width}.png`) });
        await list.locator('button').last().tap();
        await page.locator('#phone-item-withdraw').tap();
        expect(await page.evaluate(() => window.__stashQA.calls)).toEqual([['deposit', 'bag-1'], ['withdraw', 'stored-99']]);
        expect(await list.evaluate(node => node.scrollTop)).toBeCloseTo(scroll, 0);
        await page.getByRole('tab', { name: 'Bag (25)', exact: true }).tap();
        await page.getByRole('tab', { name: 'Stash (100)', exact: true }).tap();
        expect(await list.evaluate(node => node.scrollTop)).toBeCloseTo(scroll, 0);
        const chat = await page.locator('#chat-mobile-toggle').boundingBox(), panel = await screen.boundingBox();
        expect(panel.y + panel.height).toBeLessThanOrEqual(chat.y);
        await page.locator('#btn-close-stash').tap(); await expect(screen).toBeHidden();
        await page.locator('#chat-mobile-toggle').tap(); await expect(page.locator('#chat-input')).toBeVisible();
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
