import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';
import { compareAuraPixels } from '../auraPixelComparison.js';
import { expandedRestAura } from '../expandedRestAura.js';

// Mixed-class prepared scenes, not real accounts, server concurrency or raids.
// Frame profiles hold poses fixed: render submission + frame delivery, without
// gameplay/animation/network simulation. Do not report these as native FPS gains.
for (const population of [5, 20]) test(`${population} rested heroes retain populated-scene detail with fewer draws`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.addInitScript({ content: `window.__compareAuraPixels = (${compareAuraPixels.toString()});
        window.__expandedRestAura = (${expandedRestAura.toString()});` });
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    const metadata = await page.evaluate(async population => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const types = ['Fighter', 'Wizard', 'Rogue', 'Cleric'];
        const classes = await Promise.all(types.map(async type => (await import(`/src/entities/${type}.js`))[type]));
        const { createProceduralStatusEffect, updateProceduralStatusEffect,
            releaseProceduralStatusEffect } = await import('/src/art/ProceduralStatusEffects.js');
        document.getElementById('start-screen').style.display = 'none';
        const render = new RenderSystem(false); document.body.appendChild(render.renderer.domElement);
        const actors = [], rows = Math.ceil(population / 5);
        for (let index = 0; index < population; index++) {
            const actor = new classes[index % 4](`prepared-${index}`); actors.push(actor);
            await actor.ensureMesh();
            actor.position.set((index % 5 - 2) * 3.2, 0, (Math.floor(index / 5) - (rows - 1) / 2) * 3.2);
            actor.mesh.position.copy(actor.position); render.scene.add(actor.mesh);
        }
        render.setCameraTarget(new THREE.Vector3()); render.setZoom(population === 5 ? 16 : 22);
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x29352d }));
        ground.rotation.x = -Math.PI / 2; ground.position.y = -.05; render.scene.add(ground);
        const target = new THREE.WebGLRenderTarget(512, 512), materials = new Map();
        const qa = window.__populatedAura = { render, roots: { batched: [], reference: [] } };
        qa.clear = () => {
            Object.values(qa.roots).flat().forEach(releaseProceduralStatusEffect);
            qa.roots = { batched: [], reference: [] };
        };
        qa.select = mode => {
            for (const [kind, roots] of Object.entries(qa.roots)) for (const root of roots) {
                root.removeFromParent(); if (kind === mode) render.scene.add(root);
            }
        };
        qa.capture = () => {
            const previous = render.renderer.getRenderTarget(), pixels = new Uint8Array(512 * 512 * 4);
            try {
                render.renderer.setRenderTarget(target); render.renderer.render(render.scene, render.camera);
                render.renderer.readRenderTargetPixels(target, 0, 0, 512, 512, pixels);
                return { pixels, calls: render.renderer.info.render.calls };
            } finally { render.renderer.setRenderTarget(previous); }
        };
        qa.compare = (quality, elapsed) => {
            qa.clear(); render.setGraphicsQuality(quality);
            const baseline = qa.capture();
            for (const [index, actor] of actors.entries()) {
                const batch = createProceduralStatusEffect('well_rested', { quality });
                batch.position.copy(actor.position);
                updateProceduralStatusEffect(batch, elapsed + index * .17, 0);
                qa.roots.batched.push(batch);
                qa.roots.reference.push(window.__expandedRestAura(THREE, batch, materials));
            }
            qa.select('reference'); const reference = qa.capture();
            qa.select('batched'); const batched = qa.capture();
            render.renderer.render(render.scene, render.camera);
            return { pixels: window.__compareAuraPixels(batched.pixels, reference.pixels, baseline.pixels),
                calls: { batched: batched.calls - baseline.calls, reference: reference.calls - baseline.calls },
                counts: qa.roots.batched.map(root => root.children.filter(part => part.isInstancedMesh).reduce((sum, part) => sum + part.count, 0)) };
        };
        qa.profile = mode => new Promise((resolve, reject) => {
            qa.select(mode);
            const samples = []; let warmup = 60, previous, request, finished = false;
            const timer = setTimeout(() => finish(new Error(`Populated profile timed out: ${mode}/${samples.length}`)), 45000);
            const finish = error => {
                if (finished) return; finished = true; clearTimeout(timer); cancelAnimationFrame(request);
                if (error) { reject(error); return; }
                const percentile = (key, fraction) => samples.map(sample => sample[key]).sort((a, b) => a - b)[Math.floor((samples.length - 1) * fraction)];
                resolve({ mode, frames: samples.length, visibility: document.visibilityState,
                    frameMedianMs: percentile('interval', .5), frameP95Ms: percentile('interval', .95), frameP99Ms: percentile('interval', .99),
                    renderCpuMedianMs: percentile('cpu', .5), renderCpuP95Ms: percentile('cpu', .95),
                    calls: percentile('calls', .5), triangles: percentile('triangles', .5),
                    geometries: render.renderer.info.memory.geometries, textures: render.renderer.info.memory.textures });
            };
            const frame = time => {
                try {
                    const started = performance.now(); render.renderer.render(render.scene, render.camera);
                    const cpu = performance.now() - started, interval = previous === undefined ? 0 : time - previous;
                    previous = time;
                    if (warmup-- <= 0) samples.push({ interval, cpu, calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles });
                    if (samples.length === 180) finish(); else request = requestAnimationFrame(frame);
                } catch (error) { finish(error); }
            };
            request = requestAnimationFrame(frame);
        });
        qa.dispose = () => {
            qa.clear(); actors.forEach(actor => actor.dispose()); materials.forEach(material => material.dispose());
            target.dispose(); ground.geometry.dispose(); ground.material.dispose(); render.dispose();
        };
        const gl = render.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
        return { population, classes: types, renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
            viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio }, userAgent: navigator.userAgent };
    }, population);
    const comparisons = [], profiles = [];
    try {
        expect(metadata.renderer).not.toMatch(/swiftshader|llvmpipe|software/i);
        for (const quality of ['high', 'low']) {
            for (const elapsed of [.37, 1.8, 4.2]) {
                const result = await page.evaluate(({ quality, elapsed }) => window.__populatedAura.compare(quality, elapsed), { quality, elapsed });
                comparisons.push({ quality, elapsed, ...result });
                expect(result.counts).toEqual(Array(population).fill(quality === 'high' ? 16 : 8));
                expect(result.pixels.referenceSignal).toBeGreaterThan(1000);
                expect(result.pixels.relativeError).toBeLessThan(.03);
                expect(result.calls.batched).toBeGreaterThan(0);
                expect(result.calls.batched).toBeLessThanOrEqual(population * (quality === 'high' ? 10 : 8));
                expect(result.calls.batched).toBeLessThan(result.calls.reference);
            }
            await page.screenshot({ path: testInfo.outputPath(`populated-${population}-${quality}.png`) });
            // Repeated batched sample brackets the reference to expose order/warmup drift.
            const sequence = [];
            for (const mode of ['batched', 'reference', 'batched']) {
                const profile = await page.evaluate(mode => window.__populatedAura.profile(mode), mode);
                profiles.push({ quality, ...profile }); sequence.push(profile);
                expect(profile.frames).toBe(180); expect(profile.visibility).toBe('visible');
                expect(profile.frameMedianMs).toBeGreaterThan(0); expect(profile.calls).toBeGreaterThan(0);
            }
            expect(sequence[0].calls).toBe(sequence[2].calls);
            expect(sequence[0].calls).toBeLessThan(sequence[1].calls);
            expect(sequence[0].geometries).toBe(sequence[2].geometries);
            expect(sequence[0].textures).toBe(sequence[2].textures);
        }
        console.log('[populated-aura]', JSON.stringify({ ...metadata, comparisons, profiles }));
        await testInfo.attach('populated-aura-profile', { body: JSON.stringify({ ...metadata, comparisons, profiles }, null, 2), contentType: 'application/json' });
    } finally { await page.evaluate(() => window.__populatedAura.dispose()); }
    expect(failures, failures.join('\n')).toEqual([]);
});
