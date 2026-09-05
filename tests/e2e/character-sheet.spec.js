import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test('equipped preview, keyboard slots and persistent chat survive responsive sheet use', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });
    // Production markup, UI, item icons and renderer; no account or server writes.
    await page.evaluate(async () => {
        const { UIManager } = await import('/src/ui/UIManager.js');
        const { BASE_ITEMS, RARITY } = await import('/src/core/ItemSystem.js');
        const { EQUIPMENT_RENDER_SLOTS } = await import('/src/art/ProceduralEquipment.js');
        document.getElementById('start-screen').style.display = 'none';
        const ui = new UIManager(false);
        const equipment = Object.fromEntries(EQUIPMENT_RENDER_SLOTS.map((slot) => {
            const baseSlot = slot.replace(/[12]$/, '');
            const item = BASE_ITEMS.find((item) => item.slot === baseSlot);
            return [slot, { ...item, id: `preview-${slot}`, baseName: item.name, rarity: RARITY.RARE, level: 30, potency: 2, stats: {} }];
        }));
        const player = {
            subType: 'Fighter', level: 30, xp: 420, xpToNextLevel: 1000, statPoints: 2,
            stats: { hp: 350, maxHp: 420, mana: 80, maxMana: 100, strength: 40, dexterity: 20, intelligence: 12, vitality: 32, wisdom: 16, damage: 72, defense: 48 },
            baseStats: { strength: 35, dexterity: 20, intelligence: 12, vitality: 30, wisdom: 16 },
            equipment, inventory: [], gold: 250
        };
        ui.lastPlayerRef = player;
        ui.inventory.onUnequipRequest = (slot) => { delete player.equipment[slot]; ui.updateCharacterSheet(player); };
        window.__characterSheetFixture = { ui, player };
        ui.toggleChat(true);
        ui.toggleCharacterSheet();
    });
    const sheet = page.locator('#character-sheet');
    const canvas = sheet.locator('canvas');
    await expect(canvas).toBeVisible();
    await expect(sheet.locator('button.equip-slot')).toHaveCount(14);
    expect(await page.evaluate(() => window.__characterSheetFixture.ui.characterPreview.model.userData.equipmentVisualItemCount)).toBe(14);

    for (const type of ['Fighter', 'Rogue', 'Wizard', 'Cleric']) {
        await page.evaluate((type) => {
            const { ui, player } = window.__characterSheetFixture;
            player.subType = type;
            ui.updateCharacterSheet(player);
        }, type);
        await expect(sheet.locator('.character-preview-label')).toHaveText(`${type} · Level 30`);
        await sheet.screenshot({ path: testInfo.outputPath(`sheet-${type}.png`) });
    }
    const initialYaw = await page.evaluate(() => window.__characterSheetFixture.ui.characterPreview.yaw);
    await page.getByRole('button', { name: 'Rotate character right' }).click();
    expect(await page.evaluate(() => window.__characterSheetFixture.ui.characterPreview.yaw)).toBeGreaterThan(initialYaw);
    await page.getByRole('button', { name: 'Reset character view' }).click();
    expect(await page.evaluate(() => window.__characterSheetFixture.ui.characterPreview.yaw)).toBe(initialYaw);
    await page.locator('#slot-head').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#slot-head')).toHaveAttribute('aria-label', 'HEAD: empty');
    await expect(page.locator('#slot-head')).toBeFocused();
    expect(await page.evaluate(() => window.__characterSheetFixture.ui.characterPreview.model.userData.equipmentVisualItemCount)).toBe(13);

    for (const [name, width, height] of [['short', 1280, 600], ['mobile', 390, 844], ['narrow', 320, 720]]) {
        await page.setViewportSize({ width, height });
        await page.evaluate(() => {
            const { ui } = window.__characterSheetFixture;
            ui.toggleCharacterSheet();
            ui.toggleCharacterSheet();
        });
        const bounds = await sheet.boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.y).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
        expect(await sheet.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
        for (const slot of await sheet.locator('.equip-slot').all()) {
            await slot.scrollIntoViewIfNeeded();
            await expect(slot).toBeInViewport();
        }
        await sheet.locator('.char-sheet-body').evaluate((element) => { element.scrollTop = 0; });
        await page.screenshot({ path: testInfo.outputPath(`sheet-${name}.png`) });
    }
    await expect(page.locator('#chat-box')).toBeVisible();
    await page.evaluate(() => window.__characterSheetFixture.ui.handleEscape());
    await expect(sheet).toBeHidden();
    await expect(page.locator('#chat-box')).toBeVisible();
    await page.evaluate(() => window.__characterSheetFixture.ui.characterPreview.dispose());
    await expect(canvas).toHaveCount(0);
    expect(failures, failures.join('\n')).toEqual([]);
});
