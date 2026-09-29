import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

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
            const gallery = window.__eidolonAnimationGalleryController;
            // Deliberately layered presentation fixture, not a claim that one
            // build can cast every effect or that this is network combat.
            const owners = [gallery.actor, gallery.remoteActor, gallery.targetActor].filter(Boolean);
            const effects = owners.flatMap(owner => ['well_rested', 'guardian_embrace', 'spell_focus'].map(status => {
                const effect = new AttachedStatusEffect(gallery.renderSystem.effectGroup, owner, status, { quality });
                effect.update(.4);
                return effect;
            }));
            for (const [index, projectileType] of ['Fireball', 'Meteor', 'ExplosiveTrap'].entries()) {
                const effect = createProceduralProjectileImpactEffect(gallery.renderSystem.effectGroup,
                    new THREE.Vector3((index - 1) * 3, 0, 2), { projectileType, radius: 4, quality });
                effect.update(.1);
                effects.push(effect);
            }
            window.__warningClutter = effects;
            return { owners: owners.length, effects: effects.length };
        }, quality);
        expect(clutter).toEqual({ owners: 3, effects: 12 });
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
