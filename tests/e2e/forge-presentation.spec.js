import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

for (const [width, height, mobile] of [[1280, 900, false], [390, 844, true]]) {
    test(`${width}px Forge previews stay readable through refresh and capped items`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async mobile => {
            const { UIManager } = await import('/src/ui/UIManager.js');
            const { BASE_ITEMS, RARITY } = await import('/src/core/ItemSystem.js');
            document.getElementById('start-screen').style.display = 'none';
            document.body.classList.toggle('mobile-mode', mobile);
            const ui = new UIManager(mobile), forge = ui.forge;
            const equipment = Object.fromEntries(forge._equipSlots().map(slot => {
                const base = BASE_ITEMS.find(item => item.slot === slot) || BASE_ITEMS.find(item => item.slot === 'mainHand');
                return [slot, { ...base, id: `forge-review-${slot}`, name: `Keeper's ${slot} of the First Covenant`,
                    rarity: RARITY.RARE, level: 30, potency: 2, sockets: 1, gems: [], stats: { damage: 42, strength: 8 } }];
            }));
            const player = { id: 'forge-presentation', level: 100, equipment,
                inventory: [{ name: 'Eidolon Shard', stack: 100000 }, { name: 'Eidolon Heart', stack: 100000 }] };
            ui.lastPlayerRef = player;
            const calls = []; forge.onForgeUpgrade = (...args) => calls.push(args);
            forge.toggle(); window.__forgePresentation = { ui, forge, player, calls };
        }, mobile);
        const forge = page.locator('#forge-screen');
        const first = forge.locator('#forge-equipment-list [data-slot="mainHand"]');
        await first.focus(); await page.keyboard.press('Enter');
        await expect(first.locator('.forge-item-label__name')).toBeVisible();
        for (const row of await forge.locator('#forge-equipment-list .forge-item-choice').all()) {
            const bounds = await row.boundingBox(), label = await row.locator('.forge-item-label').boundingBox();
            expect(label.y + label.height).toBeLessThanOrEqual(bounds.y + bounds.height - 2);
        }
        if (!mobile) {
            const list = await forge.locator('#forge-equipment-list').boundingBox(), info = await forge.locator('#forge-upgrade-info').boundingBox();
            expect(info.x).toBeGreaterThan(list.x + list.width);
        }
        const action = forge.locator('#btn-forge-upgrade-1');
        await action.scrollIntoViewIfNeeded(); await action.focus();
        await page.screenshot({ path: testInfo.outputPath('forge-upgrade.png') });
        await page.keyboard.press('Enter');
        expect(await page.evaluate(() => window.__forgePresentation.calls[0][2].level)).toBe(30);
        expect(await page.evaluate(() => window.__forgePresentation.player.equipment.mainHand.level)).toBe(30);
        await page.evaluate(() => {
            const { forge, player } = window.__forgePresentation;
            player.equipment.mainHand = { ...player.equipment.mainHand, level: 31, stats: { damage: 44, strength: 8 } };
            forge.refresh(player);
        });
        await expect(action).toBeFocused();
        await expect(forge.locator('#forge-upgrade-stats')).toContainText('Level: 31');
        await expect(first.locator('.forge-item-label__meta')).toContainText('Level 31');
        await page.evaluate(() => {
            const { forge, player } = window.__forgePresentation;
            Object.assign(player.equipment.mainHand, { level: 100, potency: 20, sockets: 4 }); forge.refresh(player);
        });
        await expect(action).toBeDisabled();
        await expect(action).toHaveText('Maximum level reached');
        await expect(forge.locator('#forge-upgrade-cost')).toBeHidden();
        await expect(forge.locator('#forge-upgrade-stats')).toContainText('Item level 100 reached');
        for (const [tab, list, info, button] of [
            ['potency', 'forge-potency-list', 'forge-potency-stats', 'btn-forge-potency'],
            ['socket', 'forge-socket-list', 'forge-socket-stats', 'btn-forge-socket']
        ]) {
            await forge.locator(`#tab-forge-${tab}`).click();
            await forge.locator(`#${list} [data-slot="mainHand"]`).click();
            await expect(forge.locator(`#${info} .forge-limit`)).toBeVisible();
            await expect(forge.locator(`#${button}`)).toBeDisabled();
            await expect(forge.locator(`#forge-${tab}-cost`)).toBeHidden();
            await forge.locator(`#${button}`).scrollIntoViewIfNeeded();
            await page.screenshot({ path: testInfo.outputPath(`forge-${tab}-cap.png`) });
        }
        expect(await forge.locator('.window-body').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
        expect(await page.evaluate(() => window.__forgePresentation.calls.length)).toBe(1);
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
