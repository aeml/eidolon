import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';
import { requiresHardwareWebGL } from './browserLaunchPolicy.js';

test.use({ video: 'on' }); // Anonymous prepared art review; retain actual HUD/motion.

for (const [quality, width] of [['high', 1280], ['low', 390]]) {
    test(`${quality}: matted Earth thatch beside moving full outfits and the actual HUD`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.route('**/src/art/EarthGroundCompositionReference.js', route => route.fulfill({
            body: readFileSync(new URL('../fixtures/earth-composition-before-thatch.js', import.meta.url), 'utf8')
                .replace("'./EarthSurfaceDetail.js'", "'./EarthSurfaceDetailReference.js'"),
            contentType: 'text/javascript'
        }));
        await page.route('**/src/art/EarthSurfaceDetailReference.js', route => route.fulfill({
            body: readFileSync(new URL('../fixtures/earth-surface-before-thatch.js', import.meta.url), 'utf8'),
            contentType: 'text/javascript'
        }));
        await page.setViewportSize({ width, height: 844 });
        await page.addInitScript(quality => localStorage.setItem('eidolon.graphicsQuality', quality), quality);
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async ({ quality, phone }) => {
            const THREE = await import('three');
            const { GameEngine } = await import('/src/core/GameEngine.js');
            const { BASE_ITEMS } = await import('/src/core/ItemSystem.js');
            const { applyEarthGroundComposition: reference } = await import('/src/art/EarthGroundCompositionReference.js');
            document.getElementById('start-screen').style.display = 'none';
            const game = new GameEngine('Fighter', phone, true, '', 'thatch-review-only', null, 'flat-v1');
            const render = game.renderSystem;
            render.setGraphicsQuality(quality); game.worldGenerator.graphicsQuality = quality;
            await render.preloadEnvironment();
            await game.worldGenerator.loadTrees(0, 200); await game.worldGenerator.loadBuildings(0, 200);
            game.uiManager.showHUD();
            const outfits = {
                Fighter: ['Iron Helm', 'Plate Mail', 'Plate Greaves', 'Iron Boots', 'Iron Gauntlets', 'Steel Pauldrons', 'Plated Girdle', 'Iron Sword', 'Wooden Shield'],
                Rogue: ['Leather Cap', 'Leather Tunic', 'Leather Pants', 'Leather Boots', 'Leather Gloves', 'Reinforced Spaulders', 'Studded Belt', 'Steel Dagger', 'Iron Sword'],
                Cleric: ['Iron Helm', 'Robes', 'Leather Pants', 'Iron Boots', 'Silk Gloves', 'Steel Pauldrons', 'Studded Belt', 'Cleric Mace', 'Wooden Shield'],
                Wizard: ['Silk Hood', 'Robes', 'Silk Skirt', 'Sandals', 'Silk Gloves', 'Velvet Mantle', 'Silk Sash', 'Wooden Staff', 'Spell Tome']
            };
            const slots = ['head', 'chest', 'legs', 'feet', 'gloves', 'shoulders', 'belt', 'mainHand', 'offHand', 'ring1', 'ring2', 'neck', 'trinket1', 'trinket2'];
            const actors = [];
            for (const type of Object.keys(outfits)) {
                const actor = game.createRemotePlayer('Player', `thatch-${type}`, type); actor.gameEngine = game;
                await actor.ensureMesh();
                actor.syncEquipmentVisuals(Object.fromEntries([...outfits[type], 'Ruby Ring', 'Silver Ring', 'Necklace', 'Amulet of Power', 'Orb of Mana'].map((name, index) => {
                    const slot = slots[index], base = BASE_ITEMS.find(item => item.name === name);
                    return [slot, { ...base, name, baseName: name, id: `thatch-${type}-${slot}`,
                        slot: index === 8 && type === 'Rogue' ? 'mainHand' : slot, rarity: 'Rare', stats: {}, gems: [], sockets: 0 }];
                })));
                await actor.mesh.userData.equipmentReady; render.add(actor.mesh);
                actor.playAnimation('Run', true, true); actors.push(actor);
            }
            let candidate; const grounds = [];
            render.groundEarth.traverse(node => {
                if (!node.material?.userData.earthGroundComposition) return;
                if (candidate && candidate !== node.material) throw new Error('Earth material identity differs between sectors');
                candidate = node.material; grounds.push(node);
            });
            if (!candidate || !grounds.length) throw new Error('Actual Earth ground material missing');
            const baseline = candidate.clone(); baseline.userData = {};
            reference(baseline, quality);
            const clock = Object.getOwnPropertyDescriptor(performance, 'now');
            Object.defineProperty(performance, 'now', { configurable: true, value: () => 12000 });
            const canvas = render.renderer.domElement, copy = document.createElement('canvas');
            copy.width = canvas.width; copy.height = canvas.height;
            window.__thatchReview = { game, render, actors, THREE, grounds, baseline, candidate, clock,
                copy, context: copy.getContext('2d', { willReadFrequently: true }), reports: [], mode: null };
        }, { quality, phone: width < 800 });
        try {
            for (const [label, x, z, zoom] of [['gate-meadow', 140, 190, 18], ['road-verge', 353, 216, 18],
                ['sheltered-grove', -83, -334, 18], ['thatch-detail', 353, 216, 10]]) {
                await page.evaluate(async ({ label, x, z, zoom }) => {
                    const r = window.__thatchReview, focus = new r.THREE.Vector3(x, 0, z);
                    r.render.setZoom(zoom); r.render.setCameraTarget(focus);
                    r.render.applyLightingPreset('earth', true); r.render.updateEnvironmentLighting(focus, 0);
                    for (let frame = 0; frame < 24; frame++) {
                        await new Promise(resolve => requestAnimationFrame(() => {
                            r.actors.forEach((actor, index) => {
                                actor.position.set(x + (index - 1.5) * 3 + frame / 23, 0, z + 2);
                                actor.mesh.position.copy(actor.position); actor.updateAnimationMixer(1 / 60);
                            });
                            r.render.render(); resolve();
                        }));
                    }
                    r.currentView = label;
                }, { label, x, z, zoom });
                const row = await page.evaluate(() => {
                    const r = window.__thatchReview;
                    r.select = mode => {
                        if (r.mode !== mode) {
                            r.grounds.forEach(node => { node.material = r[mode]; }); r.mode = mode;
                        }
                    };
                    const capture = mode => {
                        r.select(mode); r.render.render(); r.render.render();
                        r.context.drawImage(r.render.renderer.domElement, 0, 0);
                        return { pixels: r.context.getImageData(0, 0, r.copy.width, r.copy.height).data,
                            calls: r.render.renderer.info.render.calls, triangles: r.render.renderer.info.render.triangles,
                            memory: { ...r.render.renderer.info.memory } };
                    };
                    capture('candidate'); capture('baseline');
                    const before = capture('baseline'), repeat = capture('baseline'), after = capture('candidate');
                    let changed = 0, unstable = 0, maxDelta = 0;
                    for (let i = 0; i < before.pixels.length; i++) {
                        changed += before.pixels[i] !== after.pixels[i] ? 1 : 0;
                        unstable += before.pixels[i] !== repeat.pixels[i] ? 1 : 0;
                        maxDelta = Math.max(maxDelta, Math.abs(before.pixels[i] - after.pixels[i]));
                    }
                    const gl = r.render.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
                    return { label: r.currentView, changed, unstable, maxDelta,
                        before: { calls: before.calls, triangles: before.triangles, memory: before.memory },
                        after: { calls: after.calls, triangles: after.triangles, memory: after.memory },
                        outfits: r.actors.map(actor => ({ type: actor.mesh.userData.authoredClass,
                            items: actor.mesh.userData.equipmentVisualItemCount, fallback: actor.mesh.userData.equipmentVisualFallback })),
                        phone: r.game.isMobile,
                        gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
                });
                await testInfo.attach(`${label}-comparison`, { body: JSON.stringify(row, null, 2), contentType: 'application/json' });
                expect(row.unstable).toBe(0); expect(row.changed).toBeGreaterThan(0);
                expect(row.before).toEqual(row.after); expect(row.phone).toBe(width < 800);
                expect(row.outfits.map(actor => actor.type)).toEqual(['Fighter', 'Rogue', 'Cleric', 'Wizard']);
                for (const outfit of row.outfits) { expect(outfit.items).toBe(14); expect(outfit.fallback).toEqual([]); }
                if (requiresHardwareWebGL()) expect(row.gpu).not.toMatch(/swiftshader|llvmpipe|software/i);
                for (const mode of ['baseline', 'candidate']) {
                    await page.evaluate(mode => { const r = window.__thatchReview; r.select(mode); r.render.render(); }, mode);
                    await page.screenshot({ path: testInfo.outputPath(`${label}-${mode}.png`) });
                }
            }
            // Compare the material under the same settled full-outfit scene.
            // RAF timestamps stay real while wind/poses remain frozen; this
            // observes render cost, not connected simulation/combat performance.
            await page.evaluate(() => {
                const r = window.__thatchReview;
                r.render.setZoom(18); r.render.setCameraTarget(new r.THREE.Vector3(-83, 0, -334));
                if (r.render.renderer.shadowMap.enabled) r.render.updateShadowFocus(r.render.cameraTarget);
                r.actors.forEach((actor, index) => {
                    actor.position.set(-83 + (index - 1.5) * 3, 0, -332);
                    actor.mesh.position.copy(actor.position);
                });
            });
            const timings = await page.evaluate(async () => {
                const { renderFrameInterval } = await import('/tests/e2e/renderFrameInterval.js');
                const r = window.__thatchReview, rows = [];
                for (const mode of ['baseline', 'candidate', 'candidate', 'baseline']) {
                    r.select(mode); const frames = []; let previous;
                    for (let frame = 0; frame < 151; frame++) {
                        await new Promise(resolve => requestAnimationFrame(now => {
                            if (frame > 30) frames.push(renderFrameInterval(now, previous));
                            previous = now; r.render.render(); resolve();
                        }));
                    }
                    const sorted = [...frames].sort((a, b) => a - b);
                    rows.push({ mode, frames: frames.length, intervals: frames,
                        median: sorted[Math.floor(sorted.length / 2)], p95: sorted[Math.floor(sorted.length * .95)],
                        calls: r.render.renderer.info.render.calls, triangles: r.render.renderer.info.render.triangles,
                        shadowEnabled: r.render.renderer.shadowMap.enabled,
                        shadowTargetError: r.render.renderer.shadowMap.enabled ?
                            r.render.shadowTarget.distanceTo(r.render.cameraTarget) : null });
                }
                return rows;
            });
            await testInfo.attach('settled-material-ABBA', { body: JSON.stringify(timings, null, 2), contentType: 'application/json' });
            for (const row of timings) {
                expect(row.frames).toBe(120);
                if (quality === 'high') {
                    expect(row.shadowEnabled).toBe(true);
                    expect(row.shadowTargetError).toBeLessThan(1);
                }
                expect.soft(row.calls, `${row.mode} draw calls`).toBeLessThanOrEqual(quality === 'high' ? 350 : 200);
                expect.soft(row.triangles, `${row.mode} triangles`).toBeLessThanOrEqual(quality === 'high' ? 250000 : 85000);
                expect.soft(row.median, `${row.mode} median`).toBeLessThanOrEqual(quality === 'high' ? 20 : 33.4);
                expect.soft(row.p95, `${row.mode} p95`).toBeLessThanOrEqual(quality === 'high' ? 33.4 : 50);
            }
            expect(failures).toEqual([]);
        } finally {
            await page.evaluate(() => {
                const r = window.__thatchReview; if (!r) return;
                if (r.clock) Object.defineProperty(performance, 'now', r.clock); else delete performance.now;
                r.grounds.forEach(node => { node.material = r.candidate; }); r.baseline.dispose();
                r.actors.forEach(actor => actor.dispose());
                r.game.destroy(); delete window.__thatchReview;
            });
        }
    });
}
