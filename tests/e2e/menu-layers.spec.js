import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test('party roster and resized permanent chat remain separately reachable', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
        const { UIManager } = await import('/src/ui/UIManager.js');
        document.getElementById('start-screen').style.display = 'none';
        const ui = new UIManager(false);
        ui.lastPlayerRef = { id: 'party-visual-0' };
        ui.toggleChat(true);
        ui.updateParty({
            partyId: 'visual-party', leaderId: 'party-visual-0', readyCheckActive: true,
            members: Array.from({ length: 10 }, (_, index) => ({
                id: `party-visual-${index}`, name: `Companion ${index + 1}`, class: 'Cleric',
                level: 100, hp: 80, maxHp: 100, isLeader: index === 0
            }))
        });
    });
    for (const [width, height, mobile] of [[1280, 720, false], [1280, 600, false], [390, 844, true], [320, 640, false]]) {
        await page.setViewportSize({ width, height });
        await page.evaluate((mobile) => document.body.classList.toggle('mobile-mode', mobile), mobile);
        for (const chatHeight of [230, 900]) {
            await page.locator('#chat-box').evaluate((element, chatHeight) => { element.style.height = `${chatHeight}px`; }, chatHeight);
            await expect.poll(() => page.evaluate(() => {
                const party = document.getElementById('party-panel').getBoundingClientRect();
                const chat = document.getElementById('chat-box').getBoundingClientRect();
                return party.top >= 0 && party.bottom + 10 <= chat.top;
            })).toBe(true);
            await page.locator('#chat-input').click();
            await expect(page.locator('#chat-input')).toBeFocused();
            for (const tab of await page.locator('.chat-tab').all()) {
                expect(await tab.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
            }
            await page.locator('#party-invite-input').scrollIntoViewIfNeeded();
            await page.locator('#party-invite-input').click();
            await expect(page.locator('#party-invite-input')).toBeFocused();
            await page.locator('#chat-input').click();
            await expect(page.locator('#chat-input')).toBeFocused();
        }
        await page.locator('#party-panel').evaluate((element) => { element.scrollTop = 0; });
        await page.screenshot({ path: testInfo.outputPath(`party-chat-${width}-${height}.png`) });
    }
    await page.locator('#chat-tab-chat').focus();
    await page.keyboard.press('End');
    await expect(page.locator('#chat-tab-game')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(page.locator('#chat-tab-chat')).toBeFocused();
    await expect(page.locator('#chat-box')).toBeVisible();
    expect(failures, failures.join('\n')).toEqual([]);
});

test('service, social and support panels remain above HUD and below their dialogs', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
        const { UIManager } = await import('/src/ui/UIManager.js');
        const { BASE_ITEMS, RARITY } = await import('/src/core/ItemSystem.js');
        const { EQUIPMENT_RENDER_SLOTS } = await import('/src/art/ProceduralEquipment.js');
        document.getElementById('start-screen').style.display = 'none';
        window.__menuFixture = new UIManager(false);
        const ui = window.__menuFixture;
        ui.toggleChat(true);
        const equipment = Object.fromEntries(EQUIPMENT_RENDER_SLOTS.map((slot) => {
            const base = BASE_ITEMS.find((item) => item.slot === slot.replace(/[12]$/, ''));
            return [slot, { ...base, id: `service-${slot}`, baseName: base.name, rarity: RARITY.RARE, level: 60, potency: 2, stats: { damage: 42, defense: 25 }, sockets: [] }];
        }));
        const items = Object.values(equipment);
        const player = { equipment, inventory: items, stash: items, gold: 10000, level: 60 };
        ui.lastPlayerRef = player;
        ui.updateStash(player);
        ui.forge.updateForgeUI(player);
        ui.forge.selectedForgeSlot = 'mainHand';
        ui.forge.updateForgeInfo(equipment.mainHand, player);
        ui.inventory.updateBuybackList(items);
        window.__serviceActions = [];
        ui.trading.onTradingBuyout = (id) => window.__serviceActions.push({ type: 'buyout', id });
        ui.trading.renderAuctionList(items.map((item, index) => ({
            id: `visual-auction-${index}`, item, sellerName: 'Sanctum Artisan',
            currentBid: 1200 + index * 100, buyoutPrice: 5000,
            endTime: Date.now() + 3600000
        })));
    });

    for (const [width, height] of [[1440, 1000], [1280, 600], [390, 844]]) {
        await page.setViewportSize({ width, height });
        for (const id of ['shop', 'stash', 'forge', 'trading', 'quest', 'social', 'pvp', 'settings', 'help', 'report', 'patchNotes']) {
            const selector = await page.evaluate((id) => {
                const ui = window.__menuFixture;
                ui.closeAllStaticModals();
                for (const layout of ui.windowLayouts.values()) {
                    if (layout.element) layout.element.style.display = 'none';
                }
                const layout = ui.windowLayouts.get(id);
                if (layout.group === 'modal') ui.toggleStaticModal(layout.element, layout.display);
                else { layout.element.style.display = layout.display; ui.reflowVisibleWindows(); }
                return `#${layout.element.id}`;
            }, id);
            const panel = page.locator(selector);
            await expect(panel).toBeVisible();
            const result = await panel.evaluate((element) => {
                const rect = element.getBoundingClientRect();
                const header = element.querySelector('.window-header').getBoundingClientRect();
                const hit = document.elementFromPoint(header.left + header.width / 2, header.top + header.height / 2);
                const backdrop = document.getElementById('ui-static-modal-backdrop');
                return {
                    left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
                    horizontalOverflow: element.scrollWidth > element.clientWidth,
                    headerUncovered: element.contains(hit),
                    layer: Number(getComputedStyle(element).zIndex),
                    clock: Number(getComputedStyle(document.getElementById('game-timer')).zIndex),
                    backdrop: backdrop ? Number(getComputedStyle(backdrop).zIndex) : null,
                    tooltip: Number(getComputedStyle(document.documentElement).getPropertyValue('--z-tooltip'))
                };
            });
            expect(result.left, `${id} left`).toBeGreaterThanOrEqual(0);
            expect(result.top, `${id} top`).toBeGreaterThanOrEqual(0);
            expect(result.right, `${id} right`).toBeLessThanOrEqual(width);
            expect(result.bottom, `${id} bottom`).toBeLessThanOrEqual(height);
            expect(result.headerUncovered, `${id} header`).toBe(true);
            expect(result.horizontalOverflow, `${id} horizontal overflow`).toBe(false);
            expect(result.layer, `${id} above clock`).toBeGreaterThan(result.clock);
            expect(result.layer, `${id} below tooltip`).toBeLessThan(result.tooltip);
            if (result.backdrop !== null) {
                expect(result.backdrop).toBeGreaterThan(result.clock);
                expect(result.layer).toBeGreaterThan(result.backdrop);
            }
            if (['social', 'forge', 'settings', 'stash', 'trading'].includes(id)) {
                await panel.screenshot({ path: testInfo.outputPath(`${id}-${width}.png`) });
            }
            if (id === 'trading') {
                const row = panel.locator('.auction-browse-row').first();
                await expect(row).toBeVisible();
                await row.getByRole('button', { name: 'Buyout', exact: true }).click();
                expect(await page.evaluate(() => window.__serviceActions.at(-1))).toEqual({ type: 'buyout', id: 'visual-auction-0' });
                expect(await row.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
            }
        }
    }
    await page.evaluate(() => window.__menuFixture.handleEscape());
    await expect(page.locator('#patch-notes-screen')).toBeHidden();
    await expect(page.locator('#chat-box')).toBeVisible();
    expect(failures, failures.join('\n')).toEqual([]);
});
