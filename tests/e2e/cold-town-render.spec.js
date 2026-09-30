import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';

// No gallery loop, prior world frame, gameplay/account mutations or warmup
// samples discarded. This measures renderer entry, not total network login.
for (const quality of ['high', 'low']) test(`cold town renderer records first-frame shader and upload work: ${quality}`, async ({ page, baseURL }, testInfo) => {
    test.skip(process.env.EIDOLON_E2E_COLD_RENDER !== '1', 'Opt-in bounded device profile');
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: 1280, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const prepare = process.env.EIDOLON_E2E_PREPARE_INITIAL_VIEW === '1';
    const report = await page.evaluate(async ({ quality, prepare }) => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { WorldGenerator } = await import('/src/world/WorldGenerator.js');
        const { CollisionManager } = await import('/src/core/CollisionManager.js');
        const { MeshFactory } = await import('/src/utils/MeshFactory.js');
        const stages = [];
        const stage = async (name, operation) => {
            const started = performance.now(); const result = await operation();
            stages.push({ name, cpuWallMs: performance.now() - started }); return result;
        };
        document.getElementById('start-screen').style.display = 'none';
        const render = await stage('renderer-construction', () => new RenderSystem(false));
        render.setGraphicsQuality(quality);
        render.renderer.domElement.dataset.coldTownProfile = 'true';
        const world = new WorldGenerator(render.instanceEnvironmentGroup, new CollisionManager(), { graphicsQuality: quality });
        try {
            await stage('environment', () => render.preloadEnvironment());
            await stage('startup-models', () => MeshFactory.preloadAllModels({
                phase: 'startup', playerType: 'Fighter', concurrency: 2, timeoutMs: 30000, failFast: false
            }));
            await stage('town-base', () => world.createTownBase(0, 200, 100));
            await stage('replicated-services', async () => {
                for (const [type, x, z, yaw] of [['Fighter', 0, 200, 0],
                    ['TradingHouse', -22, 185, Math.PI / 4], ['Forge', -28, 218, Math.PI / 2],
                    ['Stash', -16, 193, 0], ['QuestNPC', -20, 200, Math.PI / 2],
                    ['DwarfSalesman', 22.5, 200, -Math.PI / 2], ['Wizard', 20, 215, -Math.PI / 2],
                    ['RespecNPC', 0, 220, 0], ['DungeonNPC', 0, 240, Math.PI]]) {
                    const mesh = await MeshFactory.createMeshForType(type);
                    mesh.position.set(x, .5, z); mesh.rotation.y = yaw; render.entityGroup.add(mesh);
                }
            });
            render.setCameraTarget(new THREE.Vector3(0, .5, 200));
            render.applyLightingPreset('town', true);
            render.updateEnvironmentLighting(new THREE.Vector3(0, .5, 200), 0);
            const before = { frame: render.renderer.info.render.frame, programs: render.renderer.info.programs.length };
            let preparation = null;
            if (prepare) {
                const started = performance.now();
                if (!await render.prepareInitialView()) throw new Error('Initial view unexpectedly cancelled');
                preparation = { cpuWallMs: performance.now() - started, programs: render.renderer.info.programs.length };
            }
            const frames = [];
            let previous;
            for (let index = 0; index < 60; index++) {
                await new Promise(resolve => requestAnimationFrame(resolve));
                const started = performance.now(); render.render();
                const info = render.renderer.info;
                frames.push({ index, cpuMs: performance.now() - started,
                    intervalMs: previous === undefined ? null : started - previous,
                    calls: info.render.calls, triangles: info.render.triangles, programs: info.programs.length });
                previous = started;
            }
            const gl = render.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
            const result = { quality, before, preparation, stages, frames,
                renderer: gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
                parallelShaderCompile: Boolean(gl.getExtension('KHR_parallel_shader_compile')),
                multiDraw: Boolean(gl.getExtension('WEBGL_multi_draw')),
                viewport: [innerWidth, innerHeight, devicePixelRatio], userAgent: navigator.userAgent,
                image: render.renderer.domElement.toDataURL('image/png') };
            return result;
        } finally { render.dispose(); }
    }, { quality, prepare });
    const { image, ...metrics } = report;
    await writeFile(testInfo.outputPath('cold-town-profile.json'), JSON.stringify(metrics, null, 2));
    await writeFile(testInfo.outputPath('cold-town.png'), Buffer.from(image.split(',')[1], 'base64'));
    await testInfo.attach('cold-town-profile', { body: JSON.stringify(metrics), contentType: 'application/json' });
    expect(report.before.programs).toBe(0);
    expect(report.frames).toHaveLength(60);
    expect(report.frames[0].programs).toBeGreaterThan(0);
    expect(report.frames[0].triangles).toBeGreaterThan(0);
    expect(report.frames.at(-1).programs).toBe(report.frames[1].programs);
    if (prepare) expect(report.preparation.programs).toBe(report.frames.at(-1).programs);
    expect(failures, failures.join('\n')).toEqual([]);
});
