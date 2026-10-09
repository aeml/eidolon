import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';

for (const quality of ['high', 'low']) test(`${quality}: spatial woodland keeps original native foliage pixels and individual shapes`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: quality === 'high' ? 1280 : 390, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const result = await page.evaluate(async quality => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { WorldGenerator } = await import('/src/world/WorldGenerator.js');
        const { updateFoliageRenderQuality } = await import('/src/art/FoliageRenderBatches.js');
        const { EARTH_ELEVATION: elevation } = await import('/src/data/worldElevation.js');
        const { renderFrameInterval } = await import('/tests/e2e/renderFrameInterval.js');
        document.getElementById('start-screen').style.display = 'none';
        const render = new RenderSystem(false); render.setGraphicsQuality(quality);
        if (!render.renderer.extensions.has('WEBGL_multi_draw')) throw new Error('Native multi-draw is required for this prototype comparison');
        const groups = [new THREE.Group(), new THREE.Group()];
        render.instanceEnvironmentGroup.add(...groups);
        for (const [i, group] of groups.entries()) {
            const generator = new WorldGenerator(group, { addCollider() {} }, { graphicsQuality: quality,
                terrainElevation: elevation, woodlandSpatialBatches: i === 1,
                understorySpatialBatches: render.renderer.extensions.has('WEBGL_multi_draw') });
            await generator.loadTrees(0, 200);
        }
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshStandardMaterial({ color: 0x4a4842 }));
        floor.rotation.x = -Math.PI / 2; floor.position.y = -20; floor.receiveShadow = true; render.scene.add(floor);
        render.waterTexture = null;
        const canvas = render.renderer.domElement, copy = document.createElement('canvas');
        copy.width = canvas.width; copy.height = canvas.height;
        const ctx = copy.getContext('2d', { willReadFrequently: true });
        const select = i => { groups[0].visible = i === 0; groups[1].visible = i === 1; };
        const capture = i => {
            select(i); render.render(); ctx.drawImage(canvas, 0, 0);
            return { pixels: ctx.getImageData(0, 0, copy.width, copy.height).data,
                calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles };
        };
        const difference = (a, b, channels = []) => {
            let changed = 0, maximum = 0;
            for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) {
                changed++; maximum = Math.max(maximum, Math.abs(a[i] - b[i]));
                if (channels.length < 8) channels.push({ x: Math.floor(i / 4) % copy.width,
                    y: Math.floor(i / (copy.width * 4)), channel: i % 4, before: a[i], after: b[i] });
            }
            return { changed, maximum };
        };
        const gl = render.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
        const renderer = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
        const reports = [], timings = [], now = performance.now.bind(performance);
        let firstMismatch = null;
        try {
            // Freeze shader time only for pixels. Actual compositor/timing loop
            // below keeps its real clock; no simulation or equipped-party claim.
            performance.now = () => 12500;
            for (const level of [quality, quality === 'high' ? 'low' : 'high', quality]) {
                render.setGraphicsQuality(level); groups.forEach(group => updateFoliageRenderQuality(group, level));
                for (const [realm, x, z] of [['earth', -75, -330], ['earth', -33, -235], ['earth', 340, 200],
                    ['earth', 470, 200], ['earth', 600, 200], ['earth', 800, 250], ['water', 0, -1000], ['fire', -1100, 200], ['air', 1100, 200]]) {
                    const focus = new THREE.Vector3(x, realm === 'earth' ? elevation.sample(x, z) : 0, z);
                    render.setZoom(18); render.setCameraTarget(focus); render.applyLightingPreset(realm, true); render.updateShadowFocus(focus);
                    capture(0); capture(1);
                    const old = capture(0), repeat = capture(0), candidate = capture(1);
                    const differingChannels = [], delta = difference(old.pixels, candidate.pixels, differingChannels);
                    if (delta.changed && !firstMismatch) {
                        ctx.putImageData(new ImageData(old.pixels, copy.width, copy.height), 0, 0);
                        const beforePNG = copy.toDataURL('image/png');
                        ctx.putImageData(new ImageData(candidate.pixels, copy.width, copy.height), 0, 0);
                        firstMismatch = { quality: level, realm, x, z, beforePNG, afterPNG: copy.toDataURL('image/png') };
                    }
                    reports.push({ quality: level, realm, x, z, repeat: difference(old.pixels, repeat.pixels),
                        difference: delta, differingChannels, beforeCalls: old.calls, afterCalls: candidate.calls,
                        beforeTriangles: old.triangles, afterTriangles: candidate.triangles });
                }
            }
            performance.now = now;
            render.setGraphicsQuality(quality); groups.forEach(group => updateFoliageRenderQuality(group, quality));
            const focus = new THREE.Vector3(470, elevation.sample(470, 200), 200);
            render.setCameraTarget(focus); render.applyLightingPreset('earth', true); render.updateShadowFocus(focus);
            for (const variant of [0, 1, 1, 0]) {
                select(variant);
                for (let i = 0; i < 20; i++) { await new Promise(resolve => requestAnimationFrame(resolve)); render.render(); }
                const frame = [], cpu = []; let last;
                for (let i = 0; i < 120; i++) {
                    const timestamp = await new Promise(resolve => requestAnimationFrame(resolve));
                    if (last !== undefined) frame.push(renderFrameInterval(timestamp, last)); last = timestamp;
                    const start = now(); render.render(); cpu.push(now() - start);
                }
                const percentile = (values, fraction) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * fraction)];
                timings.push({ variant, frames: cpu.length, frameMedianMs: percentile(frame, .5), frameP95Ms: percentile(frame, .95),
                    cpuMedianMs: percentile(cpu, .5), cpuP95Ms: percentile(cpu, .95),
                    calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles });
            }
            capture(1);
            return { quality, renderer, reports, timings, firstMismatch, previewPNG: copy.toDataURL('image/png'),
                scope: 'Current native renderer, original source versus optional spatial woodland producer;27views/quality toggles plus separate ABBA120-frame samples. No supplied equipment, live game, whole-game or supported-device certificate.' };
        } finally { performance.now = now; render.dispose(); }
    }, quality);
    await writeFile(testInfo.outputPath('candidate.png'), Buffer.from(result.previewPNG.split(',')[1], 'base64'));
    delete result.previewPNG;
    if (result.firstMismatch) for (const key of ['beforePNG', 'afterPNG']) {
        await writeFile(testInfo.outputPath(`mismatch-${key}.png`), Buffer.from(result.firstMismatch[key].split(',')[1], 'base64'));
        delete result.firstMismatch[key];
    }
    await writeFile(testInfo.outputPath('comparison.json'), JSON.stringify(result, null, 2));
    expect(result.renderer).not.toMatch(/SwiftShader|llvmpipe|software/i);
    for (const sample of result.reports) {
        expect(sample.repeat).toEqual({ changed: 0, maximum: 0 });
        expect(sample.difference, JSON.stringify(sample)).toEqual({ changed: 0, maximum: 0 });
    }
    expect(failures).toEqual([]);
});
