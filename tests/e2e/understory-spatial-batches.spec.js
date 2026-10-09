import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';

// Compare the candidate with the unchanged production submission path inside
// the actual world builder/lighting/composer. This fixture is not live-party,
// earned gameplay, phone hardware or final modern-art acceptance.
for (const [quality, width] of [['high', 1280], ['low', 390]]) {
    test(`spatial understory preserves rendered plants and wind: ${quality}`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        page.on('console', message => {
            if (message.text().startsWith('[understory-comparison]')) console.log(message.text());
        });
        if (process.env.EIDOLON_UNDERSTORY_DISABLE_MULTIDRAW === '1') await page.addInitScript(() => {
            const original = WebGL2RenderingContext.prototype.getExtension;
            WebGL2RenderingContext.prototype.getExtension = function(name) {
                return name === 'WEBGL_multi_draw' ? null : original.call(this, name);
            };
        });
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height: 844 });
        await page.goto('/', { waitUntil: 'networkidle' });
        const result = await page.evaluate(async ({ quality }) => {
            const THREE = await import('three');
            const { RenderSystem } = await import('/src/core/RenderSystem.js');
            const { WorldGenerator } = await import('/src/world/WorldGenerator.js');
            const { CollisionManager } = await import('/src/core/CollisionManager.js');
            const { createEarthUnderstory } = await import('/src/art/EarthUnderstory.js');
            const { EARTH_ELEVATION: field } = await import('/src/data/worldElevation.js');
            const { EARTH_OUTCROP_PROFILE } = await import('/src/data/earthOutcrops.js');
            const { createRealmGroundMesh } = await import('/src/art/RealmGroundMesh.js');
            const { WORLD_REGIONS } = await import('/src/data/worldGeography.js');
            const { renderFrameInterval } = await import('/tests/e2e/renderFrameInterval.js');
            const elapsedNow = performance.now.bind(performance);
            document.getElementById('start-screen').style.display = 'none';
            const render = new RenderSystem(quality === 'low'); render.setGraphicsQuality(quality);
            render.renderer.domElement.dataset.understoryComparison = 'true';
            await render.preloadEnvironment();
            console.log('[understory-comparison] environment loaded');
            const oldGround = render.groundEarth;
            render.groundEarth = createRealmGroundMesh(WORLD_REGIONS.earth, oldGround.material, field);
            render.groundEarth.position.copy(oldGround.position);
            render.groundEarth.quaternion.copy(oldGround.quaternion);
            oldGround.parent.add(render.groundEarth);
            oldGround.removeFromParent(); oldGround.geometry.dispose();
            const scenery = render.instanceEnvironmentGroup;
            const world = new WorldGenerator(scenery, new CollisionManager(), { terrainElevation: field,
                terrainProfile: EARTH_OUTCROP_PROFILE, graphicsQuality: quality });
            await world.loadTrees(0, 200); await world.loadBuildings(0, 200);
            console.log('[understory-comparison] production scenery loaded');
            const candidate = scenery.children.find(root => root.userData.earthUnderstory);
            if (!candidate?.children.every(mesh => mesh.isBatchedMesh)) throw new Error('Production world builder omitted spatial ground cover');
            candidate.removeFromParent();
            const original = createEarthUnderstory({ quality, terrainElevation: field, spatialBatches: false });
            // Freeze only shader animation. Browser/loader clocks and RAF stay
            // live; replacing performance.now can stall shader preparation.
            for (const root of [original, candidate]) {
                const material = root.children[0].material;
                const compile = material.onBeforeCompile, update = material.onBeforeRender;
                let uniforms;
                material.onBeforeCompile = shader => { compile(shader); uniforms = shader.uniforms; };
                material.onBeforeRender = () => { update(); if (uniforms) uniforms.woodlandTime.value = 12.5; };
            }
            // The production water uniform/offset starts fixed at this point.
            // Retain its mesh and material while suppressing only time updates.
            render.waterTexture = null;
            render.setZoom(18); render.applyLightingPreset('earth', true);
            render.scene.updateMatrixWorld(true);
            // This ground factory uses local XY planes; the actual renderer's
            // rotation places them horizontally. Verify the sampled surface
            // before any image or budget comparison can qualify the fixture.
            const groundRay = new THREE.Raycaster(new THREE.Vector3(470, 100, 200), new THREE.Vector3(0, -1, 0));
            const hit = groundRay.intersectObject(render.groundEarth, true)[0];
            if (!hit || Math.abs(hit.point.y - field.sample(470, 200)) > .0001) throw new Error('Comparison ground is not the actual sampled surface');
            const gl = render.renderer.getContext();
            const capture = document.createElement('canvas');
            capture.width = render.renderer.domElement.width; capture.height = render.renderer.domElement.height;
            const context = capture.getContext('2d', { willReadFrequently: true });
            const pixels = () => {
                render.render();
                context.drawImage(render.renderer.domElement, 0, 0);
                return context.getImageData(0, 0, capture.width, capture.height).data;
            };
            const compare = (a, b) => {
                let changedChannels = 0, maximumDifference = 0;
                for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) {
                    changedChannels++; maximumDifference = Math.max(maximumDifference, Math.abs(a[i] - b[i]));
                }
                return { changedChannels, maximumDifference };
            };
            const comparisons = [];
            const imageContent = data => {
                const colors = new Set(); let nonBlack = 0;
                for (let i = 0; i < data.length; i += 4 * 67) {
                    const rgb = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
                    colors.add(rgb); if (rgb) nonBlack++;
                }
                return { colors: colors.size, nonBlack };
            };
            for (const [name, x, z] of [['grove', -75, -330], ['willow', -33, -235], ['west-bank', 340, 200],
                ['woodland-cut', 470, 200], ['outer-fold', 600, 200]]) {
                const focus = new THREE.Vector3(x, field.sample(x, z), z);
                render.setCameraTarget(focus); render.updateEnvironmentLighting(focus, 0);
                let movingBaseline;
                for (const reducedMotion of [false, true]) {
                    document.documentElement.dataset.reducedMotion = String(reducedMotion);
                    scenery.add(original); render.render(); render.render();
                    const baseline = pixels(), repeatedBaseline = pixels(); original.removeFromParent();
                    if (!reducedMotion) movingBaseline = baseline;
                    scenery.add(candidate); render.render(); render.render();
                    const batched = pixels(); candidate.removeFromParent();
                    comparisons.push({ name, reducedMotion, baselineRepeat: compare(baseline, repeatedBaseline),
                        content: imageContent(baseline),
                        windChangedChannels: reducedMotion ? compare(movingBaseline, baseline).changedChannels : null,
                        candidate: compare(baseline, batched) });
                    console.log(`[understory-comparison] ${quality}/${name}/reduced=${reducedMotion}: ${JSON.stringify(comparisons.at(-1))}`);
                }
            }
            document.documentElement.dataset.reducedMotion = 'false';
            const focus = new THREE.Vector3(470, field.sample(470, 200), 200);
            render.setCameraTarget(focus); render.updateEnvironmentLighting(focus, 0);
            const timings = [[], []], cpu = [[], []], submissions = [];
            const nextFrame = () => new Promise((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error('Native RAF stalled for 2 seconds')), 2000);
                requestAnimationFrame(timestamp => { clearTimeout(timer); resolve(timestamp); });
            });
            const percentile = (values, fraction) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * fraction)];
            // Alternate the complete rendered scene, including warmup, so a
            // growing GPU/process load does not always favor one alternative.
            for (let round = 0; round < 4; round++) for (const index of (round % 2 ? [1, 0] : [0, 1])) {
                const root = [original, candidate][index]; scenery.add(root);
                console.log(`[understory-comparison] timing round ${round}, spatial=${Boolean(index)}`);
                for (let i = 0; i < 12; i++) { await nextFrame(); render.render(); }
                let previous = await nextFrame();
                for (let frame = 0; frame < 30; frame++) {
                    const timestamp = await nextFrame();
                    timings[index].push(renderFrameInterval(timestamp, previous)); previous = timestamp;
                    const start = elapsedNow(); render.render(); cpu[index].push(elapsedNow() - start);
                }
                submissions[index] = { calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles };
                root.removeFromParent();
            }
            scenery.add(candidate); render.render();
            const result = { quality, plants: [original.userData.plantCount, candidate.userData.plantCount],
                meshes: [original.children.length, candidate.children.length],
                graphics: { renderer: gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info')?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER),
                    multiDraw: Boolean(gl.getExtension('WEBGL_multi_draw')) }, comparisons,
                timings: timings.map((values, index) => ({ spatialBatches: Boolean(index), frames: values.length,
                    medianFrameMs: percentile(values, .5), p95FrameMs: percentile(values, .95),
                    medianRenderCpuMs: percentile(cpu[index], .5), p95RenderCpuMs: percentile(cpu[index], .95), ...submissions[index] })) };
            window.__understoryComparison = { render, original, candidate };
            return result;
        }, { quality });
        const receipt = testInfo.outputPath('comparison.json');
        await writeFile(receipt, JSON.stringify(result, null, 2));
        await testInfo.attach('comparison.json', { path: receipt, contentType: 'application/json' });
        // The login owns a hidden earlier canvas. Capture this renderer only.
        await page.locator('canvas[data-understory-comparison="true"]').screenshot({ path: testInfo.outputPath(`spatial-understory-${quality}.png`) });
        expect(result.plants[0]).toBe(result.plants[1]);
        expect(result.meshes[1]).toBeLessThan(350);
        for (const comparison of result.comparisons) {
            expect(comparison.content.colors, `${comparison.name}: actual rendered scene`).toBeGreaterThan(128);
            expect(comparison.content.nonBlack).toBeGreaterThan(128);
            if (comparison.reducedMotion) expect(comparison.windChangedChannels, `${comparison.name}: visible moving plants`).toBeGreaterThan(0);
            expect(comparison.baselineRepeat, `${comparison.name}: stable baseline`).toEqual({ changedChannels: 0, maximumDifference: 0 });
            expect(comparison.candidate, `${comparison.name}: same plants and wind`).toEqual({ changedChannels: 0, maximumDifference: 0 });
        }
        expect(failures).toEqual([]);
    });
}

test('spatial understory releases actual GPU resources across repeated scene replacement', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    const result = await page.evaluate(async () => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { createEarthUnderstory } = await import('/src/art/EarthUnderstory.js');
        const { EARTH_ELEVATION: field } = await import('/src/data/worldElevation.js');
        const render = new RenderSystem(); await render.preloadEnvironment();
        const focus = new THREE.Vector3(-75, field.sample(-75, -330), -330);
        render.setCameraTarget(focus); render.updateEnvironmentLighting(focus, 0);
        render.render(); render.render();
        const memory = () => ({ ...render.renderer.info.memory });
        const baseline = memory(), cycles = [];
        for (const quality of ['high', 'low', 'high']) {
            const root = createEarthUnderstory({ quality, terrainElevation: field, spatialBatches: true });
            render.instanceEnvironmentGroup.add(root); render.render(); render.render();
            const allocated = memory(); root.removeFromParent(); render.disposeObjectResources(root);
            render.render(); render.render();
            cycles.push({ quality, allocated, released: memory(), registeredRoots: render.foliageShadowInfluence.roots.size });
        }
        render.dispose();
        return { baseline, cycles };
    });
    const receipt = testInfo.outputPath('gpu-lifetime.json');
    await writeFile(receipt, JSON.stringify(result, null, 2));
    await testInfo.attach('gpu-lifetime.json', { path: receipt, contentType: 'application/json' });
    for (const cycle of result.cycles) {
        expect(cycle.allocated.geometries).toBeGreaterThan(result.baseline.geometries);
        expect(cycle.allocated.textures).toBeGreaterThan(result.baseline.textures);
        expect(cycle.released).toEqual(result.baseline);
        expect(cycle.registeredRoots).toBe(0);
    }
    expect(failures).toEqual([]);
});
