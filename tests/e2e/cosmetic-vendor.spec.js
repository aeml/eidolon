import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test('earned season medallions fit the rigged Fighter and remain separate from real gear', async ({ page, baseURL }, testInfo) => {
    test.setTimeout(45_000);
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });
    // Native production UI/rendering with supplied server-result fixtures. The
    // game/handler/storage tests establish entitlement; this cannot award it.
    await page.evaluate(async () => {
        const { UIManager } = await import('/src/ui/UIManager.js');
        const { BASE_ITEMS } = await import('/src/core/ItemSystem.js');
        const { SEASON_COSMETIC_CATALOGUE } = await import('/src/data/cosmetics.generated.js');
        document.getElementById('start-screen').style.display = 'none';
        const item = BASE_ITEMS.find(item => item.name === 'Pendant');
        const player = { id: 'earned-medallion-review', subType: 'Fighter', level: 70,
            stats: { hp: 350, maxHp: 420, mana: 80, maxMana: 100, strength: 40, dexterity: 20, intelligence: 12, vitality: 32, wisdom: 16, damage: 72, defense: 48 },
            baseStats: { strength: 35, dexterity: 20, intelligence: 12, vitality: 30, wisdom: 16 },
            equipment: { neck: { ...item, id: 'real-pendant', rarity: 'Rare', stats: { vitality: 7 } } },
            inventory: [], appearances: {}, gold: 250, ep: 10 };
        const collection = Object.fromEntries(SEASON_COSMETIC_CATALOGUE.map(offer => [`${offer.name}|Common`, { baseName: offer.name, rarity: 'Common', slot: 'neck' }]));
        const ui = new UIManager(false), requests = [], original = JSON.stringify(player.equipment);
        ui.lastPlayerRef = player;
        ui.onWardrobeRequest = (type, payload) => {
            requests.push({ type, payload });
            if (type === 'select_appearance') {
                if (payload.key) player.appearances.neck = collection[payload.key];
                else delete player.appearances.neck;
                ui.updateCharacterSheet(player);
            }
            ui.wardrobe.handleResult({ success: true, message: 'Appearance updated. Combat stats are unchanged.', collection });
        };
        ui.showHUD(); ui.toggleCharacterSheet();
        window.__seasonCosmetic = { ui, player, collection, original, requests };
    });
    const sheet = page.locator('#character-sheet');
    const wardrobe = sheet.locator('.wardrobe-panel');
    await expect.poll(() => page.evaluate(() => window.__seasonCosmetic.ui.characterPreview.model.userData.authoredClass)).toBe('Fighter');
    await wardrobe.locator('summary').click();
    await wardrobe.getByLabel('Appearance slot', { exact: true }).selectOption('neck');
    await expect(wardrobe).toContainText('Current projections are not earned looks');
    for (const medal of ['Bronze', 'Silver', 'Gold']) {
        await wardrobe.getByLabel('Collected appearance', { exact: true }).selectOption(`${medal} Arena Medallion|Common`);
        await wardrobe.getByRole('button', { name: 'Apply appearance', exact: true }).click();
        expect(await page.evaluate(() => window.__seasonCosmetic.ui.characterPreview.model.userData.equipmentVisualSignature)).toContain(`${medal} Arena Medallion`);
        expect(await page.evaluate(() => {
            const f = window.__seasonCosmetic;
            return JSON.stringify(f.player.equipment) === f.original && f.player.gold === 250 && f.player.ep === 10;
        })).toBe(true);
        await sheet.locator('.character-preview-stage').scrollIntoViewIfNeeded();
        await sheet.screenshot({ path: testInfo.outputPath(`earned-${medal.toLowerCase()}-medallion.png`) });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await wardrobe.scrollIntoViewIfNeeded();
    expect(await wardrobe.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await sheet.screenshot({ path: testInfo.outputPath('earned-medallion-mobile-controls.png') });
    await wardrobe.getByLabel('Collected appearance', { exact: true }).selectOption('');
    await wardrobe.getByRole('button', { name: 'Apply appearance', exact: true }).click();
    expect(await page.evaluate(() => window.__seasonCosmetic.player.appearances)).toEqual({});
    await page.evaluate(() => window.__seasonCosmetic.ui.characterPreview.dispose());
    expect(failures, failures.join('\n')).toEqual([]);
});

for (const width of [390, 1440]) test(`cosmetic vendor previews, confirms and applies without changing gear at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
        const { CosmeticVendorUI } = await import('/src/ui/CosmeticVendorUI.js');
        const { COSMETIC_CATALOGUE } = await import('/src/data/cosmetics.generated.js');
        const { resolveEquipmentVisualDescriptor } = await import('/src/art/ProceduralEquipment.js');
        document.getElementById('start-screen').style.display = 'none';
        const player = { id: 'vendor-preview-hero', subType: 'Fighter', level: 70, state: 'IDLE', position: { x: 12, z: 185 },
            equipment: { chest: { id: 'earned-chest', name: 'Plate Mail', rarity: 'Rare', type: 'ARMOR', slot: 'chest', stats: { defense: 99 } },
                mainHand: { id: 'earned-sword', name: 'Iron Sword', rarity: 'Rare', type: 'WEAPON', slot: 'mainHand' } }, appearances: {} };
        const catalogue = COSMETIC_CATALOGUE.map(offer => ({ ...offer, appearance: { baseName: offer.name, rarity: 'Common', slot: resolveEquipmentVisualDescriptor({ name: offer.base }).slot } }));
        const collection = {}; let ep = 100;
        const requests = [], original = JSON.stringify(player.equipment);
        const ui = new CosmeticVendorUI({ getPlayer: () => player, send: (type, payload) => {
            requests.push({ type, payload });
            if (type === 'buy_cosmetic') {
                const offer = catalogue.find(o => o.id === payload.id);
                ep -= offer.priceEP; collection[`${offer.name}|Common`] = offer.appearance;
            }
            if (type === 'select_appearance') {
                player.appearances[payload.slot] = collection[payload.key];
                ui.handleAppearanceResult({ success: true, message: 'Appearance updated. Combat stats are unchanged.' });
            } else ui.handleResult({ success: true, pending: false, id: payload.id, ep, collection, catalogue });
        } });
        window.__cosmeticFixture = { ui, player, original, requests };
        ui.open();
    });
    const dialog = page.getByRole('dialog', { name: 'Veyra’s cosmetic wardrobe' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.cosmetic-catalogue button')).toHaveCount(12);
    const cardBounds = await dialog.locator('.cosmetic-catalogue button').evaluateAll(cards => cards.map(card => ({
        height: card.clientHeight, content: card.scrollHeight
    })));
    for (const card of cardBounds) { expect(card.height).toBeGreaterThanOrEqual(48); expect(card.content - card.height).toBeLessThanOrEqual(1); }
    await expect(dialog.locator('canvas')).toHaveCount(1);
    expect(await page.evaluate(() => window.__cosmeticFixture.ui.preview.failed || false)).toBe(false);
    await dialog.locator('[data-offer-id="grovekeeper-blade-v1"]').click();
    expect(await page.evaluate(() => window.__cosmeticFixture.ui.preview.model.userData.equipmentVisualSignature)).toContain('Grovekeeper Blade');
    await dialog.getByRole('button', { name: 'Show equipped look', exact: true }).click();
    expect(await page.evaluate(() => window.__cosmeticFixture.ui.preview.model.userData.equipmentVisualSignature)).not.toContain('Grovekeeper Blade');
    await dialog.getByRole('button', { name: 'Show selected cosmetic', exact: true }).click();
    await dialog.locator('.cosmetic-preview').scrollIntoViewIfNeeded();
    await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeInViewport();
    await page.screenshot({ path: `/tmp/eidolon-cosmetic-vendor-${width}.png` });
    await dialog.getByRole('button', { name: 'Unlock for 15 EP', exact: true }).click();
    await expect(dialog.locator('.cosmetic-confirmation')).toContainText('Grovekeeper Blade for 15 EP');
    await dialog.getByRole('button', { name: 'Confirm EP purchase', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Already owned', exact: true })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Apply owned look', exact: true }).click();
    await expect(dialog.locator('.cosmetic-status')).toContainText('Combat stats are unchanged');
    expect(await page.evaluate(() => {
        const f = window.__cosmeticFixture;
        return JSON.stringify(f.player.equipment) === f.original && f.player.appearances.mainHand.baseName === 'Grovekeeper Blade';
    })).toBe(true);
    expect(await dialog.evaluate(n => n.scrollWidth - n.clientWidth)).toBeLessThanOrEqual(1);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(dialog.locator('canvas')).toHaveCount(0);
});
