import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

// Scoped private comparison against the exact controller before this change.
// Real renderer and scenery; this is not a busy-party/device certificate.
for (const [quality, width] of [['high', 1280], ['low', 390]]) {
    test(`swept-volume culling preserves foliage color and incoming shadows: ${quality}`, async ({ page, baseURL }, testInfo) => {
        test.skip(process.env.EIDOLON_E2E_FOLIAGE_PROJECTION_COMPARE !== '1', 'Explicit private predecessor comparison');
        const previous = execFileSync('git', ['show', '8e6cdb8f:src/core/FoliageShadowInfluence.js'], { encoding: 'utf8' });
        await page.route('**/src/core/FoliageShadowInfluenceReference.js', route => route.fulfill({ body: previous, contentType: 'text/javascript' }));
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        const failures = collectBrowserFailures(page, baseURL);
        await page.setViewportSize({ width, height: 844 });
        await page.goto('/', { waitUntil: 'networkidle' });
        const result = await page.evaluate(async quality => {
            const THREE = await import('three');
            const { RenderSystem } = await import('/src/core/RenderSystem.js');
            const { WorldGenerator } = await import('/src/world/WorldGenerator.js');
            const { CollisionManager } = await import('/src/core/CollisionManager.js');
            const { FoliageShadowInfluence: Reference } = await import('/src/core/FoliageShadowInfluenceReference.js');
            const { EARTH_ELEVATION: field } = await import('/src/data/worldElevation.js');
            const { EARTH_OUTCROP_PROFILE } = await import('/src/data/earthOutcrops.js');
            const { createRealmGroundMesh } = await import('/src/art/RealmGroundMesh.js');
            const { WORLD_REGIONS } = await import('/src/data/worldGeography.js');
            const { renderFrameInterval } = await import('/tests/e2e/renderFrameInterval.js');
            document.getElementById('start-screen').style.display = 'none';
            const render = new RenderSystem(false); render.setGraphicsQuality(quality);
            render.renderer.domElement.dataset.foliageProjection = 'true';
            await render.preloadEnvironment();
            const oldGround = render.groundEarth;
            render.groundEarth = createRealmGroundMesh(WORLD_REGIONS.earth, oldGround.material, field);
            render.groundEarth.position.copy(oldGround.position); render.groundEarth.quaternion.copy(oldGround.quaternion);
            oldGround.parent.add(render.groundEarth); oldGround.removeFromParent(); oldGround.geometry.dispose();
            const generator = new WorldGenerator(render.instanceEnvironmentGroup, new CollisionManager(), {
                graphicsQuality: quality, terrainElevation: field, terrainProfile: EARTH_OUTCROP_PROFILE,
                understorySpatialBatches: render.renderer.extensions.has('WEBGL_multi_draw')
            });
            await generator.loadTrees(0, 200); await generator.loadBuildings(0, 200);
            // Hold only animated shader uniforms for exact pixel comparison.
            // Loader/browser clocks and timed RAF samples retain their real time.
            const materials = new Set();
            render.instanceEnvironmentGroup.traverse(mesh => {
                if (!mesh.material?.userData.woodlandWind || materials.has(mesh.material)) return;
                const material = mesh.material; materials.add(material);
                const compile = material.onBeforeCompile, update = material.onBeforeRender;
                let uniforms;
                material.onBeforeCompile = shader => { compile(shader); uniforms = shader.uniforms; };
                material.onBeforeRender = () => { update(); if (uniforms) uniforms.woodlandTime.value = 12.5; };
            });
            render.waterTexture = null;
            render.scene.updateMatrixWorld(true);
            const hit = new THREE.Raycaster(new THREE.Vector3(470, 100, 200), new THREE.Vector3(0, -1, 0))
                .intersectObject(render.groundEarth)[0];
            if (!hit || Math.abs(hit.point.y - field.sample(470, 200)) > .0001) throw new Error('Raised ground fixture is not the sampled horizontal surface');
            const candidate = render.foliageShadowInfluence;
            const reference = new Reference(render.scene, [render.scene, render.environmentGroup, render.staticEnvironmentGroup, render.instanceEnvironmentGroup]);
            const controllers = { previous: reference, candidate };
            const counters = { previous: {}, candidate: {} };
            for (const [key, controller] of Object.entries(controllers)) {
                const begin = controller.beginFrame;
                controller.beginFrame = function(...args) {
                    begin.apply(this, args);
                    counters[key] = { hidden: this.hidden.length, omittedShadows: this.omitted.length };
                };
            }
            const copy = document.createElement('canvas');
            copy.width = render.renderer.domElement.width; copy.height = render.renderer.domElement.height;
            const ctx = copy.getContext('2d', { willReadFrequently: true });
            const capture = key => {
                render.foliageShadowInfluence = controllers[key]; render.render();
                ctx.drawImage(render.renderer.domElement, 0, 0);
                return { pixels: ctx.getImageData(0, 0, copy.width, copy.height).data,
                    calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles, ...counters[key] };
            };
            const compare = (a, b) => {
                let changed = 0, maximum = 0;
                for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) {
                    changed++; maximum = Math.max(maximum, Math.abs(a[i] - b[i]));
                }
                return { changed, maximum };
            };
            const reports = [], timings = [];
            const gl = render.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
            const renderer = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
            try {
                for (const [realm, x, z] of [['earth', -75, -330], ['earth', -33, -235], ['earth', 340, 200],
                    ['earth', 470, 200], ['earth', 600, 200], ['water', 0, -1000], ['fire', -1100, 200], ['air', 1100, 200]]) {
                    const focus = new THREE.Vector3(x, realm === 'earth' ? field.sample(x, z) : 0, z);
                    render.setZoom(18); render.setCameraTarget(focus); render.applyLightingPreset(realm, true);
                    render.updateShadowFocus(focus);
                    capture('previous'); capture('candidate');
                    const old = capture('previous'), repeat = capture('previous'), current = capture('candidate');
                    const colors = new Set();
                    for (let i = 0; i < old.pixels.length; i += 4 * 67) colors.add((old.pixels[i] << 16) | (old.pixels[i + 1] << 8) | old.pixels[i + 2]);
                    const { pixels: ignoredOld, ...before } = old, { pixels: ignoredCurrent, ...after } = current;
                    reports.push({ realm, x, z, colors: colors.size, baselineRepeat: compare(old.pixels, repeat.pixels),
                        candidate: compare(old.pixels, current.pixels), previous: before, current: after });
                }
                const focus = new THREE.Vector3(470, field.sample(470, 200), 200);
                render.setCameraTarget(focus); render.applyLightingPreset('earth', true); render.updateShadowFocus(focus);
                const elapsedNow = performance.now.bind(performance);
                for (const key of ['previous', 'candidate', 'candidate', 'previous']) {
                    render.foliageShadowInfluence = controllers[key];
                    for (let i = 0; i < 30; i++) { await new Promise(resolve => requestAnimationFrame(resolve)); render.render(); }
                    const frame = [], cpu = []; let last;
                    for (let i = 0; i < 120; i++) {
                        const timestamp = await new Promise(resolve => requestAnimationFrame(resolve));
                        if (last !== undefined) frame.push(renderFrameInterval(timestamp, last)); last = timestamp;
                        const start = elapsedNow(); render.render(); cpu.push(elapsedNow() - start);
                    }
                    const percentile = (values, fraction) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * fraction)];
                    timings.push({ controller: key, frames: cpu.length, frameMedianMs: percentile(frame, .5), frameP95Ms: percentile(frame, .95),
                        cpuMedianMs: percentile(cpu, .5), cpuP95Ms: percentile(cpu, .95), ...counters[key] });
                }
                render.foliageShadowInfluence = candidate;
                render.render();
                ctx.drawImage(render.renderer.domElement, 0, 0);
                return { quality, renderer, reports, timings, previewPNG: copy.toDataURL('image/png'),
                    scope: 'Actual world/renderer/composer; no equipped actors, HUD, networking or whole-game/device budget claim.' };
            } finally { render.foliageShadowInfluence = candidate; reference.dispose(); render.dispose(); }
        }, quality);
        await writeFile(testInfo.outputPath('candidate.png'), Buffer.from(result.previewPNG.split(',')[1], 'base64'));
        delete result.previewPNG;
        const artifact = testInfo.outputPath('comparison.json');
        await writeFile(artifact, JSON.stringify(result, null, 2));
        await testInfo.attach('foliage-projection-comparison', { path: artifact, contentType: 'application/json' });
        console.log('[foliage-projection-parity]', JSON.stringify(result));
        expect(result.renderer).not.toMatch(/SwiftShader|llvmpipe/i);
        for (const sample of result.reports) {
            expect(sample.colors).toBeGreaterThan(128);
            expect(sample.baselineRepeat.maximum).toBe(0); expect(sample.baselineRepeat.changed).toBe(0);
            expect(sample.candidate.maximum, JSON.stringify(sample)).toBe(0); expect(sample.candidate.changed).toBe(0);
            expect(sample.current.calls).toBeLessThanOrEqual(sample.previous.calls);
            expect(sample.current.triangles).toBeLessThanOrEqual(sample.previous.triangles);
        }
        // Both High swept-shadow and Low explicitly disabled-shadow paths now
        // qualify declared static foliage. Exact pixels above remain mandatory.
        expect(result.reports.some(sample => sample.current.hidden > sample.previous.hidden)).toBe(true);
        for (const sample of result.timings) {
            expect(Number.isFinite(sample.frameMedianMs)).toBe(true);
            expect(Number.isFinite(sample.frameP95Ms)).toBe(true);
        }
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
