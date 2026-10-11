import { test, expect } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

for (const quality of ['high', 'low']) test(`prepared ${quality} foliage matrix product cache preserves native rendering`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    const result = await page.evaluate(async quality => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { WorldGenerator } = await import('/src/world/WorldGenerator.js');
        const { cacheUnchangedMatrixProduct } = await import('/src/core/UnchangedMatrixProduct.js');
        const { createProceduralTerrainMaterial } = await import('/src/art/ProceduralRealmTerrain.js');
        const render = new RenderSystem(false); render.setGraphicsQuality(quality);
        render.renderer.setSize(1280, 844, false);
        const world = new WorldGenerator(render.instanceEnvironmentGroup, { addCollider() {} }, { graphicsQuality: quality });
        const restorers = [], cells = [], phases = [], controls = [];
        const select = mode => {
            while (restorers.length) restorers.pop()();
            if (mode === 'cached') for (const cell of cells) {
                const restore = cacheUnchangedMatrixProduct(cell.matrixWorld);
                if (!restore) throw Error('Unexpected foliage matrix owner');
                restorers.push(restore);
            }
        };
        const summarize = samples => {
            const sorted = [...samples].sort((a, b) => a - b);
            return { medianMs: sorted[Math.floor(sorted.length / 2)], p95Ms: sorted[Math.floor(sorted.length * .95)], samples };
        };
        try {
            await world.loadTrees(0, 200);
            for (const root of render.foliageShadowInfluence.roots) root.traverse(part => { if (part.isInstancedMesh) cells.push(part); });
            const earthRoot = [...render.foliageShadowInfluence.roots].find(root => root.userData.region === 'earth');
            const first = earthRoot.userData.placements[0];
            const focus = new THREE.Vector3(first.x, .1, first.z);
            const draws = { color: 0, shadow: 0 };
            for (const cell of cells) {
                const color = cell.onBeforeRender, shadow = cell.onBeforeShadow;
                cell.onBeforeRender = function(...args) { draws.color++; return color.apply(this, args); };
                cell.onBeforeShadow = function(...args) { draws.shadow++; return shadow.apply(this, args); };
            }
            const ground = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), createProceduralTerrainMaterial('earth', { quality }));
            ground.rotation.x = -Math.PI / 2; ground.position.set(focus.x, -.02, focus.z); ground.receiveShadow = true;
            render.instanceEnvironmentGroup.add(ground);
            render.setEnvironmentContext('earth', focus); render.setZoom(28);
            render.setCameraTarget(focus); render.updateEnvironmentLighting(focus, 0);
            // Snapshot comparison uses both native color and shadow submissions
            // in adjacent synchronous frames. Stop only shader wind's clock for
            // this comparison; the performance arms keep its normal owner.
            const target = new THREE.WebGLRenderTarget(640, 422);
            const capture = () => {
                draws.color = draws.shadow = 0;
                render.renderer.setRenderTarget(target); render.renderer.render(render.scene, render.camera);
                const pixels = new Uint8Array(640 * 422 * 4);
                render.renderer.readRenderTargetPixels(target, 0, 0, 640, 422, pixels);
                const matrices = cells.map(cell => [...cell.matrixWorld.elements]);
                return { pixels, matrices, draws: { ...draws }, calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles };
            };
            const wind = new Map();
            render.scene.traverse(part => {
                for (const material of [].concat(part.material || [])) if (material.userData.woodlandWind && !wind.has(material)) {
                    wind.set(material, material.onBeforeRender); material.onBeforeRender = () => {};
                }
            });
            try {
                for (const stage of ['stationary', 'camera', 'parent', 'manual', 'bounds', 'return']) {
                    if (stage === 'camera') { focus.x += 35; render.setCameraTarget(focus); }
                    if (stage === 'parent') render.instanceEnvironmentGroup.position.x += 7;
                    if (stage === 'manual') { cells[0].matrix.makeTranslation(4, 1, 3); cells[0].matrixWorld.makeTranslation(999, 0, 0); }
                    if (stage === 'bounds') { cells[0].boundingBox.max.y += 5; render.setGraphicsQuality(quality === 'high' ? 'low' : 'high'); }
                    if (stage === 'return') { cells[0].matrix.identity(); render.instanceEnvironmentGroup.position.x = 0; render.setGraphicsQuality(quality); }
                    select('ordinary'); render.renderer.info.autoReset = true; capture(); const ordinary = capture();
                    select('cached'); capture(); const cached = capture();
                    let changed = 0;
                    for (let i = 0; i < ordinary.pixels.length; i++) if (ordinary.pixels[i] !== cached.pixels[i]) changed++;
                    controls.push({ stage, changed, matricesEqual: JSON.stringify(ordinary.matrices) === JSON.stringify(cached.matrices),
                        ordinary: { draws: ordinary.draws, calls: ordinary.calls, triangles: ordinary.triangles },
                        cached: { draws: cached.draws, calls: cached.calls, triangles: cached.triangles } });
                }
            } finally {
                render.renderer.setRenderTarget(null); target.dispose();
                for (const [material, hook] of wind) material.onBeforeRender = hook;
            }
            for (const mode of ['ordinary', 'cached', 'cached', 'ordinary']) {
                select(mode);
                for (let frame = 0; frame < 10; frame++) { await new Promise(requestAnimationFrame); render.render(); }
                const samples = [];
                draws.color = draws.shadow = 0;
                for (let frame = 0; frame < 60; frame++) {
                    await new Promise(requestAnimationFrame);
                    const start = performance.now(); render.render(); samples.push(performance.now() - start);
                }
                const transforms = [];
                for (let frame = 0; frame < 90; frame++) {
                    const start = performance.now(); render.scene.updateMatrixWorld(); transforms.push(performance.now() - start);
                }
                phases.push({ mode, submission: summarize(samples), transforms: summarize(transforms),
                    foliageDraws: { ...draws },
                    calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles });
            }
            select('ordinary');
            const gl = render.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
            return { quality, cells: cells.length, controls, phases, restored: cells.every(cell => !Object.hasOwn(cell.matrixWorld, 'multiplyMatrices')),
                gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
                scope: 'Prepared real foliage from all four production realms and normal renderer/ground/shadows, High/Low. ABBA synchronous submission and separate transform costs, 240 RAF renders. No server, animated-party, frame-interval or physical-device acceptance.' };
        } finally { select('ordinary'); render.dispose(); }
    }, quality);
    await testInfo.attach('foliage-matrix-products', { body: JSON.stringify(result), contentType: 'application/json' });
    expect(result.cells).toBeGreaterThan(3000); expect(result.restored).toBe(true);
    expect(result.gpu).not.toMatch(/SwiftShader|llvmpipe|software/i);
    for (const row of result.controls) {
        expect(row.changed, row.stage).toBe(0); expect(row.matricesEqual, row.stage).toBe(true);
        expect(row.ordinary).toEqual(row.cached);
        expect(row.ordinary.draws.color, row.stage).toBeGreaterThan(0);
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
