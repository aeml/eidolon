import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

for (const [width, height, mobile] of [[1280, 900, false], [900, 650, false], [390, 844, true]]) {
    test(`${width}px character sheet keeps build and progression controls usable`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async mobile => {
            const { UIManager } = await import('/src/ui/UIManager.js');
            const { BASE_ITEMS, RARITY } = await import('/src/core/ItemSystem.js');
            document.getElementById('start-screen').style.display = 'none';
            document.body.classList.toggle('mobile-mode', mobile);
            const equipment = Object.fromEntries(['head', 'chest', 'legs', 'feet', 'mainHand'].map(slot => {
                const item = BASE_ITEMS.find(item => item.slot === slot);
                return [slot, { ...item, id: `review-${slot}`, rarity: RARITY.RARE, level: 30, potency: 3, stats: { strength: 8 } }];
            }));
            const player = { id: 'character-sheet-review', subType: 'Fighter', isMultiplayer: true,
                level: 100, xp: 0, xpToNextLevel: 100000, resonanceLevel: 4, resonanceXP: 1234567,
                resonanceXPToNext: 5000000, resonancePoints: 2, resonanceRanks: { power: 2, ward: 1, fortune: 1 },
                statPoints: 0, equipment, inventory: [], gold: 1000,
                stats: { hp: 1620, maxHp: 1800, mana: 90, maxMana: 120, strength: 150, dexterity: 85,
                    intelligence: 40, vitality: 125, wisdom: 42, damage: 325, defense: 160 },
                baseStats: { strength: 120, dexterity: 75, intelligence: 40, vitality: 100, wisdom: 40 } };
            const ui = new UIManager(mobile), spends = [];
            ui.onResonanceSpend = trait => spends.push(trait);
            ui.lastPlayerRef = player;
            ui.showHUD(); ui.toggleCharacterSheet();
            window.__characterSheet = { ui, player, spends };
        }, mobile);
        const sheet = page.locator('#character-sheet');
        await expect(sheet).toBeVisible();
        await expect(sheet.locator('.character-preview-stage canvas')).toBeVisible();
        expect(await sheet.locator('.char-sheet-body').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
        const garments = sheet.getByRole('group', { name: 'Garment appearances' });
        const buttons = garments.getByRole('button');
        await expect(buttons).toHaveCount(3);
        expect(await buttons.allTextContents()).toEqual(['Weapon GarmentOriginal gear', 'Armor GarmentOriginal gear', 'Offhand GarmentOriginal gear']);
        if (mobile) {
            await page.evaluate(() => window.__characterSheet.ui.setUiScale(125));
            const sizes = await garments.locator('.garment-slot-label, .garment-slot-look')
                .evaluateAll(nodes => nodes.map(node => Number.parseFloat(getComputedStyle(node).fontSize)));
            expect(sizes).toEqual([20, 20, 20, 20, 20, 20]);
        }
        const preview = await sheet.locator('.character-preview').boundingBox();
        const row = await garments.boundingBox();
        expect(row.y).toBeGreaterThanOrEqual(preview.y + preview.height);
        expect(row.x + row.width / 2).toBeCloseTo(preview.x + preview.width / 2, 0);
        const boxes = await Promise.all([0, 1, 2].map(i => buttons.nth(i).boundingBox()));
        expect(boxes.every(box => Math.abs(box.y - boxes[0].y) < 1 && box.height >= 44)).toBe(true);
        expect(boxes[1].x).toBeGreaterThan(boxes[0].x + boxes[0].width);
        expect(boxes[2].x).toBeGreaterThan(boxes[1].x + boxes[1].width);
        expect(await garments.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);

        if (!mobile && width >= 1000) {
            const gear = await sheet.locator('.equipment-slots').boundingBox(), stats = await sheet.locator('#stats-content').boundingBox();
            expect(stats.x).toBeGreaterThanOrEqual(gear.x + gear.width);
            expect(Math.abs(stats.y - gear.y)).toBeLessThan(2);
        }
        await page.screenshot({ path: testInfo.outputPath('character-build.png') });
        const power = sheet.locator('[data-resonance-trait="power"]');
        await power.scrollIntoViewIfNeeded();
        await power.focus();
        const original = await power.elementHandle();
        const scrollBefore = await sheet.locator('.char-sheet-body').evaluate(node => node.scrollTop);
        await page.evaluate(() => {
            const { ui, player } = window.__characterSheet;
            player.stats.hp = 1630; player.stats.mana = 91; player.stats.strength = 151;
            player.resonanceXP = 1235000;
            ui.updateCharacterSheet(player);
        });
        expect(await original.evaluate(node => node.isConnected)).toBe(true);
        await expect(power).toBeFocused();
        await expect(sheet.locator('[data-character-value="hp"]')).toHaveText('1,630 / 1,800');
        await expect(sheet.locator('[data-character-bonus="strength"]')).toHaveText('(+31)');
        expect(await sheet.locator('.char-sheet-body').evaluate(node => node.scrollTop)).toBeCloseTo(scrollBefore, 0);
        await page.keyboard.press('Enter');
        expect(await page.evaluate(() => window.__characterSheet.spends)).toEqual(['power']);
        expect(await page.evaluate(() => window.__characterSheet.player.resonancePoints)).toBe(2);
        if (mobile) expect((await power.boundingBox()).height).toBeGreaterThanOrEqual(44);
        await page.screenshot({ path: testInfo.outputPath('character-progression.png') });
        const requests = await page.evaluate(() => {
            const { ui } = window.__characterSheet;
            const requests = []; ui.onWardrobeRequest = (type, payload) => requests.push({ type, payload });
            window.__characterSheet.requests = requests;
            return requests;
        });
        expect(requests).toEqual([]);
        for (const [index, slot] of ['mainHand', 'outfit', 'offHand'].entries()) {
            await buttons.nth(index).scrollIntoViewIfNeeded();
            await buttons.nth(index).focus(); await page.keyboard.press('Enter');
            await expect(sheet.getByRole('combobox', { name: 'Appearance slot' })).toHaveValue(slot);
            await expect(sheet.getByRole('combobox', { name: 'Collected appearance' })).toBeFocused();
        }
        expect(await page.evaluate(() => window.__characterSheet.requests.some(request => request.type === 'select_appearance'))).toBe(false);
        await page.evaluate(() => {
            const { ui, player } = window.__characterSheet;
            window.__characterSheet.gearBefore = JSON.stringify(player.equipment);
            player.appearances = { mainHand: { baseName: 'Grovekeeper Blade', rarity: 'Common', slot: 'mainHand' }, outfit: { baseName: 'Iron Oath Regalia', rarity: 'Common', slot: 'outfit' }, offHand: { baseName: 'Grovekeeper Shield', rarity: 'Common', slot: 'offHand' } };
            ui.updateCharacterSheet(player);
            ui.wardrobe.root.open = false;
        });
        await garments.scrollIntoViewIfNeeded();
        await expect(buttons.nth(0)).toContainText('Grovekeeper Blade');
        await expect(buttons.nth(1)).toContainText('Iron Oath Regalia');
        await expect(buttons.nth(2)).toContainText('Grovekeeper Shield');
        expect(await garments.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
        expect(await page.evaluate(() => JSON.stringify(window.__characterSheet.player.equipment) === window.__characterSheet.gearBefore)).toBe(true);
        await page.screenshot({ path: testInfo.outputPath('character-garment-slots.png') });
        // A long wardrobe form must offer a direct return to the model on
        // desktop and enlarged phone text, preserving its confirmed choices.
        await buttons.nth(2).click();
        const wardrobe = sheet.locator('.wardrobe-panel');
        const viewCharacter = wardrobe.getByRole('button', { name: 'View character', exact: true });
        await viewCharacter.scrollIntoViewIfNeeded();
        const actions = await wardrobe.locator('.wardrobe-actions button').evaluateAll(nodes => nodes.map(node => {
            const r = node.getBoundingClientRect(); return { height: r.height, fits: node.scrollWidth <= node.clientWidth + 1 };
        }));
        expect(actions.every(action => action.height >= 44 && action.fits)).toBe(true);
        if (mobile) {
            const formSizes = await wardrobe.locator('.equipment-loadouts-body :is(p, label, select, button)')
                .evaluateAll(nodes => nodes.map(node => Number.parseFloat(getComputedStyle(node).fontSize)));
            expect(formSizes).toEqual(Array(formSizes.length).fill(20));
        }
        await viewCharacter.click();
        await expect(sheet.locator('#character-preview')).toBeInViewport({ ratio: 1 });
        await expect(sheet.getByRole('button', { name: 'Reset character view', exact: true })).toBeFocused();
        expect(await page.evaluate(() => JSON.stringify(window.__characterSheet.player.equipment) === window.__characterSheet.gearBefore)).toBe(true);
        expect(await page.evaluate(() => window.__characterSheet.requests.some(request => request.type === 'select_appearance'))).toBe(false);
        await page.screenshot({ path: testInfo.outputPath('character-wardrobe-return.png') });


        expect(failures, failures.join('\n')).toEqual([]);
    });
}
