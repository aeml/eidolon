import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

// A controlled rendering workload, not a network/server raid simulation.
test('ten equipped heroes, Malachar and overlapping fields remain stable across repeated busy scenes', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/repro.html?gallery=1&instances=1', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__eidolonAnimationGallery?.ready);
    await page.evaluate(async () => {
        const THREE = await import('three');
        const { MeshFactory } = await import('/src/utils/MeshFactory.js');
        const { BASE_ITEMS } = await import('/src/core/ItemSystem.js');
        const { applyProceduralEquipment, EQUIPMENT_RENDER_SLOTS } = await import('/src/art/ProceduralEquipment.js');
        const { createTransientEffect } = await import('/src/core/TransientEffects.js');
        const { createProceduralAreaField, updateProceduralAreaField, releaseProceduralAreaField } = await import('/src/art/ProceduralAreaFields.js');
        const gallery = window.__eidolonAnimationGalleryController;
        gallery.cleanupPresentation();
        [gallery.actor, gallery.remoteActor, gallery.targetActor].forEach((actor) => { if (actor?.mesh) actor.mesh.visible = false; });
        const render = gallery.renderSystem;
        render.applyLightingPreset('umbral_nexus', true);
        render.setZoom(22);
        render.camera.position.set(100, 100, 100);
        gallery.controls.target.set(0, 0, 0);
        gallery.controls.update();
        render.scene.traverse((object) => { if (object.type === 'GridHelper') object.visible = false; });
        document.querySelectorAll('#repro-hud, #animation-gallery, #perf-overlay').forEach((element) => { element.style.display = 'none'; });
        const group = new THREE.Group();
        render.scene.add(group);
        const models = [];
        const mixers = [];
        for (let index = 0; index < 11; index++) {
            const type = index === 10 ? 'UmbraPrime' : ['Fighter', 'Rogue', 'Wizard', 'Cleric'][index % 4];
            const mesh = await MeshFactory.createMeshForType(type);
            if (index < 10) {
                const equipment = Object.fromEntries(EQUIPMENT_RENDER_SLOTS.map((slot, slotIndex) => {
                    const candidates = BASE_ITEMS.filter((item) => item.slot === slot.replace(/[12]$/, ''));
                    const base = candidates[index % candidates.length];
                    return [slot, gallery.createGalleryEquipmentItem(base, slot, slotIndex + 1)];
                }));
                const fit = applyProceduralEquipment(mesh, equipment);
                if (fit.items !== 14 || fit.missing.length) throw new Error(`Incomplete ${type} raid fixture loadout`);
                const angle = index / 10 * Math.PI * 2;
                mesh.position.set(Math.cos(angle) * 8, 0, Math.sin(angle) * 8);
                mesh.rotation.y = -angle - Math.PI / 2;
            }
            const mixer = new THREE.AnimationMixer(mesh);
            const clip = mesh.userData.animations.find((clip) => clip.name === (index % 2 ? 'Run' : 'Attack'));
            if (!clip) throw new Error(`Missing raid fixture animation for ${type}`);
            mixer.clipAction(clip).play();
            group.add(mesh);
            mixers.push(mixer);
            models.push({ type, mesh });
        }
        let fields = [];
        let warnings = [];
        let elapsed = 0;
        const clear = () => {
            warnings.forEach((effect) => effect.dispose());
            fields.forEach(releaseProceduralAreaField);
            warnings = [];
            fields = [];
        };
        const setBusy = (quality, active) => {
            clear();
            group.visible = active;
            render.setGraphicsQuality(quality);
            if (!active) return;
            for (let index = 0; index < 4; index++) {
                const field = createProceduralAreaField(['GravityWell', 'BurningGround', 'SmokeBomb', 'InfernoCataclysm'][index], 4, { quality });
                field.position.set(index % 2 ? 5 : -5, 0.01, index < 2 ? -4 : 4);
                render.effectGroup.add(field);
                fields.push(field);
                warnings.push(createTransientEffect(render.effectGroup, 'telegraph', field.position.clone().add(new THREE.Vector3(2, 0, 0)), 0xff4400, {
                    radius: 3, telegraphDuration: 2, threatTier: 'boss', theme: 'umbral_nexus', label: 'VOID RUPTURE'
                }));
            }
        };
        const update = {
            update(dt) {
                elapsed += dt;
                if (group.visible) mixers.forEach((mixer) => mixer.update(dt));
                fields.forEach((field) => updateProceduralAreaField(field, elapsed, dt));
                warnings.forEach((effect, index) => {
                    effect.elapsed = ((elapsed + index * 0.3) % 1.8);
                    effect.update(0);
                });
            }
        };
        gallery.persistentEntities.push(update);
        window.__raidScene = {
            setBusy,
            dispose() {
                clear();
                gallery.persistentEntities = gallery.persistentEntities.filter((entry) => entry !== update);
                mixers.forEach((mixer, index) => { mixer.stopAllAction(); mixer.uncacheRoot(models[index].mesh); });
                models.forEach(({ type, mesh }) => { mesh.removeFromParent(); MeshFactory.releaseMesh(type, mesh); });
                group.removeFromParent();
            }
        };
    });
    const reports = [];
    try {
        for (const quality of ['high', 'low']) {
            for (const phase of ['busy', 'clear', 'busy-repeat']) {
                await page.evaluate(({ quality, phase }) => window.__raidScene.setBusy(quality, phase !== 'clear'), { quality, phase });
                const report = await page.evaluate(() => new Promise((resolve, reject) => {
                    const render = window.__eidolonAnimationGalleryController.renderSystem;
                    const original = render.render;
                    const samples = [];
                    let warmup = 60;
                    let previous;
                    const timer = setTimeout(() => { render.render = original; reject(new Error('Busy scene profile timed out')); }, 30000);
                    render.render = function () {
                        const started = performance.now();
                        try { original.call(this); }
                        catch (error) { clearTimeout(timer); render.render = original; reject(error); return; }
                        const cpu = performance.now() - started;
                        const interval = previous === undefined ? 0 : started - previous;
                        previous = started;
                        if (warmup-- > 0) return;
                        const info = render.renderer.info;
                        samples.push({ interval, cpu, calls: info.render.calls, triangles: info.render.triangles });
                        if (samples.length < 180) return;
                        clearTimeout(timer);
                        render.render = original;
                        const percentile = (key, fraction) => samples.map((sample) => sample[key]).sort((a, b) => a - b)[Math.floor((samples.length - 1) * fraction)];
                        const context = render.renderer.getContext();
                        const extension = context.getExtension('WEBGL_debug_renderer_info');
                        resolve({
                            frames: samples.length, medianMs: percentile('interval', 0.5), p95Ms: percentile('interval', 0.95),
                            renderCpuMedianMs: percentile('cpu', 0.5), renderCpuP95Ms: percentile('cpu', 0.95),
                            calls: percentile('calls', 0.5), triangles: percentile('triangles', 0.5),
                            geometries: info.memory.geometries, textures: info.memory.textures,
                            renderer: extension ? context.getParameter(extension.UNMASKED_RENDERER_WEBGL) : context.getParameter(context.RENDERER)
                        });
                    };
                }));
                reports.push({ quality, phase, ...report });
                expect(report.frames).toBe(180);
                expect(report.calls).toBeGreaterThan(0);
                expect(report.renderer).not.toMatch(/swiftshader|llvmpipe|software/i);
                if (phase === 'busy') await page.screenshot({ path: testInfo.outputPath(`raid-sized-${quality}.png`) });
            }
            const first = reports.find((entry) => entry.quality === quality && entry.phase === 'busy');
            const repeat = reports.find((entry) => entry.quality === quality && entry.phase === 'busy-repeat');
            const clear = reports.find((entry) => entry.quality === quality && entry.phase === 'clear');
            expect(repeat.geometries).toBe(first.geometries);
            expect(repeat.textures).toBe(first.textures);
            expect(clear.calls).toBeLessThan(first.calls);
            // Timing is recorded, not a brittle hardware-dependent CI threshold.
        }
        console.log(`Raid-sized visual workload: ${JSON.stringify(reports)}`);
        await testInfo.attach('raid-sized-rendering-profile', { body: JSON.stringify(reports, null, 2), contentType: 'application/json' });
    } finally {
        await page.evaluate(() => window.__raidScene.dispose());
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
