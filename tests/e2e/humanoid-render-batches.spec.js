import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';

for (const quality of ['high', 'low']) test(`equipped color batches preserve four-class animated appearance: ${quality}`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: 900, height: 700 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const results = await page.evaluate(async quality => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { MeshFactory } = await import('/src/utils/MeshFactory.js');
        const { BASE_ITEMS } = await import('/src/core/ItemSystem.js');
        const { applyProceduralEquipment, createProceduralEquipmentVisual, EQUIPMENT_RENDER_SLOTS } = await import('/src/art/ProceduralEquipment.js');
        const { applyActorStealthAppearance, restoreActorStealthAppearance } = await import('/src/entities/ActorStealthAppearance.js');
        document.getElementById('start-screen').style.display = 'none';
        const render = new RenderSystem(quality === 'low'); render.setGraphicsQuality(quality);
        render.renderer.domElement.dataset.equipmentColorReview = 'true';
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x4a4842, roughness: 1 }));
        floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; render.scene.add(floor);
        render.setZoom(5); render.setCameraTarget(new THREE.Vector3(0, 1.3, 0));
        render.applyLightingPreset('town', true); render.updateEnvironmentLighting(new THREE.Vector3(), 0);
        const copy = document.createElement('canvas'); copy.width = render.renderer.domElement.width; copy.height = render.renderer.domElement.height;
        const context = copy.getContext('2d', { willReadFrequently: true });
        const results = [], pictures = [];
        for (const [index, type] of ['Fighter', 'Rogue', 'Wizard', 'Cleric'].entries()) {
            const original = await MeshFactory.createMeshForType(type), batched = await MeshFactory.createMeshForType(type);
            const equipment = Object.fromEntries(EQUIPMENT_RENDER_SLOTS.map((slot, i) => {
                const candidates = BASE_ITEMS.filter(item => item.slot === slot.replace(/[12]$/, ''));
                const item = candidates[index % candidates.length];
                return [slot, { ...item, id: `appearance-${slot}`, baseName: item.name, rarity: 'Legendary', level: 75,
                    potency: 5, sockets: 3, gems: [{ type: ['Ruby', 'Sapphire', 'Emerald'][i % 3], quality: 'Flawless' }],
                    setId: 'bulwark_ages', uniqueEffect: 'guardian', statScaleVersion: 1 }];
            }));
            for (const model of [original, batched]) {
                const fit = applyProceduralEquipment(model, equipment);
                if (fit.items !== 14 || fit.missing.length) throw new Error(`Incomplete ${type} appearance fixture`);
                render.entityGroup.add(model);
            }
            // Independent unbatched constructor reference, not the new packed
            // geometry or a changed palette copied to both sides.
            const sourceGroups = [];
            original.traverse(part => { if (part.userData.equipmentVisual) sourceGroups.push(part); });
            for (const source of sourceGroups) {
                const data = source.userData, anchor = source.parent;
                const replacement = createProceduralEquipmentVisual(equipment[data.slot], { slot: data.slot,
                    side: anchor.name.includes('Left') ? 1 : -1, fitScale: data.fitScale,
                    fitLength: data.fitLength, segment: data.segment, batch: false });
                anchor.remove(source); anchor.add(replacement);
            }
            const capture = optimized => {
                original.visible = !optimized; batched.visible = optimized; render.render();
                context.drawImage(render.renderer.domElement, 0, 0);
                return { pixels: context.getImageData(0, 0, copy.width, copy.height).data,
                    calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles };
            };
            capture(false); capture(true);
            const appearances = [original, batched].map(mesh => ({ mesh }));
            for (const state of [...['Idle', 'Run', 'Attack', 'Cast', 'Death'], ...(type === 'Rogue' ? ['Stealth'] : [])]) {
                const mixers = [original, batched].map(model => {
                    const mixer = new THREE.AnimationMixer(model), clip = model.userData.animations.find(clip => clip.name === (state === 'Stealth' ? 'Idle' : state));
                    if (!clip) throw new Error(`Missing ${type} ${state} clip`);
                    mixer.clipAction(clip).play(); mixer.update(.37); return mixer;
                });
                if (state === 'Stealth') appearances.forEach(applyActorStealthAppearance);
                const before = capture(false), after = capture(true); let error = 0, changed = 0;
                if (state === 'Idle') pictures.push({ type, image: render.renderer.domElement.toDataURL('image/png') });
                for (let i = 0; i < before.pixels.length; i += 4) {
                    const delta = Math.max(...[0, 1, 2].map(c => Math.abs(before.pixels[i + c] - after.pixels[i + c])));
                    error += delta; if (delta > 8) changed++;
                }
                results.push({ type, state, beforeCalls: before.calls, afterCalls: after.calls,
                    beforeTriangles: before.triangles, afterTriangles: after.triangles,
                    meanError: error / (copy.width * copy.height), changed: changed / (copy.width * copy.height) });
                if (state === 'Stealth') appearances.forEach(restoreActorStealthAppearance);
                mixers.forEach(mixer => { mixer.stopAllAction(); mixer.uncacheRoot(mixer.getRoot()); });
                [original, batched].forEach(model => model.userData.resetPose());
            }
            [original, batched].forEach(model => { model.removeFromParent(); MeshFactory.releaseMesh(type, model); });
        }
        floor.removeFromParent(); render.disposeObjectResources(floor); render.dispose();
        return { results, pictures };
    }, quality);
    await writeFile(testInfo.outputPath('equipment-color-comparison.json'), JSON.stringify(results.results, null, 2));
    await testInfo.attach('equipment-color-comparison', { body: JSON.stringify(results.results), contentType: 'application/json' });
    for (const { type, image } of results.pictures) {
        const png = Buffer.from(image.split(',')[1], 'base64');
        await writeFile(testInfo.outputPath(`${type}-packed-equipment.png`), png);
        await testInfo.attach(`${type}-packed-equipment`, { body: png, contentType: 'image/png' });
    }
    for (const result of results.results) {
        // Transparent equipment intentionally uses its original parts to
        // preserve alpha ordering. Only opaque poses claim fewer submissions.
        if (result.state === 'Stealth') expect(result.afterCalls).toBe(result.beforeCalls);
        else expect(result.afterCalls).toBeLessThan(result.beforeCalls);
        expect(result.afterTriangles).toBe(result.beforeTriangles);
        expect(result.meanError).toBeLessThan(.1); expect(result.changed).toBeLessThan(.001);
    }
    expect(failures, failures.join('\n')).toEqual([]);
});

for (const quality of ['high', 'low']) test(`resonance plaza batches preserve repair-state rendering: ${quality}`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: 900, height: 700 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const results = await page.evaluate(async quality => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { Entity } = await import('/src/entities/Entity.js');
        const { createResonancePortalModel } = await import('/src/art/ResonancePortalModel.js');
        document.getElementById('start-screen').style.display = 'none';
        const render = new RenderSystem(quality === 'low'); render.setGraphicsQuality(quality);
        render.renderer.domElement.dataset.portalBatchReview = 'true';
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x4a4842 }));
        floor.rotation.x = -Math.PI / 2; floor.position.y = -.1; floor.receiveShadow = true; render.scene.add(floor);
        const models = [createResonancePortalModel({ batched: false }), createResonancePortalModel()];
        for (const [i, model] of models.entries()) {
            // Include Entity's production mesh setup, including shadow flags.
            new Entity('portal-' + i).setMesh(model.mesh); render.entityGroup.add(model.mesh);
        }
        render.setZoom(12); render.setCameraTarget(new THREE.Vector3(0, 2, 0));
        render.applyLightingPreset('town', true); render.updateEnvironmentLighting(new THREE.Vector3(), 0);
        const canvas = render.renderer.domElement, copy = document.createElement('canvas');
        copy.width = canvas.width; copy.height = canvas.height;
        const ctx = copy.getContext('2d', { willReadFrequently: true });
        const capture = variant => {
            models.forEach((model, i) => { model.mesh.visible = i === variant; }); render.render();
            ctx.drawImage(canvas, 0, 0);
            return { pixels: ctx.getImageData(0, 0, copy.width, copy.height).data,
                calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles };
        };
        capture(0); capture(1);
        const results = [];
        for (const restored of [[false, false, false, false], [true, false, true, false], [true, true, true, true]]) {
            const state = { restored, eligible: restored.every(Boolean), stage: 'ready', legacy: false };
            models.forEach(model => model.update(0, state, true));
            const before = capture(0), after = capture(1); let changed = 0, error = 0;
            for (let i = 0; i < before.pixels.length; i += 4) {
                let delta = 0;
                for (let c = 0; c < 3; c++) delta = Math.max(delta, Math.abs(before.pixels[i + c] - after.pixels[i + c]));
                error += delta; if (delta > 8) changed++;
            }
            results.push({ restored, saved: before.calls - after.calls, beforeTriangles: before.triangles,
                afterTriangles: after.triangles, meanError: error / (copy.width * copy.height), changed: changed / (copy.width * copy.height) });
        }
        return results;
    }, quality);
    await testInfo.attach('portal-batch-comparison', { body: JSON.stringify(results), contentType: 'application/json' });
    await writeFile(testInfo.outputPath('portal-comparison.json'), JSON.stringify(results, null, 2));
    await page.locator('canvas[data-portal-batch-review]').screenshot({ path: testInfo.outputPath('portal-batched.png') });
    for (const result of results) {
        expect(result.saved).toBeGreaterThanOrEqual(quality === 'high' ? 24 : 12);
        expect(result.afterTriangles).toBe(result.beforeTriangles);
        expect(result.meanError).toBeLessThan(.1); expect(result.changed).toBeLessThan(.001);
    }
    expect(failures).toEqual([]);
});

// A bounded renderer equivalence check, not party/network or frame-time QA.
for (const [label, types, minimumSaved] of [
    ['four-class', ['Fighter', 'Rogue', 'Wizard', 'Cleric'], 63],
    ['skeleton', ['Skeleton'], 17]
]) for (const quality of ['high', 'low']) test(`${label} rigid batches preserve rendered poses: ${quality}`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: 1100, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const results = await page.evaluate(async ({ quality, types }) => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const factories = await import('/src/art/ProceduralHumanoid.js');
        const enemies = await import('/src/art/ProceduralLegacyEnemies.js');
        const { MeshFactory } = await import('/src/utils/MeshFactory.js');
        document.getElementById('start-screen').style.display = 'none';
        const render = new RenderSystem(quality === 'low');
        render.setGraphicsQuality(quality);
        render.renderer.domElement.dataset.batchReview = 'true';
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x4a4842, roughness: 1 }));
        floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
        render.scene.add(floor);
        const original = new THREE.Group(), batched = new THREE.Group();
        render.entityGroup.add(original, batched);
        const place = (mesh, index) => mesh.position.set(index % 2 ? 3 : -3, 0, index < 2 ? -3 : 3);
        for (const [index, type] of types.entries()) {
            const make = (type === 'Skeleton' ? enemies : factories)[`createProcedural${type}`];
            const meshes = [make(), await MeshFactory.createMeshForType(type)];
            meshes.forEach((mesh, variant) => {
                place(mesh, index);
                [original, batched][variant].add(mesh);
            });
        }
        render.setZoom(11); render.setCameraTarget(new THREE.Vector3(0, 1, 0));
        render.applyLightingPreset('town', true);
        render.updateEnvironmentLighting(new THREE.Vector3(), 0);
        const copy = document.createElement('canvas'), canvas = render.renderer.domElement;
        copy.width = canvas.width; copy.height = canvas.height;
        const context = copy.getContext('2d', { willReadFrequently: true });
        const capture = optimized => {
            original.visible = !optimized; batched.visible = optimized;
            render.render();
            context.drawImage(canvas, 0, 0);
            return { pixels: context.getImageData(0, 0, copy.width, copy.height).data,
                calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles };
        };
        const results = [];
        // The first render includes reflection-environment preparation. Warm
        // both variants so the comparison measures their steady draw counts.
        capture(false); capture(true);
        for (const state of ['Idle', 'Run', 'Attack', 'Death']) {
            const mixers = [...original.children, ...batched.children].map(mesh => {
                const mixer = new THREE.AnimationMixer(mesh);
                mixer.clipAction(mesh.userData.animations.find(clip => clip.name === state)).play();
                mixer.update(.37); return mixer;
            });
            const before = capture(false), after = capture(true);
            let absoluteError = 0, changedPixels = 0;
            for (let i = 0; i < before.pixels.length; i += 4) {
                let pixelError = 0;
                for (let c = 0; c < 3; c++) pixelError = Math.max(pixelError, Math.abs(before.pixels[i + c] - after.pixels[i + c]));
                absoluteError += pixelError;
                if (pixelError > 8) changedPixels++;
            }
            results.push({ state, before: { calls: before.calls, triangles: before.triangles },
                after: { calls: after.calls, triangles: after.triangles },
                meanPixelError: absoluteError / (copy.width * copy.height),
                changedFraction: changedPixels / (copy.width * copy.height) });
            mixers.forEach(mixer => { mixer.stopAllAction(); mixer.uncacheRoot(mixer.getRoot()); });
            for (const group of [original, batched]) group.children.forEach((mesh, index) => {
                mesh.userData.resetPose(); place(mesh, index);
            });
        }
        capture(true);
        return results;
    }, { quality, types });
    await testInfo.attach('rigid-batch-render-comparison', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
    await writeFile(testInfo.outputPath('comparison.json'), JSON.stringify(results, null, 2));
    await page.locator('canvas[data-batch-review]').screenshot({ path: testInfo.outputPath(`${label}-batched.png`) });
    for (const result of results) {
        expect(result.after.calls).toBeLessThan(result.before.calls);
        expect(result.before.calls - result.after.calls).toBeGreaterThanOrEqual(minimumSaved);
        expect(result.after.triangles).toBe(result.before.triangles);
        expect(result.meanPixelError).toBeLessThan(.1);
        expect(result.changedFraction).toBeLessThan(.001);
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
