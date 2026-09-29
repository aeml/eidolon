import { test, expect } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test('open realm gateways have continuous ground at both quality settings', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const render = new RenderSystem(false);
        await render.preloadEnvironment();
        document.getElementById('start-screen').style.display = 'none';
        window.__gatewayReview = { THREE, render };
    });
    const results = [];
    for (const quality of ['high', 'low']) for (const [name, x, z, axis] of [
        ['water', 0, -600, 'z'], ['fire', -1000, 200, 'x'], ['air', 1000, 200, 'x']
    ]) {
        const samples = await page.evaluate(({ quality, x, z, axis, name }) => {
            const { THREE, render } = window.__gatewayReview;
            render.setGraphicsQuality(quality); render.applyLightingPreset(name, true);
            render.setZoom(10); render.setCameraTarget(new THREE.Vector3(x, 0, z)); render.render();
            render.scene.updateMatrixWorld(true);
            const floors = ['groundEarth', 'groundSnow', 'groundFire', 'groundAir'].map(key => render[key]);
            const ray = new THREE.Raycaster();
            return [-1, -0.5, 0, 0.5, 1].map(offset => {
                ray.set(new THREE.Vector3(x + (axis === 'x' ? offset : 0), 20, z + (axis === 'z' ? offset : 0)), new THREE.Vector3(0, -1, 0));
                return { offset, covered: ray.intersectObjects(floors).length > 0 };
            });
        }, { quality, x, z, axis, name });
        results.push({ name, quality, samples });
        await page.screenshot({ path: testInfo.outputPath(`${name}-${quality}.png`) });
    }
    await testInfo.attach('gateway-coverage', { body: JSON.stringify(results), contentType: 'application/json' });
    for (const result of results) expect(result.samples.every(sample => sample.covered), `${result.name} ${result.quality}`).toBe(true);
    expect(failures).toEqual([]);
});
