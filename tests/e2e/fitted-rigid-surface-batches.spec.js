import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';

for (const [quality, width] of [['high', 1280], ['low', 390]]) {
    test(`rigid handgear submissions preserve exact source and derivative surfaces: ${quality}`, async ({ page, baseURL }, testInfo) => {
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
                    root.userData.fittedEquipmentSurfaceBatching = true; root.userData.fittedRigidSurfaceBatching = mode === 'candidate'; root.visible = false;
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
                        let batches = 0; entry.root.traverse(mesh => { if (mesh.name.startsWith('FittedRigidBatch_')) batches++; });
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
                const derivativeChecks = [];
                for (let frame = 0; frame < 600 && render.actorGameplayGeometry.delivery.jobs.size; frame++)
                    await new Promise(resolve => requestAnimationFrame(resolve));
                const pass = render.actorGameplayGeometry.pass;
                if (render.actorGameplayGeometry.delivery.jobs.size || render.actorGameplayGeometry.delivery.stats.failed)
                    throw Error('Real geometry worker did not settle successfully');
                for (const entry of actors.filter(entry => entry.mode === 'candidate')) entry.root.traverse(mesh => {
                    if (!mesh.name.startsWith('FittedRigidBatch_')) return;
                    const installed = pass.entries.get(mesh);
                    if (installed ? !pass.valid(installed) : !pass.capture(mesh)) throw Error('Invalid merged rigid worker source');
                    const reference = actors.find(other => other.type === entry.type && other.mode === 'previous');
                    const actualGeometry = installed?.candidate || mesh.geometry;
                    let triangleIndex = 0, exactTriangleRows = true;
                    for (const name of mesh.userData.fittedBatchSources) {
                        const original = reference.root.getObjectByName(name);
                        const previous = pass.entries.get(original);
                        if (previous ? !pass.valid(previous) : !pass.capture(original)) throw Error('Invalid original rigid worker source');
                        const originalGeometry = previous?.candidate || original.geometry;
                        const surface = [...original.material.color.toArray(), original.material.roughness,
                            ...original.material.emissive.toArray().map(x => x * original.material.emissiveIntensity), original.material.metalness].map(Math.fround);
                        for (const originalIndex of originalGeometry.index.array) {
                            const actualIndex = actualGeometry.index.array[triangleIndex++];
                            if (actualIndex === undefined) { exactTriangleRows = false; continue; }
                            for (const [attributeName, attribute] of Object.entries(originalGeometry.attributes)) {
                                const packed = actualGeometry.attributes[attributeName];
                                for (let c = 0; c < attribute.itemSize; c++)
                                    if (attribute.getComponent(originalIndex, c) !== packed.getComponent(actualIndex, c)) exactTriangleRows = false;
                            }
                            for (let c = 0; c < 4; c++) {
                                if (actualGeometry.attributes.fittedDiffuseRoughness.getComponent(actualIndex, c) !== surface[c] ||
                                    actualGeometry.attributes.fittedEmissiveMetalness.getComponent(actualIndex, c) !== surface[c + 4]) exactTriangleRows = false;
                            }
                        }
                    }
                    derivativeChecks.push({ type: entry.type, mesh: mesh.name, exactTriangleRows: exactTriangleRows &&
                        triangleIndex === actualGeometry.index.count, originalTriangles: (installed?.source || mesh.geometry).index.count / 3,
                        candidateTriangles: actualGeometry.index.count / 3 });
                });
                for (const enabled of [false, true]) {
                    pass.enabled = enabled;
                    pose('CombatIdle', .3, .4);
                    for (const type of Object.keys(outfits)) reports.push(compare(type, `worker-derivatives-${enabled}`));
                }
                pass.enabled = true;
                show(null, 'candidate'); capture();
                const gl = render.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
                return { quality, reports, uniformCounts, timings, derivativeChecks, previewPNG: copy.toDataURL('image/png'),
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
        expect(result.derivativeChecks.length).toBeGreaterThan(0);
        expect(result.derivativeChecks.every(row => row.exactTriangleRows)).toBe(true);
        for (const sample of result.reports) {
            expect(sample.baselineRepeat.maximum).toBe(0); expect(sample.baselineRepeat.changed).toBe(0);
            expect(sample.candidate.maximum, JSON.stringify(sample)).toBe(0); expect(sample.candidate.changed).toBe(0);
            expect(sample.current.calls).toBeLessThanOrEqual(sample.previous.calls);
        }
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
