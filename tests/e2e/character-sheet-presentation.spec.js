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
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
