import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';

for (const quality of ['high', 'low']) test(`hidden actor batches preserve prepared class appearances: ${quality}`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: quality === 'low' ? 390 : 1280, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const result = await page.evaluate(async quality => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { MeshFactory } = await import('/src/utils/MeshFactory.js');
        const { Actor } = await import('/src/entities/Actor.js');
        const { applyActorStealthAppearance, restoreActorStealthAppearance } = await import('/src/entities/ActorStealthAppearance.js');
        const { waitForGeometryOwner } = await import('/tests/e2e/geometry-owner-observation.js');
        document.getElementById('start-screen').style.display = 'none';
        const render = new RenderSystem(quality === 'low'); render.setGraphicsQuality(quality);
        await render.preloadEnvironment(); render.waterTexture = null;
        render.setZoom(18); render.setCameraTarget(new THREE.Vector3()); render.applyLightingPreset('earth', true); render.updateShadowFocus(new THREE.Vector3());
        const outfits = {
            Fighter: ['Iron Helm', 'Plate Mail', 'Plate Greaves', 'Iron Boots', 'Iron Gauntlets', 'Steel Pauldrons', 'Plated Girdle', 'Iron Sword', 'Wooden Shield'],
            Rogue: ['Leather Cap', 'Leather Tunic', 'Leather Pants', 'Leather Boots', 'Leather Gloves', 'Reinforced Spaulders', 'Studded Belt', 'Steel Dagger', 'Iron Sword'],
            Wizard: ['Silk Hood', 'Robes', 'Silk Skirt', 'Sandals', 'Silk Gloves', 'Velvet Mantle', 'Silk Sash', 'Wooden Staff', 'Spell Tome'],
            Cleric: ['Iron Helm', 'Robes', 'Leather Pants', 'Iron Boots', 'Silk Gloves', 'Steel Pauldrons', 'Studded Belt', 'Cleric Mace', 'Wooden Shield']
        };
        const slots = ['head', 'chest', 'legs', 'feet', 'gloves', 'shoulders', 'belt', 'mainHand', 'offHand', 'neck', 'ring1', 'ring2', 'trinket1', 'trinket2'];
        const actors = [], reports = [], preparation = [];
        const canvas = render.renderer.domElement, copy = document.createElement('canvas'); copy.width = canvas.width; copy.height = canvas.height;
        const context = copy.getContext('2d', { willReadFrequently: true });
        const capture = enabled => {
            render.actorColorBatches.owner.enabled = enabled;
            if (!render.actorGameplayGeometry.pass.enabled) throw Error('Production geometry owner disabled');
            render.render(); context.drawImage(canvas, 0, 0);
            return { pixels: context.getImageData(0, 0, copy.width, copy.height).data,
                calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles,
                swaps: render.actorGameplayGeometry.pass.lastSwaps,
                batches: render.actorColorBatches.owner.lastBatches };
        };
        const delta = (a, b) => { let changed = 0, maximum = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { changed++; maximum = Math.max(maximum, Math.abs(a[i] - b[i])); } return { changed, maximum }; };
        const compare = (type, label, batched = true) => {
            for (const entry of actors) entry.root.visible = entry.type === type;
            capture(false); const before = capture(false), repeat = capture(false);
            capture(true); const after = capture(true);
            reports.push({ type, label, expectedBatches: batched, baselineRepeat: delta(before.pixels, repeat.pixels), candidate: delta(before.pixels, after.pixels),
                previous: { calls: before.calls, triangles: before.triangles, swaps: before.swaps },
                current: { calls: after.calls, triangles: after.triangles, swaps: after.swaps, batches: after.batches } });
        };
        try {
            for (const type of Object.keys(outfits)) {
                const root = await MeshFactory.createMeshForType(type, { quality }); root.visible = false;
                const actor = new Actor(`prepared-hidden-${type}`, {}); actor.meshType = type; actor.setMesh(root);
                render.entityGroup.add(root); actors.push({ type, actor, root });
            }
            for (const rarity of ['Rare', 'Legendary']) {
                for (const entry of actors) {
                    entry.root.visible = false;
                    const gear = Object.fromEntries([...outfits[entry.type], 'Necklace', 'Ruby Ring', 'Silver Ring', 'Amulet of Power', 'Orb of Mana'].map((name, index) => [slots[index], {
                        id: `${entry.type}-${rarity}-${slots[index]}`, name, baseName: name, rarity, potency: 5,
                        slot: slots[index] === 'offHand' && entry.type === 'Rogue' ? 'mainHand' : slots[index],
                        type: ['Iron Sword', 'Steel Dagger', 'Wooden Staff', 'Cleric Mace'].includes(name) ? 'WEAPON' : 'ARMOR'
                    }]));
                    entry.actor.syncEquipmentVisuals(gear); await entry.root.userData.equipmentReady;
                    if (entry.root.userData.equipmentVisualItemCount !== 14 || entry.root.userData.equipmentVisualMissing?.length || entry.root.userData.equipmentVisualFallback?.length) throw Error('Incomplete supplied outfit');
                }
                render.actorColorBatches.owner.enabled = true; render.render();
                const ready = await waitForGeometryOwner(render);
                if (!ready.valid || !ready.restored || ready.entries < 4) throw Error('Prepared production outfits missing');
                preparation.push({ rarity, ...ready });
                for (const [state, time, yaw] of [['CombatIdle', .3, 0], ['Run', .3, .7], ['Attack', 14 / 30, 0], ['Attack', 14 / 30, Math.PI], ['Cast', .4, Math.PI / 2], ['Channel', .5, .4], ['Block', .3, Math.PI], ['CombatIdle', .3, Math.PI]]) {
                    for (const entry of actors) {
                        entry.actor.mixer.stopAllAction(); entry.root.userData.resetRestPose(); entry.root.rotation.y = yaw; entry.actor.currentAction = null;
                        entry.actor.playAnimation(state, !['Attack', 'Cast', 'Heal', 'Death'].includes(state), true); entry.actor.updateAnimationMixer(time); entry.root.updateMatrixWorld(true);
                    }
                    for (const type of Object.keys(outfits)) compare(type, `${rarity}-${state}-${yaw}`);
                }
            }
            const rogue = actors.find(entry => entry.type === 'Rogue');
            rogue.root.visible = false; applyActorStealthAppearance(rogue.actor); render.render();
            compare('Rogue', 'initial-stealth', false);
            restoreActorStealthAppearance(rogue.actor); await waitForGeometryOwner(render);
            compare('Rogue', 'opaque-restoration');
            const gl = render.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
            return { quality, preparation, reports, ordinaryShadows: render.renderer.shadowMap.enabled,
                renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
                scope: 'Actual default fitted/prepared outfits on one actor per class; color submission batching alone toggles. Hidden first/equipment generations and Rogue stealth restoration, source/candidate/repeat exactRGBA, native HighLow. No independent simplification arms or whole-game frame budget claim.' };
        } finally { for (const entry of actors) { entry.actor.dispose(); entry.root.removeFromParent(); } render.dispose(); }
    }, quality);
    await writeFile(testInfo.outputPath('prepared-hidden-color.json'), JSON.stringify(result, null, 2));
    expect(result.renderer).not.toMatch(/SwiftShader|llvmpipe/i);
    expect(result.preparation).toHaveLength(2); expect(result.reports).toHaveLength(66);
    if (quality === 'high') expect(result.ordinaryShadows).toBe(true);
    for (const row of result.reports) {
        expect(row.baselineRepeat).toEqual({ changed: 0, maximum: 0 });
        expect(row.candidate, JSON.stringify(row)).toEqual({ changed: 0, maximum: 0 });
        expect(row.current.triangles).toBe(row.previous.triangles);
        expect(row.current.swaps).toBe(row.previous.swaps);
        if (row.label !== 'initial-stealth') expect(row.previous.swaps).toBeGreaterThan(0);
        expect(row.current.calls).toBeLessThanOrEqual(row.previous.calls);
        if (row.expectedBatches) expect(row.current.batches).toBeGreaterThan(0);
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
