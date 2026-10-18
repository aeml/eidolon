import { test, expect } from '@playwright/test';
import { GARMENT_MODELS } from '../../src/assets/garments.generated.js';
import { collectBrowserFailures } from './helpers.js';

for (const outfit of Object.values(GARMENT_MODELS.outfits)) for (const quality of ['high', 'low']) test(`${outfit.name} vendor preview compares and applies independently ${quality}`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL), requests = [];
    page.on('request', request => { if (request.url().includes('/assets/garments/')) requests.push(request.url()); });
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: quality === 'low' ? 390 : 1280, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const expectedVersion = await page.evaluate(async ({ quality, outfit }) => {
        const { CosmeticVendorUI } = await import('/src/ui/CosmeticVendorUI.js');
        const { COSMETIC_CATALOGUE } = await import('/src/data/cosmetics.generated.js');
        const { GARMENT_MODELS } = await import('/src/assets/garments.generated.js');
        const { BASE_ITEMS } = await import('/src/core/ItemSystem.js');
        document.getElementById('start-screen').style.display = 'none';
        const actorClass = ({ 'nightglass-cowl-v1': 'Rogue', 'dawn-reliquary-v1': 'Cleric', 'astral-sovereign-v1': 'Wizard' })[outfit.id] || 'Fighter';
        const chest = actorClass === 'Rogue' ? 'Leather Tunic' : actorClass === 'Fighter' ? 'Plate Mail' : 'Robes';
        const weapon = actorClass === 'Rogue' ? 'Steel Dagger' : actorClass === 'Cleric' ? 'Cleric Mace' : actorClass === 'Wizard' ? 'Wooden Staff' : 'Iron Sword';
        const offhand = actorClass === 'Rogue' ? 'Iron Sword' : actorClass === 'Wizard' ? 'Spell Tome' : 'Wooden Shield';
        const gear = Object.fromEntries([['chest', chest], ['mainHand', weapon], ['offHand', offhand]]
            .map(([slot, name]) => [slot, { ...BASE_ITEMS.find(item => item.name === name), id: `real-${slot}`, baseName: name, rarity: 'Rare' }]));
        const player = { id: 'garment-preview', subType: actorClass, level: 10, state: 'IDLE', position: { x: 12, z: 185 },
            mesh: { userData: { authoredQuality: quality } }, equipment: gear, appearances: {}, ep: 75 };
        const sent = [], ui = new CosmeticVendorUI({ getPlayer: () => player, send: (type, payload) => sent.push({ type, payload }) });
        const source = COSMETIC_CATALOGUE.find(offer => offer.id === outfit.id);
        const offer = { ...source, appearance: { baseName: source.name, rarity: 'Common', slot: 'outfit' } };
        ui.open(); ui.handleResult({ playerID: player.id, success: true, pending: false, ep: 75, catalogue: [offer], collection: { [`${offer.name}|Common`]: offer.appearance } });
        window.__garmentPreview = { ui, player, sent, original: JSON.stringify(gear) };
        return GARMENT_MODELS.outfits[source.name].models[actorClass][quality].sha256.slice(0, 16);
    }, { quality, outfit: { id: outfit.id, name: outfit.name } });
    const dialog = page.getByRole('dialog');
    await expect.poll(() => page.evaluate(() => window.__garmentPreview.ui.preview?.model?.userData.equipmentVisualGarment)).toBe(outfit.id);
    await expect(dialog.getByRole('button', { name: 'Apply complete outfit', exact: true })).toBeEnabled();
    await dialog.locator('.character-preview-stage').scrollIntoViewIfNeeded();
    await dialog.screenshot({ path: testInfo.outputPath('selected-garment-preview.png') });
    await page.evaluate(async () => {
        const preview = window.__garmentPreview.ui.preview;
        await preview.modelReady; await preview.model.userData.equipmentReady;
    });
    const pose = dialog.getByRole('combobox', { name: 'Preview pose', exact: true });
    const moment = dialog.getByRole('slider', { name: 'Moment in pose', exact: true });
    await expect(pose).toBeEnabled(); await expect(moment).toBeEnabled();
    const choices = await pose.locator('option').evaluateAll(options => options.map(option => option.value));
    expect(choices).toEqual(expect.arrayContaining(['Idle', 'Run', 'Attack']));
    const sentBeforePoses = await page.evaluate(() => window.__garmentPreview.sent.length);
    const poseSamples = [];
    for (const state of choices) {
        await pose.selectOption(state);
        const sample = await page.evaluate(() => {
            const preview = window.__garmentPreview.ui.preview, model = preview.model;
            const clip = preview.getPoseClip(preview.previewPose), action = preview.previewMixer.existingAction(clip);
            return { state: preview.previewPose, clip: clip.name, fraction: action.time / clip.duration,
                garment: model.userData.equipmentVisualGarment, missing: model.userData.equipmentVisualMissing || [],
                fallback: model.userData.assetFallback || false,
                cameraFinite: preview.camera.projectionMatrix.elements.every(Number.isFinite) };
        });
        expect(sample.fraction).toBeCloseTo(.35, 5); expect(sample.garment).toBe(outfit.id);
        expect(sample.missing).toEqual([]); expect(sample.fallback).toBe(false); expect(sample.cameraFinite).toBe(true);
        poseSamples.push(sample);
        if (state === 'Attack') await dialog.locator('.character-preview-stage').screenshot({ path: testInfo.outputPath('attack-pose-preview.png') });
    }
    await pose.selectOption('Run'); await moment.focus(); await moment.press('End');
    await expect(moment).toHaveValue('100');
    expect(await page.evaluate(() => {
        const p = window.__garmentPreview.ui.preview, clip = p.getPoseClip('Run');
        return p.previewMixer.existingAction(clip).time / clip.duration;
    })).toBeCloseTo(1, 5);
    await moment.press('Home'); await expect(moment).toHaveValue('0');
    expect(await page.evaluate(() => window.__garmentPreview.sent.length)).toBe(sentBeforePoses);
    expect(await page.evaluate(() => JSON.stringify(window.__garmentPreview.player.equipment) === window.__garmentPreview.original && Object.keys(window.__garmentPreview.player.appearances).length === 0)).toBe(true);
    await testInfo.attach('garment-preview-poses', { body: JSON.stringify({ choices, poseSamples,
        scope: 'Existing real class/garment preview, static on-demand poses and keyboard endpoints; no live combat, full garment-motion or physical-device acceptance.' }), contentType: 'application/json' });
    await dialog.getByRole('button', { name: 'Show equipped look', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__garmentPreview.ui.preview.model.userData.equipmentVisualGarment)).toBe('');
    await dialog.getByRole('button', { name: 'Show selected cosmetic', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__garmentPreview.ui.preview.model.userData.equipmentVisualGarment)).toBe(outfit.id);
    await expect(pose).toHaveValue('Run'); await expect(moment).toHaveValue('0');
    await dialog.getByRole('button', { name: 'Rotate preview right', exact: true }).click();
    await dialog.getByRole('button', { name: 'Apply complete outfit', exact: true }).click();
    expect(await page.evaluate(() => window.__garmentPreview.sent.at(-1))).toEqual({ type: 'select_appearance', payload: { slot: 'outfit', key: `${outfit.name}|Common` } });
    expect(await page.evaluate(() => JSON.stringify(window.__garmentPreview.player.equipment) === window.__garmentPreview.original && Object.keys(window.__garmentPreview.player.appearances).length === 0)).toBe(true);
    expect(requests.some(url => url.includes(`v=${expectedVersion}`))).toBe(true);
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.evaluate(() => window.__garmentPreview.ui.dispose());
    await expect(dialog).toHaveCount(0);
    expect(failures, failures.join('\n')).toEqual([]);
});
