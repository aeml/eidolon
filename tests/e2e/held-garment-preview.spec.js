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
        const expected = await page.evaluate(async ({ model, quality }) => {
            const { CosmeticVendorUI } = await import('/src/ui/CosmeticVendorUI.js');
            const { COSMETIC_CATALOGUE } = await import('/src/data/cosmetics.generated.js');
            const { BASE_ITEMS } = await import('/src/core/ItemSystem.js');
            document.getElementById('start-screen').style.display = 'none';
            const { GARMENT_MODELS } = await import('/src/assets/garments.generated.js');
            const actorClass = model.base === 'Wooden Staff' || model.base === 'Spell Tome' ? 'Wizard'
                : model.base === 'Cleric Mace' ? 'Cleric' : model.base === 'Steel Dagger' ? 'Rogue' : 'Fighter';
            const outfits = {
                Fighter: ['Iron Helm', 'Plate Mail', 'Plate Greaves', 'Iron Boots', 'Iron Gauntlets', 'Steel Pauldrons', 'Plated Girdle', 'Iron Sword', 'Wooden Shield'],
                Rogue: ['Leather Cap', 'Leather Tunic', 'Leather Pants', 'Leather Boots', 'Leather Gloves', 'Reinforced Spaulders', 'Studded Belt', 'Steel Dagger', 'Iron Sword'],
                Wizard: ['Silk Hood', 'Robes', 'Silk Skirt', 'Sandals', 'Silk Gloves', 'Velvet Mantle', 'Silk Sash', 'Wooden Staff', 'Spell Tome'],
                Cleric: ['Iron Helm', 'Robes', 'Leather Pants', 'Iron Boots', 'Silk Gloves', 'Steel Pauldrons', 'Studded Belt', 'Cleric Mace', 'Wooden Shield']
            };
            const slots = ['head', 'chest', 'legs', 'feet', 'gloves', 'shoulders', 'belt', 'mainHand', 'offHand', 'ring1', 'ring2', 'neck', 'trinket1', 'trinket2'];
            const gear = Object.fromEntries([...outfits[actorClass], 'Ruby Ring', 'Silver Ring', 'Necklace', 'Amulet of Power', 'Orb of Mana'].map((name, i) => {
                const item = BASE_ITEMS.find(item => item.name === name); if (!item) throw Error(name);
                return [slots[i], { ...item, id: `real-${actorClass}-${slots[i]}`, baseName: name, rarity: 'Rare', potency: 5 }];
            }));
            const outfitName = { Fighter: 'Iron Oath Regalia', Rogue: 'Nightglass Cowl', Cleric: 'Dawn Reliquary', Wizard: 'Astral Sovereign' }[actorClass];
            const player = { id: 'held-preview', subType: actorClass, level: 10, state: 'IDLE', position: { x: 12, z: 185 },
                mesh: { userData: { authoredQuality: quality } }, equipment: gear,
                appearances: { outfit: { baseName: outfitName, rarity: 'Common', slot: 'outfit' } }, ep: 75 };
            const sent = [], ui = new CosmeticVendorUI({ getPlayer: () => player, send: (type, payload) => sent.push({ type, payload }) });
            const source = COSMETIC_CATALOGUE.find(offer => offer.id === model.id);
            const offer = { ...source, appearance: { baseName: source.name, rarity: 'Common', slot: model.slot } };
            ui.open(); ui.handleResult({ playerID: player.id, success: true, pending: false, ep: 75, catalogue: [offer], collection: { [`${offer.name}|Common`]: offer.appearance } });
            window.__heldPreview = { ui, player, sent, original: JSON.stringify(gear), originalAppearances: JSON.stringify(player.appearances) };
            return { actorClass, outfitID: GARMENT_MODELS.outfits[outfitName].id };
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
        await page.evaluate(async () => {
            const p = window.__heldPreview.ui.preview; await p.modelReady; await p.model.userData.equipmentReady;
        });
        const renderer = await page.evaluate(() => {
            const gl = window.__heldPreview.ui.preview.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
            return gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
        });
        if (process.env.EIDOLON_E2E_REQUIRE_NATIVE_GPU === '1') expect(renderer).not.toMatch(/swiftshader|llvmpipe|software/i);
        const pose = dialog.getByRole('combobox', { name: 'Preview pose', exact: true });
        const moment = dialog.getByRole('slider', { name: 'Moment in pose', exact: true });
        await expect(pose).toBeEnabled(); await expect(moment).toBeEnabled();
        const choices = await pose.locator('option').evaluateAll(options => options.map(option => option.value));
        expect(choices).toEqual(expect.arrayContaining(['Idle', 'Run', 'Attack', 'Block', 'Cast']));
        if (expected.actorClass === 'Rogue') expect(choices).toContain('OffhandAttack');
        const beforePoses = await page.evaluate(() => window.__heldPreview.sent.length);
        const samples = [];
        for (const focus of [model.slot, null]) {
            if (focus === null) await dialog.getByRole('button', { name: 'Show full character', exact: true }).click();
            for (const state of choices) {
                await pose.selectOption(state);
                const sample = await page.evaluate(() => {
                    const p = window.__heldPreview.ui.preview, m = p.model, clip = p.getPoseClip(p.previewPose);
                    const ids = []; m.traverse(part => { if (part.userData.garmentId) ids.push(part.userData.garmentId); });
                    return { focus: p.focusSlot, state: p.previewPose, clip: clip.name,
                        fraction: p.previewMixer.existingAction(clip).time / clip.duration,
                        class: m.userData.authoredClass, quality: m.userData.authoredQuality,
                        outfit: m.userData.equipmentVisualGarment, ids, missing: m.userData.equipmentVisualMissing || [],
                        fallback: m.userData.equipmentVisualFallback || [], modelFallback: m.userData.assetFallback || false,
                        cameraFinite: p.camera.projectionMatrix.elements.every(Number.isFinite) };
                });
                expect(sample).toMatchObject({ focus, state, class: expected.actorClass, quality,
                    outfit: expected.outfitID, ids: [model.id], missing: [], fallback: [], modelFallback: false, cameraFinite: true });
                expect(sample.fraction).toBeCloseTo(.35, 5); samples.push(sample);
                if (state === 'Attack') await dialog.locator('.character-preview-stage').screenshot({
                    path: testInfo.outputPath(focus ? 'held-attack-detail.png' : 'equipped-attack-preview.png') });
            }
        }
        await pose.selectOption('Run');
        const sliderBox = await moment.boundingBox();
        await moment.click({ position: { x: sliderBox.width / 2, y: sliderBox.height / 2 } });
        const middle = Number(await moment.inputValue());
        expect(middle).toBeGreaterThanOrEqual(45); expect(middle).toBeLessThanOrEqual(55);
        expect(await page.evaluate(() => window.__heldPreview.ui.preview.previewPoseProgress)).toBeCloseTo(middle / 100, 5);
        await moment.press('End'); await expect(moment).toHaveValue('100');
        expect(await page.evaluate(() => {
            const p = window.__heldPreview.ui.preview, c = p.getPoseClip('Run');
            return p.previewMixer.existingAction(c).time / c.duration;
        })).toBeCloseTo(1, 5);
        await moment.press('Home'); await expect(moment).toHaveValue('0');
        expect(await page.evaluate(() => window.__heldPreview.sent.length)).toBe(beforePoses);
        await dialog.getByRole('button', { name: 'Inspect held look', exact: true }).click();
        await dialog.getByRole('button', { name: 'Show equipped look', exact: true }).click();
        await expect.poll(selectedIDs).toEqual([]);
        await dialog.getByRole('button', { name: 'Show selected cosmetic', exact: true }).click();
        await expect.poll(selectedIDs).toEqual([model.id]);
        await dialog.getByRole('button', { name: 'Rotate preview right', exact: true }).click();
        await dialog.getByRole('button', { name: 'Show full character', exact: true }).click();
        const posedFullHeight = await page.evaluate(() => window.__heldPreview.ui.preview.camera.top);
        await dialog.getByRole('button', { name: 'Inspect held look', exact: true }).click();
        expect(await page.evaluate(() => window.__heldPreview.ui.preview.camera.top)).toBeLessThan(posedFullHeight);
        await dialog.getByRole('button', { name: 'Show full character', exact: true }).click();
        expect(await page.evaluate(() => window.__heldPreview.ui.preview.camera.top)).toBe(posedFullHeight);
        await expect(pose).toHaveValue('Run'); await expect(moment).toHaveValue('0');
        expect(await page.evaluate(() => window.__heldPreview.ui.preview.model.userData.equipmentVisualGarment)).toBe(expected.outfitID);
        const pinnedHeader = await dialog.evaluate(element => {
            element.scrollTop = element.scrollHeight;
            const rect = element.getBoundingClientRect(), header = element.querySelector(':scope > header').getBoundingClientRect();
            return { scroll: element.scrollTop, topGap: header.top - rect.top - Number.parseFloat(getComputedStyle(element).borderTopWidth) };
        });
        expect(pinnedHeader.scroll).toBeGreaterThan(0);
        expect(Math.abs(pinnedHeader.topGap), 'The sticky header must cover the top padding while the outfit list scrolls').toBeLessThan(.5);
        await dialog.screenshot({ path: testInfo.outputPath('held-pose-controls.png') });
        await testInfo.attach('held-preview-poses', { body: JSON.stringify({ renderer, expected, choices, samples,
            scope: 'Six held looks, correct supplied class and matching full outfit, fourteen prepared real gear entries, static focus/full-character poses, pointer slider and keyboard endpoints. No authenticated purchase, remote/live-motion, physical-device or final art acceptance.' }), contentType: 'application/json' });
        await dialog.getByRole('button', { name: 'Apply owned look', exact: true }).click();
        expect(await page.evaluate(() => window.__heldPreview.sent.at(-1))).toEqual({ type: 'select_appearance', payload: { slot: model.slot, key: `${model.name}|Common` } });
        expect(await page.evaluate(() => Object.keys(window.__heldPreview.player.equipment).length === 14 && JSON.stringify(window.__heldPreview.player.equipment) === window.__heldPreview.original && JSON.stringify(window.__heldPreview.player.appearances) === window.__heldPreview.originalAppearances)).toBe(true);
        expect(requests.some(url => url.includes(`v=${model.models[quality].sha256.slice(0, 16)}`))).toBe(true);
        expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
        await page.evaluate(() => window.__heldPreview.ui.dispose());
        await expect(dialog).toHaveCount(0);
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
