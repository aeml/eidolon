import { test, expect } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

for (const quality of ['high', 'low']) test(`complete garment vendor preview compares and applies independently ${quality}`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL), requests = [];
    page.on('request', request => { if (request.url().includes('/assets/garments/')) requests.push(request.url()); });
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: quality === 'low' ? 390 : 1280, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const expectedVersion = await page.evaluate(async quality => {
        const { CosmeticVendorUI } = await import('/src/ui/CosmeticVendorUI.js');
        const { COSMETIC_CATALOGUE } = await import('/src/data/cosmetics.generated.js');
        const { GARMENT_MODELS } = await import('/src/assets/garments.generated.js');
        const { BASE_ITEMS } = await import('/src/core/ItemSystem.js');
        document.getElementById('start-screen').style.display = 'none';
        const gear = Object.fromEntries([['chest', 'Robes'], ['mainHand', 'Iron Sword'], ['offHand', 'Wooden Shield']]
            .map(([slot, name]) => [slot, { ...BASE_ITEMS.find(item => item.name === name), id: `real-${slot}`, baseName: name, rarity: 'Rare' }]));
        const player = { id: 'garment-preview', subType: 'Fighter', level: 10, state: 'IDLE', position: { x: 12, z: 185 },
            mesh: { userData: { authoredQuality: quality } }, equipment: gear, appearances: {}, ep: 75 };
        const sent = [], ui = new CosmeticVendorUI({ getPlayer: () => player, send: (type, payload) => sent.push({ type, payload }) });
        const source = COSMETIC_CATALOGUE.find(offer => offer.kind === 'outfit');
        const offer = { ...source, appearance: { baseName: source.name, rarity: 'Common', slot: 'outfit' } };
        ui.open(); ui.handleResult({ playerID: player.id, success: true, pending: false, ep: 75, catalogue: [offer], collection: { [`${offer.name}|Common`]: offer.appearance } });
        window.__garmentPreview = { ui, player, sent, original: JSON.stringify(gear) };
        return GARMENT_MODELS.outfits[source.name].models.Fighter[quality].sha256.slice(0, 16);
    }, quality);
    const dialog = page.getByRole('dialog');
    await expect.poll(() => page.evaluate(() => window.__garmentPreview.ui.preview?.model?.userData.equipmentVisualGarment)).toBe('iron-oath-regalia-v1');
    await expect(dialog.getByRole('button', { name: 'Apply complete outfit', exact: true })).toBeEnabled();
    await dialog.locator('.character-preview-stage').scrollIntoViewIfNeeded();
    await dialog.screenshot({ path: testInfo.outputPath('selected-garment-preview.png') });
    await dialog.getByRole('button', { name: 'Show equipped look', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__garmentPreview.ui.preview.model.userData.equipmentVisualGarment)).toBe('');
    await dialog.getByRole('button', { name: 'Show selected cosmetic', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__garmentPreview.ui.preview.model.userData.equipmentVisualGarment)).toBe('iron-oath-regalia-v1');
    await dialog.getByRole('button', { name: 'Rotate preview right', exact: true }).click();
    await dialog.getByRole('button', { name: 'Apply complete outfit', exact: true }).click();
    expect(await page.evaluate(() => window.__garmentPreview.sent.at(-1))).toEqual({ type: 'select_appearance', payload: { slot: 'outfit', key: 'Iron Oath Regalia|Common' } });
    expect(await page.evaluate(() => JSON.stringify(window.__garmentPreview.player.equipment) === window.__garmentPreview.original && Object.keys(window.__garmentPreview.player.appearances).length === 0)).toBe(true);
    expect(requests.some(url => url.includes(`v=${expectedVersion}`))).toBe(true);
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.evaluate(() => window.__garmentPreview.ui.dispose());
    await expect(dialog).toHaveCount(0);
    expect(failures, failures.join('\n')).toEqual([]);
});
