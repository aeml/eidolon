import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';

for (const [quality, width] of [['high', 1280], ['low', 390]]) {
    test(`fitted surface submissions preserve supplied class gear in motion: ${quality}`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height: 844 });
        await page.goto('/', { waitUntil: 'networkidle' });
        const result = await page.evaluate(async quality => {
            const THREE = await import('three');
            const { RenderSystem } = await import('/src/core/RenderSystem.js');
            const { MeshFactory } = await import('/src/utils/MeshFactory.js');
            const { Actor } = await import('/src/entities/Actor.js');
            const { applyActorStealthAppearance, restoreActorStealthAppearance } = await import('/src/entities/ActorStealthAppearance.js');
            const { renderFrameInterval } = await import('/tests/e2e/renderFrameInterval.js');
            document.getElementById('start-screen').style.display = 'none';
            const render = new RenderSystem(quality === 'low'); render.setGraphicsQuality(quality);
            await render.preloadEnvironment(); render.waterTexture = null;
            render.setZoom(18); render.setCameraTarget(new THREE.Vector3()); render.applyLightingPreset('earth', true);
            render.updateShadowFocus(new THREE.Vector3());
            const outfits = {
                Fighter: ['Iron Helm', 'Plate Mail', 'Plate Greaves', 'Iron Boots', 'Iron Gauntlets', 'Steel Pauldrons', 'Plated Girdle', 'Iron Sword', 'Wooden Shield'],
                Rogue: ['Leather Cap', 'Leather Tunic', 'Leather Pants', 'Leather Boots', 'Leather Gloves', 'Reinforced Spaulders', 'Studded Belt', 'Steel Dagger', 'Iron Sword'],
                Wizard: ['Silk Hood', 'Robes', 'Silk Skirt', 'Sandals', 'Silk Gloves', 'Velvet Mantle', 'Silk Sash', 'Wooden Staff', 'Spell Tome'],
                Cleric: ['Iron Helm', 'Robes', 'Leather Pants', 'Iron Boots', 'Silk Gloves', 'Steel Pauldrons', 'Studded Belt', 'Cleric Mace', 'Wooden Shield']
            };
            const slots = ['head', 'chest', 'legs', 'feet', 'gloves', 'shoulders', 'belt', 'mainHand', 'offHand', 'neck', 'ring1', 'ring2', 'trinket1', 'trinket2'];
            const actors = [], reports = [], timings = [];
            const copy = document.createElement('canvas'); copy.width = render.renderer.domElement.width; copy.height = render.renderer.domElement.height;
            const context = copy.getContext('2d', { willReadFrequently: true });
            const capture = () => {
                render.render(); context.drawImage(render.renderer.domElement, 0, 0);
                return { pixels: context.getImageData(0, 0, copy.width, copy.height).data,
                    calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles };
            };
            const delta = (a, b) => {
                let changed = 0, maximum = 0;
                for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { changed++; maximum = Math.max(maximum, Math.abs(a[i] - b[i])); }
                return { changed, maximum };
            };
            const show = (type, mode) => { for (const entry of actors) entry.root.visible = entry.mode === mode && (!type || entry.type === type); };
            const pose = (state, time, yaw) => {
                for (const entry of actors) {
                    entry.actor.mixer.stopAllAction(); entry.root.userData.resetRestPose(); entry.root.rotation.y = yaw;
                    entry.actor.currentAction = null; entry.actor.playAnimation(state, !['Attack', 'Cast', 'Heal', 'Death'].includes(state), true);
                    entry.actor.updateAnimationMixer(time); entry.root.updateMatrixWorld(true);
                }
            };
            const compare = (type, label) => {
                show(type, 'previous'); capture(); const before = capture(), repeat = capture();
                show(type, 'candidate'); capture(); const after = capture();
                return { type, label, baselineRepeat: delta(before.pixels, repeat.pixels), candidate: delta(before.pixels, after.pixels),
                    previous: { calls: before.calls, triangles: before.triangles }, current: { calls: after.calls, triangles: after.triangles } };
            };
            try {
                for (const type of Object.keys(outfits)) for (const mode of ['previous', 'candidate']) {
                    const root = await MeshFactory.createMeshForType(type, { quality });
                    if (root.userData.authoredClass !== type) throw new Error('Supplied class model failed');
                    root.userData.fittedEquipmentSurfaceBatching = mode === 'candidate'; root.visible = false;
                    const actor = new Actor(`surface-${type}-${mode}`, {}); actor.meshType = type; actor.setMesh(root);
                    render.entityGroup.add(root); actors.push({ type, mode, root, actor });
                }
                const uniformCounts = [];
                for (const rarity of ['Rare', 'Legendary']) {
                    for (const entry of actors) {
                        const names = [...outfits[entry.type], 'Necklace', 'Ruby Ring', 'Silver Ring', 'Amulet of Power', 'Orb of Mana'];
                        entry.gear = Object.fromEntries(names.map((name, i) => [slots[i], { id: `${entry.type}-${rarity}-${slots[i]}`, name, baseName: name,
                            slot: slots[i] === 'offHand' && entry.type === 'Rogue' ? 'mainHand' : slots[i],
                            type: ['Iron Sword', 'Steel Dagger', 'Wooden Staff', 'Cleric Mace'].includes(name) ? 'WEAPON' : 'ARMOR', rarity, potency: 5 }]));
                        entry.actor.syncEquipmentVisuals(entry.gear); await entry.root.userData.equipmentReady;
                        if (entry.root.userData.equipmentVisualItemCount !== 14 || entry.root.userData.equipmentVisualMissing?.length || entry.root.userData.equipmentVisualFallback?.length)
                            throw new Error('Fitted outfit was incomplete or used source fallback');
                        let batches = 0; entry.root.traverse(mesh => { if (mesh.material?.userData.fittedSurfaceAttributes) batches++; });
                        uniformCounts.push({ type: entry.type, mode: entry.mode, rarity, batches, items: entry.root.userData.equipmentVisualItemCount });
                    }
                    for (const [state, time, yaw] of [['CombatIdle', .3, 0], ['Run', .3, .7], ['Attack', 14 / 30, 0], ['Attack', 14 / 30, Math.PI],
                        ['Cast', .4, Math.PI / 2], ['Channel', .5, .4], ['Block', .3, Math.PI], ['CombatIdle', .3, Math.PI]]) {
                        pose(state, time, yaw);
                        for (const type of Object.keys(outfits)) reports.push(compare(type, `${rarity}-${state}-${yaw}`));
                    }
                }
                for (const entry of actors.filter(entry => entry.type === 'Rogue')) applyActorStealthAppearance(entry.actor);
                pose('CombatIdle', .3, 0); reports.push(compare('Rogue', 'transparent-stealth'));
                for (const entry of actors.filter(entry => entry.type === 'Rogue')) restoreActorStealthAppearance(entry.actor);
                reports.push(compare('Rogue', 'opaque-restoration'));
                // Mixed layers reload normally and preserve the exact native
                // coverage/fit; each candidate still retains original pieces.
                for (const entry of actors) {
                    const gear = { ...entry.gear };
                    if (entry.type === 'Fighter' || entry.type === 'Rogue') gear.chest = { ...gear.chest, id: 'mixed-robe', name: 'Robes', baseName: 'Robes' };
                    if (entry.type === 'Wizard') { delete gear.chest; delete gear.belt; }
                    if (entry.type === 'Cleric') gear.legs = { ...gear.legs, id: 'mixed-greaves', name: 'Plate Greaves', baseName: 'Plate Greaves' };
                    entry.actor.syncEquipmentVisuals(gear); await entry.root.userData.equipmentReady;
                    if (entry.root.userData.equipmentVisualMissing?.length) throw new Error('Mixed fit failed');
                }
                pose('Run', .3, Math.PI); for (const type of Object.keys(outfits)) reports.push(compare(type, 'mixed-back-run'));
                const elapsedNow = performance.now.bind(performance);
                for (const [i, type] of Object.keys(outfits).entries()) for (const entry of actors.filter(entry => entry.type === type)) entry.root.position.x = (i - 1.5) * 4;
                pose('CombatIdle', .3, 0);
                for (const mode of ['previous', 'candidate', 'candidate', 'previous']) {
                    show(null, mode);
                    for (let i = 0; i < 30; i++) { await new Promise(resolve => requestAnimationFrame(resolve)); render.render(); }
                    const frames = [], cpu = []; let previous;
                    for (let i = 0; i < 120; i++) {
                        const timestamp = await new Promise(resolve => requestAnimationFrame(resolve));
                        if (previous !== undefined) frames.push(renderFrameInterval(timestamp, previous)); previous = timestamp;
                        const start = elapsedNow(); render.render(); cpu.push(elapsedNow() - start);
                    }
                    const p = (values, fraction) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * fraction)];
                    timings.push({ mode, frames: cpu.length, frameMedianMs: p(frames, .5), frameP95Ms: p(frames, .95), cpuMedianMs: p(cpu, .5), cpuP95Ms: p(cpu, .95),
                        calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles });
                }
                show(null, 'candidate'); capture();
                const gl = render.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
                return { quality, reports, uniformCounts, timings, previewPNG: copy.toDataURL('image/png'),
                    renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
                    scope: 'Supplied four-class rigs/fitted fourteen-slot outfits under production lighting/composer; fixed sampled poses, no connected party/busy fight/device certificate.' };
            } finally { for (const entry of actors) { entry.actor.dispose(); entry.root.removeFromParent(); } render.dispose(); }
        }, quality);
        await writeFile(testInfo.outputPath('candidate.png'), Buffer.from(result.previewPNG.split(',')[1], 'base64')); delete result.previewPNG;
        const artifact = testInfo.outputPath('comparison.json'); await writeFile(artifact, JSON.stringify(result, null, 2));
        await testInfo.attach('fitted-surface-comparison', { path: artifact, contentType: 'application/json' });
        console.log('[fitted-surface-timings]', JSON.stringify({ quality, timings: result.timings }));
        expect(result.renderer).not.toMatch(/SwiftShader|llvmpipe/i);
        for (const entry of result.uniformCounts) {
            if (entry.mode === 'candidate') expect(entry.batches).toBeGreaterThan(0);
            else expect(entry.batches).toBe(0);
        }
        for (const sample of result.reports) {
            expect(sample.baselineRepeat.maximum).toBe(0); expect(sample.baselineRepeat.changed).toBe(0);
            expect(sample.candidate.maximum, JSON.stringify(sample)).toBe(0); expect(sample.candidate.changed).toBe(0);
            expect(sample.current.calls).toBeLessThanOrEqual(sample.previous.calls);
        }
        expect(failures, failures.join('\n')).toEqual([]);
    });
}

test('default fitted surface equip and normal pool release retain bounded GPU resources', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: 1280, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const result = await page.evaluate(async () => {
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { MeshFactory } = await import('/src/utils/MeshFactory.js');
        const { Actor } = await import('/src/entities/Actor.js');
        const { waitForGeometryOwner } = await import('/tests/e2e/geometry-owner-observation.js');
        document.getElementById('start-screen').style.display = 'none';
        const render = new RenderSystem(false); render.setGraphicsQuality('high'); await render.preloadEnvironment(); render.waterTexture = null;
        const slots = ['head', 'chest', 'legs', 'feet', 'gloves', 'shoulders', 'belt', 'mainHand', 'offHand', 'neck', 'ring1', 'ring2', 'trinket1', 'trinket2'];
        const outfits = {
            Fighter: ['Iron Helm', 'Plate Mail', 'Plate Greaves', 'Iron Boots', 'Iron Gauntlets', 'Steel Pauldrons', 'Plated Girdle', 'Iron Sword', 'Wooden Shield'],
            Rogue: ['Leather Cap', 'Leather Tunic', 'Leather Pants', 'Leather Boots', 'Leather Gloves', 'Reinforced Spaulders', 'Studded Belt', 'Steel Dagger', 'Iron Sword'],
            Wizard: ['Silk Hood', 'Robes', 'Silk Skirt', 'Sandals', 'Silk Gloves', 'Velvet Mantle', 'Silk Sash', 'Wooden Staff', 'Spell Tome'],
            Cleric: ['Iron Helm', 'Robes', 'Leather Pants', 'Iron Boots', 'Silk Gloves', 'Steel Pauldrons', 'Studded Belt', 'Cleric Mace', 'Wooden Shield']
        };
        const memory = () => ({ ...render.renderer.info.memory });
        const deliveryState = () => {
            const delivery = render.actorGameplayGeometry.delivery;
            return { roots: delivery.roots.size, jobs: delivery.jobs.size, queue: delivery.queue.length,
                active: Boolean(delivery.active), scheduled: delivery.scheduled !== null, dispatched: delivery.dispatched };
        };
        const cycle = async (quality, warmOriginals = false) => {
            const actors = [];
            try {
                for (const [i, type] of Object.keys(outfits).entries()) {
                    const root = await MeshFactory.createMeshForType(type, { quality });
                    const actor = new Actor(`surface-lifetime-${type}`, {}); actor.meshType = type; actor.setMesh(root);
                    root.position.x = (i - 1.5) * 4; root.visible = false;
                    render.entityGroup.add(root); actors.push(actor);
                    const gear = Object.fromEntries([...outfits[type], 'Necklace', 'Ruby Ring', 'Silver Ring', 'Amulet of Power', 'Orb of Mana'].map((name, index) => [slots[index], {
                        id: `${type}-${slots[index]}`, name, baseName: name, rarity: 'Rare',
                        slot: slots[index] === 'offHand' && type === 'Rogue' ? 'mainHand' : slots[index],
                        type: ['Iron Sword', 'Steel Dagger', 'Wooden Staff', 'Cleric Mace'].includes(name) ? 'WEAPON' : 'ARMOR'
                    }]));
                    actor.syncEquipmentVisuals(gear); await root.userData.equipmentReady;
                    if (root.userData.equipmentVisualItemCount !== 14) throw new Error('Default pooled outfit incomplete');
                    let batches = 0; root.traverse(mesh => { if (mesh.material?.userData.fittedSurfaceAttributes) batches++; });
                    if (!batches) throw new Error('Default production surface batching omitted');
                }
                // Loading/equipping under a hidden actor must defer discovery,
                // then restore the same three paired Fighter eye surfaces.
                render.render();
                actors.forEach(actor => { actor.mesh.visible = true; });
                if (warmOriginals) {
                    // The normal model pool retains original eye geometry as
                    // well as using color batches/prepared indices. Warm both
                    // supported routes before measuring owned-generation leaks.
                    const geometry = render.actorGameplayGeometry.pass, color = render.actorColorBatches.owner;
                    const geometryEnabled = geometry.enabled, colorEnabled = color.enabled;
                    geometry.enabled = color.enabled = false;
                    try { render.render(); }
                    finally { geometry.enabled = geometryEnabled; color.enabled = colorEnabled; }
                }
                for (let i = 0; i < 3; i++) render.render();
                const fighter = actors.find(actor => actor.meshType === 'Fighter');
                const fighterEyeBatches = [...render.actorColorBatches.owner.entries.values()].filter(entry => entry.root === fighter.mesh &&
                    entry.meshes.every(mesh => /^Fighter_(?:Eye|Pupil|Iris)_[lr]$/.test(mesh.name))).length;
                await waitForGeometryOwner(render); render.render();
                const allocated = memory(); actors.forEach(actor => actor.dispose()); actors.length = 0;
                await waitForGeometryOwner(render);
                for (let i = 0; i < 2; i++) render.render();
                return { quality, warmOriginals, fighterEyeBatches, allocated, released: memory(), attachedActors: render.entityGroup.children.length, delivery: deliveryState() };
            } finally { actors.forEach(actor => actor.dispose()); }
        };
        try {
            // Asset/body rigs and their normal pools deliberately stay cached.
            // Warm both qualities first; each equip generation must release
            // its own union rigs/materials/buffers to that same retained state.
            const warmup = [await cycle('high', true), await cycle('low', true)];
            const baseline = memory(), cycles = [];
            for (const quality of ['high', 'low', 'high', 'low']) cycles.push(await cycle(quality));
            const cancellations = [];
            for (const type of Object.keys(outfits)) {
                // Equip a real detached asset first, then cancel its newly
                // queued preparation synchronously before the pump can run.
                const actor = new Actor(`cancel-queued-${type}`, {}), root = await MeshFactory.createMeshForType(type, { quality: 'high' });
                actor.meshType = type; actor.setMesh(root);
                try {
                    actor.syncEquipmentVisuals(Object.fromEntries([...outfits[type], 'Necklace', 'Ruby Ring', 'Silver Ring', 'Amulet of Power', 'Orb of Mana'].map((name, index) => [slots[index], {
                        id: `cancel-${type}-${slots[index]}`, name, baseName: name, rarity: 'Rare',
                        slot: slots[index] === 'offHand' && type === 'Rogue' ? 'mainHand' : slots[index],
                        type: ['Iron Sword', 'Steel Dagger', 'Wooden Staff', 'Cleric Mace'].includes(name) ? 'WEAPON' : 'ARMOR'
                    }])));
                    await root.userData.equipmentReady;
                    if (root.userData.equipmentVisualItemCount !== 14) throw new Error('Cancellation outfit incomplete');
                    render.entityGroup.add(root); const queued = deliveryState();
                    actor.dispose(); const released = deliveryState();
                    cancellations.push({ type, queued, released });
                    await waitForGeometryOwner(render);
                } finally { actor.dispose(); }
            }
            render.render(); const afterCancellation = memory();
            const gl = render.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
            return { warmup, baseline, cycles, cancellations, afterCancellation,
                renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
                scope: 'Four complete outfits per cycle; original/prepared pools warmed at both qualities, actual worker settled before allocation/release counts. Four measured cycles plus four real detached-equipment add/dispose cancellations; no queued pump or worker dispatch after cancellation. High renderer/composer stays fixed while body/equipment detail changes. No frame-time/campaign/device claim.' };
        } finally { render.dispose(); }
    });
    const artifact = testInfo.outputPath('lifetime.json'); await writeFile(artifact, JSON.stringify(result, null, 2));
    await testInfo.attach('fitted-surface-gpu-lifetime', { path: artifact, contentType: 'application/json' });
    for (const cycle of result.cycles) {
        expect(cycle.fighterEyeBatches).toBe(3);
        expect(cycle.delivery).toMatchObject({ roots: 0, jobs: 0, queue: 0, active: false, scheduled: false });
        expect(cycle.attachedActors).toBe(0); expect(cycle.released).toEqual(result.baseline);
        expect(cycle.allocated.textures).toBeGreaterThan(cycle.released.textures);
        expect(cycle.allocated.geometries).toBeGreaterThan(cycle.released.geometries);
    }
    expect(result.cancellations).toHaveLength(4);
    for (const row of result.cancellations) {
        expect(row.queued.jobs).toBeGreaterThan(0); expect(row.queued.queue).toBeGreaterThan(0);
        expect(row.queued).toMatchObject({ roots: 1, active: false, scheduled: true });
        expect(row.released).toEqual({ roots: 0, jobs: 0, queue: 0, active: false, scheduled: false, dispatched: row.queued.dispatched });
    }
    expect(result.afterCancellation).toEqual(result.baseline);
    if (process.env.EIDOLON_E2E_REQUIRE_NATIVE_GPU === '1') expect(result.renderer).not.toMatch(/SwiftShader|llvmpipe|software/i);
    expect(failures, failures.join('\n')).toEqual([]);
});
