import { test, expect } from '@playwright/test';
import { HELD_GARMENT_MODELS } from '../../src/assets/heldGarments.generated.js';
import { collectBrowserFailures } from './helpers.js';

for (const model of Object.values(HELD_GARMENT_MODELS)) for (const quality of ['high', 'low']) {
    test(`${model.name} preview compares and selects the real held model ${quality}`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL), requests = [];
        page.on('request', request => { if (request.url().includes(`/assets/garments/${model.id}/`)) requests.push(request.url()); });
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width: quality === 'low' ? 390 : 1280, height: 900 });
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async ({ model, quality }) => {
            const { CosmeticVendorUI } = await import('/src/ui/CosmeticVendorUI.js');
            const { COSMETIC_CATALOGUE } = await import('/src/data/cosmetics.generated.js');
            const { BASE_ITEMS } = await import('/src/core/ItemSystem.js');
            document.getElementById('start-screen').style.display = 'none';
            const actorClass = model.base === 'Wooden Staff' || model.base === 'Spell Tome' ? 'Wizard' : model.base === 'Cleric Mace' ? 'Cleric' : 'Fighter';
            const gear = { [model.slot]: { ...BASE_ITEMS.find(item => item.name === model.base), id: 'real-held', baseName: model.base, rarity: 'Rare' } };
            const player = { id: 'held-preview', subType: actorClass, level: 10, state: 'IDLE', position: { x: 12, z: 185 },
                mesh: { userData: { authoredQuality: quality } }, equipment: gear, appearances: {}, ep: 75 };
            const sent = [], ui = new CosmeticVendorUI({ getPlayer: () => player, send: (type, payload) => sent.push({ type, payload }) });
            const source = COSMETIC_CATALOGUE.find(offer => offer.id === model.id);
            const offer = { ...source, appearance: { baseName: source.name, rarity: 'Common', slot: model.slot } };
            ui.open(); ui.handleResult({ playerID: player.id, success: true, pending: false, ep: 75, catalogue: [offer], collection: { [`${offer.name}|Common`]: offer.appearance } });
            window.__heldPreview = { ui, player, sent, original: JSON.stringify(gear) };
        }, { model, quality });
        const selectedIDs = () => page.evaluate(() => {
            const ids = []; window.__heldPreview.ui.preview?.model?.traverse(part => { if (part.userData.garmentId) ids.push(part.userData.garmentId); }); return ids;
        });
        const dialog = page.getByRole('dialog');
        await expect.poll(selectedIDs).toEqual([model.id]);
        await dialog.locator('.character-preview-stage').scrollIntoViewIfNeeded();
        await dialog.screenshot({ path: testInfo.outputPath('held-garment-preview.png') });
        const fullHeight = await page.evaluate(() => window.__heldPreview.ui.preview.camera.top);
        await dialog.getByRole('button', { name: 'Inspect held look', exact: true }).click();
        await expect(dialog.getByRole('button', { name: 'Show full character', exact: true })).toHaveAttribute('aria-pressed', 'true');
        expect(await page.evaluate(() => window.__heldPreview.ui.preview.camera.top)).toBeLessThan(fullHeight);
        await dialog.screenshot({ path: testInfo.outputPath('held-garment-detail.png') });
        await dialog.getByRole('button', { name: 'Show equipped look', exact: true }).click();
        await expect.poll(selectedIDs).toEqual([]);
        await dialog.getByRole('button', { name: 'Show selected cosmetic', exact: true }).click();
        await expect.poll(selectedIDs).toEqual([model.id]);
        await dialog.getByRole('button', { name: 'Rotate preview right', exact: true }).click();
        await dialog.getByRole('button', { name: 'Show full character', exact: true }).click();
        expect(await page.evaluate(() => window.__heldPreview.ui.preview.camera.top)).toBe(fullHeight);
        await dialog.getByRole('button', { name: 'Apply owned look', exact: true }).click();
        expect(await page.evaluate(() => window.__heldPreview.sent.at(-1))).toEqual({ type: 'select_appearance', payload: { slot: model.slot, key: `${model.name}|Common` } });
        expect(await page.evaluate(() => JSON.stringify(window.__heldPreview.player.equipment) === window.__heldPreview.original && Object.keys(window.__heldPreview.player.appearances).length === 0)).toBe(true);
        expect(requests.some(url => url.includes(`v=${model.models[quality].sha256.slice(0, 16)}`))).toBe(true);
        expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
        await page.evaluate(() => window.__heldPreview.ui.dispose());
        await expect(dialog).toHaveCount(0);
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
