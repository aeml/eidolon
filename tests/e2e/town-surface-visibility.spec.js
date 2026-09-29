import { test, expect } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test('town masonry stays visible across gameplay zoom', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { WorldGenerator } = await import('/src/world/WorldGenerator.js');
        const { CollisionManager } = await import('/src/core/CollisionManager.js');
        document.getElementById('start-screen').style.display = 'none';
        const render = new RenderSystem(false);
        await render.preloadEnvironment();
        const world = new WorldGenerator(render.instanceEnvironmentGroup, new CollisionManager());
        await world.loadBuildings(0, 200);
        render.applyLightingPreset('town', true);
        window.__townSurface = { render, visit(x, z, zoom) {
            render.setZoom(zoom); render.setCameraTarget(new THREE.Vector3(x, 0, z));
            render.render();
        }, pavingPixels(x, z) {
            // Compare the same clear paving point with and without the town
            // ground. A buried/biased surface exposes a different ground pixel.
            const target = new THREE.WebGLRenderTarget(1280, 900);
            const point = new THREE.Vector3(x, .04, z + 7.5).project(render.camera);
            const pixelX = Math.floor((point.x + 1) * 640);
            const pixelY = Math.floor((point.y + 1) * 450);
            const capture = visible => {
                render.groundTown.visible = visible;
                render.renderer.setRenderTarget(target);
                render.renderer.render(render.scene, render.camera);
                const pixel = new Uint8Array(4);
                render.renderer.readRenderTargetPixels(target, pixelX, pixelY, 1, 1, pixel);
                return Array.from(pixel);
            };
            const covered = capture(true), uncovered = capture(false);
            render.groundTown.visible = true;
            render.renderer.setRenderTarget(null); target.dispose();
            render.render();
            return { covered, uncovered };
        } };
    });
    for (const [site, x, z] of [['well', 55, 240], ['menders', -55, 238], ['smithy', -30, 200]]) {
        for (const zoom of [10, 30]) {
            await page.evaluate(({ x, z, zoom }) => window.__townSurface.visit(x, z, zoom), { x, z, zoom });
            if (site !== 'smithy') {
                const pixels = await page.evaluate(({ x, z }) => window.__townSurface.pavingPixels(x, z), { x, z });
                expect(pixels.covered, `${site} paving at zoom ${zoom}`).toEqual(pixels.uncovered);
                expect(pixels.covered.slice(0, 3).some(value => value > 20)).toBe(true);
            }
            await page.screenshot({ path: testInfo.outputPath(`${site}-${zoom}.png`) });
        }
    }
    expect(failures).toEqual([]);
});
