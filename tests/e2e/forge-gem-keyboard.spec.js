import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

for (const [width, mobile] of [[1280, false], [390, true]]) {
    test(`${width}px Forge gems retain keyboard choices, quotes and reading position`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height: 844 });
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async mobile => {
            const { UIManager } = await import('/src/ui/UIManager.js');
            const { BASE_ITEMS, RARITY } = await import('/src/core/ItemSystem.js');
            document.getElementById('start-screen').style.display = 'none';
            document.body.classList.toggle('mobile-mode', mobile);
            const ui = new UIManager(mobile), forge = ui.forge;
            const staff = { ...BASE_ITEMS.find(item => item.name === 'Wooden Staff'),
                id: 'keyboard-staff', name: 'Ash Staff', rarity: RARITY.RARE, sockets: 2,
                gems: [{ type: 'Ruby', quality: 'Chipped', stats: {} }] };
            const inventory = Array.from({ length: 30 }, (_, i) => ({ id: `ruby-${i}`, type: 'GEM',
                gemType: 'Ruby', gemQuality: 'Chipped', stack: i === 0 ? 6 : 1 }));
            inventory.push({ id: 'sapphire', type: 'GEM', gemType: 'Sapphire', gemQuality: 'Chipped', stack: 3 },
                { id: 'radiant', type: 'GEM', gemType: 'Ruby', gemQuality: 'RADIANT', stack: 3 });
            const player = { id: 'forge-keyboard', level: 100, equipment: { mainHand: staff }, inventory };
            ui.lastPlayerRef = player;
            const calls = [];
            for (const operation of ['Insert', 'Combine', 'Remove']) {
                forge[`onForge${operation}Gem`] = (...args) => calls.push({ operation, args });
            }
            forge.toggle(); forge.switchForgeTab('gems');
            window.__gemKeyboard = { ui, forge, player, calls };
        }, mobile);

        const equipment = page.locator('#forge-gem-equipment .forge-item-choice');
        await equipment.focus(); await page.keyboard.press('Enter');
        await expect(equipment).toBeFocused();
        await expect(equipment).toHaveAttribute('aria-pressed', 'true');
        await page.keyboard.press('Tab');
        const ruby = page.locator('#forge-gem-inventory button').first();
        await expect(ruby).toBeFocused();
        await page.keyboard.press('Space');
        await expect(ruby).toBeFocused();
        await expect(ruby).toHaveAttribute('aria-pressed', 'true');
        await expect(page.getByRole('button', { name: 'Socket 1:', exact: false })).toBeDisabled();
        const empty = page.getByRole('button', { name: 'Empty socket 2 on Ash Staff', exact: true });
        await empty.focus(); await page.keyboard.press('Enter');
        await expect(empty).toBeFocused();
        await expect(empty).toHaveAttribute('aria-pressed', 'true');
        const insert = page.locator('#btn-forge-insert-gem');
        await expect(insert).toBeEnabled(); await insert.focus(); await page.keyboard.press('Enter');
        expect(await page.evaluate(() => window.__gemKeyboard.calls)).toEqual([
            { operation: 'Insert', args: ['mainHand', 0, 1, expect.objectContaining({ itemId: 'keyboard-staff', gemIds: ['ruby-0'], gemCounts: [6] })] }
        ]);

        await page.locator('#tab-gem-combine').click();
        const combine = page.locator('#forge-gem-combine-inventory');
        const lastRuby = combine.getByRole('button', { name: 'Chipped Ruby ×1; 0 selected', exact: true }).last();
        await lastRuby.focus();
        const scroll = await combine.evaluate(node => node.scrollTop);
        expect(scroll).toBeGreaterThan(0);
        await page.keyboard.press('Space');
        await expect(combine.getByRole('button', { name: 'Chipped Ruby ×1; 1 selected', exact: true })).toBeFocused();
        expect(await combine.evaluate(node => node.scrollTop)).toBe(scroll);
        await expect(combine.getByRole('button', { name: /^Chipped Sapphire/ })).toBeDisabled();
        await expect(combine.getByRole('button', { name: /^Radiant Ruby/ })).toBeDisabled();
        await combine.getByRole('button', { name: 'Chipped Ruby ×6; 0 selected', exact: true }).focus();
        await page.keyboard.press('Enter');
        const stack = combine.getByRole('button', { name: 'Chipped Ruby ×6; 2 selected', exact: true });
        await expect(stack).toBeFocused();
        await expect(stack).toHaveAttribute('aria-pressed', 'true');
        await page.screenshot({ path: testInfo.outputPath('forge-gem-combine-keyboard.png') });
        await expect(combine.getByRole('button', { name: 'Chipped Ruby ×1; 0 selected', exact: true }).first()).toBeDisabled();
        await page.keyboard.press('Space');
        await expect(combine.getByRole('button', { name: 'Chipped Ruby ×6; 0 selected', exact: true })).toBeFocused();
        await page.keyboard.press('Enter');
        await page.locator('#btn-forge-combine-gem').focus(); await page.keyboard.press('Space');
        expect(await page.evaluate(() => window.__gemKeyboard.calls[1])).toEqual({ operation: 'Combine', args: [
            [29, 0, 0], { gemIds: ['ruby-29', 'ruby-0', 'ruby-0'], gemCounts: [1, 6, 6] }
        ] });

        await page.locator('#tab-gem-remove').click();
        const removalEquipment = page.locator('#forge-gem-remove-equipment .forge-item-choice');
        await removalEquipment.focus(); await page.keyboard.press('Space');
        await expect(removalEquipment).toBeFocused();
        const socket = page.locator('#forge-gem-remove-slots').getByRole('button', { name: /^Socket 1: Chipped Ruby/ });
        await socket.focus(); await page.keyboard.press('Enter');
        await expect(socket).toBeFocused();
        await expect(socket).toHaveAttribute('aria-pressed', 'true');
        expect(await socket.evaluate(node => [node.offsetWidth, node.offsetHeight])).toEqual([44, 44]);
        await page.screenshot({ path: testInfo.outputPath('forge-gem-removal-keyboard.png') });
        await page.locator('#btn-forge-remove-gem').focus(); await page.keyboard.press('Enter');
        expect(await page.evaluate(() => window.__gemKeyboard.calls[2])).toEqual({ operation: 'Remove', args: [
            'mainHand', 0, expect.objectContaining({ itemId: 'keyboard-staff', gems: [{ type: 'Ruby', quality: 'Chipped', stats: {} }] })
        ] });
        expect(await page.evaluate(() => window.__gemKeyboard.calls.length)).toBe(3);
        expect(await page.evaluate(() => window.__gemKeyboard.player.equipment.mainHand.gems.length)).toBe(1);
        expect(await page.evaluate(() => window.__gemKeyboard.player.inventory[0].stack)).toBe(6);

        // A refreshed item must require a new destructive choice, and an
        // inventory reorder must follow the focused identity without selecting it.
        await socket.focus(); await page.keyboard.press('Enter');
        await page.evaluate(() => {
            const { forge, player } = window.__gemKeyboard;
            player.equipment.mainHand = { ...player.equipment.mainHand, id: 'replacement-staff' };
            forge.refreshGemPanels(player);
        });
        await expect(page.locator('#btn-forge-remove-gem')).toBeDisabled();
        await expect(page.getByRole('group', { name: 'Socketed gems for removal', exact: true })).toBeFocused();
        await page.evaluate(() => {
            const { forge, player } = window.__gemKeyboard;
            delete player.equipment.mainHand; forge.refreshGemPanels(player);
        });
        await expect(page.getByRole('group', { name: 'Equipment with socketed gems', exact: true })).toBeFocused();
        await page.locator('#tab-gem-insert').click();
        const inventory = page.getByRole('group', { name: 'Gems in inventory', exact: true });
        const focusedGem = inventory.getByRole('button', { name: 'Chipped Ruby ×6', exact: true });
        await focusedGem.focus(); await page.keyboard.press('Enter');
        await page.evaluate(() => {
            const { forge, player } = window.__gemKeyboard;
            player.inventory.reverse(); forge.refreshGemPanels(player);
        });
        await expect(focusedGem).toBeFocused();
        await expect(focusedGem).toHaveAttribute('aria-pressed', 'false');
        await expect(insert).toBeDisabled();
        expect(await focusedGem.evaluate(node => {
            const bounds = node.getBoundingClientRect(), group = node.parentElement.getBoundingClientRect();
            return bounds.top >= group.top && bounds.bottom <= group.bottom;
        })).toBe(true);
        await page.evaluate(() => {
            const { forge, player } = window.__gemKeyboard;
            player.inventory = player.inventory.filter(gem => gem.id !== 'ruby-0'); forge.refreshGemPanels(player);
        });
        await expect(inventory).toBeFocused();
        expect(await page.evaluate(() => window.__gemKeyboard.calls.length)).toBe(3);
        expect(await page.locator('#forge-screen .window-body').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
