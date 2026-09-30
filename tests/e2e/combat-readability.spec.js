import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';

test('remote contact bursts are bounded without retiring warnings, local hits or healing', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const reports = await page.evaluate(async () => {
        const THREE = await import('three');
        const { GameEngine } = await import('/src/core/GameEngine.js');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { COMPACT_COMBAT_FEEDBACK_LIMITS } = await import('/src/core/CompactCombatFeedbackBudget.js');
        document.getElementById('start-screen').style.display = 'none';
        const render = new RenderSystem(false), reports = [];
        render.setZoom(15); render.setCameraTarget(new THREE.Vector3());
        for (const quality of ['high', 'low']) {
            render.setGraphicsQuality(quality);
            const engine = Object.assign(Object.create(GameEngine.prototype), {
                effects: [], renderSystem: render, player: { id: 'local' }, terrainElevation: null,
                uiManager: { getGraphicsQuality: () => quality }
            });
            for (const x of [-9, 9]) engine.spawnTransientEffect('telegraph', new THREE.Vector3(x, 0, 0), 0xff3300,
                { radius: 6, telegraphDuration: 2, reducedMotion: true, label: 'DANGER', threatTier: 'boss' });
            engine.spawnTransientEffect('combat_feedback', new THREE.Vector3(0, 1.5, 0), 0xffffff,
                { feedbackKind: 'fighter_strike', feedbackDensity: 'compact', sourceId: 'local', targetId: 'enemy' });
            engine.spawnTransientEffect('combat_feedback', new THREE.Vector3(0, 1.5, 3), 0xffffff,
                { feedbackKind: 'restoration_tick', feedbackDensity: 'compact', sourceId: 'remote', targetId: 'friend' });
            engine.spawnTransientEffect('projectile_impact', new THREE.Vector3(0, 0, -5), 0xffffff,
                { projectileType: 'Fireball', radius: 6 });
            const protectedEffects = [...engine.effects];
            const burst = () => {
                for (let index = 0; index < 200; index++) engine.spawnTransientEffect('combat_feedback',
                    new THREE.Vector3((index % 8 - 3.5) * 1.5, 1.5, (Math.floor(index / 8) % 5 - 2) * 2), 0xffffff,
                    { feedbackKind: 'fighter_strike', feedbackDensity: 'compact', sourceId: 'remote', targetId: `enemy-${index}` });
                engine.effects.forEach(effect => { effect.elapsed = .08; effect.update(0); });
                render.render(); render.render();
                return { effects: engine.effects.length,
                    compact: engine.effects.filter(effect => effect.isCompactCombatFeedback).length,
                    roots: render.effectGroup.children.length,
                    geometries: render.renderer.info.memory.geometries, textures: render.renderer.info.memory.textures };
            };
            const first = burst(), repeat = burst();
            reports.push({ quality, limit: COMPACT_COMBAT_FEEDBACK_LIMITS[quality], first, repeat,
                protectedActive: protectedEffects.every(effect => engine.effects.includes(effect) && effect.isActive &&
                    effect.meshes.every(root => root.parent === render.effectGroup)),
                warningRadii: protectedEffects.slice(0, 2).map(effect => effect.meshes[0].userData.gameplayRadius) });
            engine.effects.forEach(effect => effect.dispose());
        }
        render.dispose();
        return reports;
    });
    await testInfo.attach('compact-contact-budget', { body: JSON.stringify(reports), contentType: 'application/json' });
    await writeFile(testInfo.outputPath('compact-contact-budget.json'), JSON.stringify(reports, null, 2));
    for (const report of reports) {
        expect(report.first.compact).toBe(report.limit);
        expect(report.first.effects).toBe(report.limit + 5);
        expect(report.repeat).toEqual(report.first);
        expect(report.protectedActive).toBe(true);
        expect(report.warningRadii).toEqual([6, 6]);
    }
    // Bounded prepared render/admission seam, not real-player raid capacity.
    expect(failures, failures.join('\n')).toEqual([]);
});

test('queued boss warnings survive cosmetic message floods at High and Low', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/repro.html?gallery=1&instances=1', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__eidolonAnimationGallery?.ready);
    // The presentation gallery does not need the network runtime normally.
    // Load the same pinned script used by index.html for this receive seam.
    await page.addScriptTag({ url: '/vendor/protobuf/protobuf.min.js' });
    for (const quality of ['high', 'low']) {
        const result = await page.evaluate(async quality => {
            const THREE = await import('three');
            const { NetworkManager } = await import('/src/core/NetworkManager.js');
            const { GameEngine } = await import('/src/core/GameEngine.js');
            const render = window.__eidolonAnimationGalleryController.renderSystem;
            render.setGraphicsQuality(quality);
            render.setZoom(15); render.setCameraTarget(new THREE.Vector3());
            const engine = Object.assign(Object.create(GameEngine.prototype), {
                effects: [], renderSystem: render, currentInstanceId: 'warning-review',
                player: { position: new THREE.Vector3() }, terrainElevation: null,
                uiManager: { getGraphicsQuality: () => quality, showCombatCallout() {} }, playAudioCue() {}
            });
            const network = new NetworkManager(null);
            for (const x of [-12, 0, 12]) {
                network._enqueueMessage({ type: 'telegraph', payload: {
                    instanceId: 'warning-review', x, z: 0, radius: 6, duration: 2,
                    theme: 'molten_core', label: 'FURNACE RUPTURE', silent: true
                } });
                for (let i = 0; i < 100; i++) {
                    network._enqueueMessage({ type: 'damage', payload: { amount: i } });
                    network._enqueueMessage({ type: 'delta', payload: { u: { player: { x: i } }, r: [] } });
                }
            }
            while (network.messageQueue.length) for (const message of network.drainMessages(20)) {
                if (message.type === 'telegraph') engine.handleServerMessage(message);
            }
            const warnings = engine.effects.map(effect => {
                effect.update(.25);
                const ring = effect.meshes[0];
                return { radius: ring.userData.gameplayRadius, x: ring.position.x,
                    duration: effect.duration, visible: ring.visible, parent: Boolean(ring.parent) };
            });
            render.render(); window.__queuedWarnings = engine.effects;
            network.dispose();
            return warnings;
        }, quality);
        expect(result).toEqual([-12, 0, 12].map(x => ({ radius: 6, x, duration: 2, visible: true, parent: true })));
        await page.screenshot({ path: testInfo.outputPath(`queued-warnings-${quality}.png`) });
        await page.evaluate(() => { window.__queuedWarnings.forEach(effect => effect.dispose()); window.__queuedWarnings = []; });
    }
    // Prepared receive/drain/render seam, not server damage or earned raid QA.
    expect(failures, failures.join('\n')).toEqual([]);
});

test('body-level periodic feedback remains visible beside equipped classes', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const results = await page.evaluate(async () => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { Actor } = await import('/src/entities/Actor.js');
        const factories = await import('/src/art/ProceduralHumanoid.js');
        const { createProceduralCombatFeedbackEffect } = await import('/src/art/ProceduralCombatFeedback.js');
        const render = new RenderSystem(false), results = [];
        render.setZoom(15); render.setCameraTarget(new THREE.Vector3());
        const target = new THREE.WebGLRenderTarget(640, 450);
        const capture = () => {
            const pixels = new Uint8Array(640 * 450 * 4);
            render.renderer.setRenderTarget(target); render.renderer.render(render.scene, render.camera);
            render.renderer.readRenderTargetPixels(target, 0, 0, 640, 450, pixels);
            return pixels;
        };
        for (const type of ['Fighter', 'Rogue', 'Wizard', 'Cleric']) {
            const actor = new Actor('cue-review', {});
            actor.meshType = type; actor.setMesh(factories[`createProcedural${type}`]({ batch: true }));
            render.entityGroup.add(actor.mesh);
            const height = actor.mesh.userData.bounds.height * Math.abs(actor.mesh.scale.y);
            const position = new THREE.Vector3(0, .08 + Math.min(4, Math.max(.55, height * .45)), 0);
            for (const quality of ['high', 'low']) for (const feedbackKind of ['poison_tick', 'restoration_tick']) {
                render.setGraphicsQuality(quality);
                const effect = createProceduralCombatFeedbackEffect(render.effectGroup, position,
                    { quality, feedbackKind, amount: 40, bodyRadius: Math.min(2, Math.max(.65, height * .2)) });
                effect.update(.08);
                const visible = capture(); effect.root.visible = false; const absent = capture();
                let pixels = 0;
                for (let i = 0; i < visible.length; i += 4) {
                    if (Math.abs(visible[i] - absent[i]) + Math.abs(visible[i + 1] - absent[i + 1]) +
                        Math.abs(visible[i + 2] - absent[i + 2]) > 12) pixels++;
                }
                results.push({ type, quality, feedbackKind, pixels }); effect.dispose();
            }
            actor.dispose();
        }
        render.renderer.setRenderTarget(null); target.dispose(); render.renderer.dispose();
        return results;
    });
    await testInfo.attach('body-cue-pixels', { body: JSON.stringify(results), contentType: 'application/json' });
    for (const row of results) expect(row.pixels, JSON.stringify(row)).toBeGreaterThan(0);
    expect(failures).toEqual([]);
});

test('ground-level combat fields remain visible above dungeon floors', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const results = await page.evaluate(async () => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { createProceduralDungeonInteriorKit } = await import('/src/art/ProceduralDungeonInteriors.js');
        const { createProceduralProjectileImpactEffect } = await import('/src/art/ProceduralProjectileImpacts.js');
        const { createTransientEffect } = await import('/src/core/TransientEffects.js');
        const { AttachedStatusEffect } = await import('/src/entities/AttachedStatusEffect.js');
        const render = new RenderSystem(false), scene = new THREE.Scene();
        scene.add(new THREE.HemisphereLight(0xffffff, 0xffffff, 2));
        const kit = createProceduralDungeonInteriorKit('molten_core');
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), kit.floorMaterial(24, 24));
        floor.rotation.x = -Math.PI / 2; floor.position.y = .1; scene.add(floor);
        const target = new THREE.WebGLRenderTarget(1280, 900), results = [];
        for (const type of ['Fireball', 'Meteor', 'ExplosiveTrap', 'BossTelegraph', 'GuardianEmbrace']) for (const quality of ['high', 'low']) {
            const warning = type === 'BossTelegraph';
            const healing = type === 'GuardianEmbrace';
            const effect = healing
                ? new AttachedStatusEffect(scene, { position: new THREE.Vector3(), guardianEmbraceRadius: 6 }, 'guardian_embrace', { quality })
                : warning
                ? createTransientEffect(scene, 'telegraph', new THREE.Vector3(), 0xff2200, {
                    radius: 6, telegraphDuration: 2, theme: 'molten_core', quality, reducedMotion: true
                })
                : createProceduralProjectileImpactEffect(scene, new THREE.Vector3(), { projectileType: type, radius: 6, quality });
            effect.update(.1);
            for (const zoom of [10, 30]) {
                render.setZoom(zoom); render.setCameraTarget(new THREE.Vector3());
                scene.updateMatrixWorld(true); render.camera.updateMatrixWorld(true);
                const field = healing ? effect.group.getObjectByName('guardian_embrace:HealingReach')
                    : warning ? effect.meshes[1] : effect.root.getObjectByName(`${type}:Impact:ExactField`);
                const point = field.localToWorld(new THREE.Vector3(healing ? .994 : .85, 0, 0)).project(render.camera);
                const capture = (showFloor, showEffect) => {
                    floor.visible = showFloor;
                    if (healing) effect.group.visible = showEffect;
                    else if (warning) effect.meshes.forEach(mesh => { mesh.visible = showEffect; });
                    else effect.root.visible = showEffect;
                    render.renderer.setRenderTarget(target); render.renderer.render(scene, render.camera);
                    const pixel = new Uint8Array(4);
                    render.renderer.readRenderTargetPixels(target, Math.floor((point.x + 1) * 640), Math.floor((point.y + 1) * 450), 1, 1, pixel);
                    return Array.from(pixel);
                };
                results.push({ type, quality, zoom, visible: capture(true, true), floorOnly: capture(true, false),
                    effectOnly: capture(false, true), empty: capture(false, false) });
            }
            effect.dispose();
        }
        render.renderer.setRenderTarget(null); target.dispose();
        render.disposeObjectResources(scene); render.renderer.dispose();
        return results;
    });
    await testInfo.attach('impact-floor-pixels', { body: JSON.stringify(results), contentType: 'application/json' });
    for (const result of results) {
        expect(result.effectOnly, 'visible control').not.toEqual(result.empty);
        expect(result.visible, `${result.type} ${result.quality} zoom${result.zoom}`).not.toEqual(result.floorOnly);
    }
    expect(failures).toEqual([]);
});

for (const motion of ['no-preference', 'reduce']) test(`boss warning edge stays exact and visible at gameplay zoom (${motion})`, async ({ page, baseURL }, testInfo) => {
    await page.emulateMedia({ reducedMotion: motion });
    const failures = collectBrowserFailures(page, baseURL);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/repro.html?gallery=1&instances=1', { waitUntil: 'networkidle' });
    await expect.poll(() => page.evaluate(() => window.__eidolonAnimationGallery?.ready)).toBe(true);
    await page.evaluate(async () => {
        const THREE = await import('three');
        const { createTransientEffect } = await import('/src/core/TransientEffects.js');
        const gallery = window.__eidolonAnimationGalleryController;
        const render = gallery.renderSystem;
        render.setZoom(15);
        render.camera.position.set(100, 100, 100);
        gallery.controls.target.set(0, 0, 0);
        gallery.controls.update();
        render.scene.traverse((object) => { if (object.type === 'GridHelper') object.visible = false; });
        document.querySelectorAll('#repro-hud, #animation-gallery, #perf-overlay').forEach((element) => { element.style.display = 'none'; });
        // Production warning meshes sampled at fixed phases, not a substitute
        // for network combat. Gallery actors provide normal gameplay scale.
        window.__warningFixture = createTransientEffect(render.effectGroup, 'telegraph', new THREE.Vector3(), 0xff2200, {
            radius: 6, telegraphDuration: 2, threatTier: 'boss',
            theme: 'molten_core', label: 'FURNACE RUPTURE'
        });
    });
    for (const quality of ['high', 'low']) {
        const clutter = await page.evaluate(async quality => {
            const THREE = await import('three');
            const { AttachedStatusEffect } = await import('/src/entities/AttachedStatusEffect.js');
            const { createProceduralProjectileImpactEffect } = await import('/src/art/ProceduralProjectileImpacts.js');
            const { createProceduralCombatFeedbackEffect } = await import('/src/art/ProceduralCombatFeedback.js');
            const gallery = window.__eidolonAnimationGalleryController;
            // Deliberately layered presentation fixture, not a claim that one
            // build can cast every effect or that this is network combat.
            const owners = [gallery.actor, gallery.remoteActor, gallery.targetActor].filter(Boolean);
            const effects = owners.flatMap(owner => ['well_rested', 'guardian_embrace', 'spell_focus'].map(status => {
                const effect = new AttachedStatusEffect(gallery.renderSystem.effectGroup, owner, status, { quality });
                effect.update(.4);
                return effect;
            }));
            for (const owner of owners) for (const feedbackKind of ['poison_tick', 'restoration_tick']) {
                const position = owner.position.clone();
                position.y += 1.2;
                const effect = createProceduralCombatFeedbackEffect(gallery.renderSystem.effectGroup,
                    position, { feedbackKind, amount: 40, quality });
                effect.update(.15); effects.push(effect);
            }
            for (const [index, projectileType] of ['Fireball', 'Meteor', 'ExplosiveTrap'].entries()) {
                const effect = createProceduralProjectileImpactEffect(gallery.renderSystem.effectGroup,
                    new THREE.Vector3((index - 1) * 3, 0, 2), { projectileType, radius: 4, quality });
                effect.update(.1);
                effects.push(effect);
            }
            window.__warningClutter = effects;
            return { owners: owners.length, effects: effects.length };
        }, quality);
        expect(clutter).toEqual({ owners: 3, effects: 18 });
        for (const phase of [0.0625, 0.125, 0.25, 0.75]) {
            const result = await page.evaluate(({ quality, phase }) => {
                const render = window.__eidolonAnimationGalleryController.renderSystem;
                render.setGraphicsQuality(quality);
                const effect = window.__warningFixture;
                effect.elapsed = phase * effect.duration;
                effect.update(0);
                const ring = effect.meshes[0];
                const motif = effect.meshes[2], label = effect.meshes[3];
                return { radius: ring.geometry.parameters.outerRadius * ring.scale.x, opacity: ring.material.opacity,
                    rotation: motif.rotation.y, motifScale: motif.scale.toArray(), labelScale: label.scale.toArray(),
                    labelBase: [...label.userData.baseScale, 1] };
            }, { quality, phase });
            await testInfo.attach(`${quality}-${phase}`, { body: JSON.stringify(result), contentType: 'application/json' });
            expect(result.radius).toBe(6);
            expect(result.opacity).toBeGreaterThan(0.45);
            if (motion === 'reduce') {
                expect(result.rotation).toBe(0);
                expect(result.motifScale).toEqual([1, 1, 1]);
                expect(result.labelScale).toEqual(result.labelBase);
            }
            await page.screenshot({ path: testInfo.outputPath(`warning-${quality}-${phase}.png`) });
        }
        expect(await page.evaluate(() => {
            const roots = window.__warningClutter.map(effect => effect.group || effect.root);
            window.__warningClutter.forEach(effect => effect.dispose());
            window.__warningClutter = [];
            return roots.every(root => root.parent === null);
        })).toBe(true);
    }
    await page.evaluate(() => window.__warningFixture.dispose());
    expect(failures, failures.join('\n')).toEqual([]);
});
