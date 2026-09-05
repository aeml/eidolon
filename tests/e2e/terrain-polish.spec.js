import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

for (const surface of ['town', 'earth']) {
test(`${surface} ground keeps gameplay-scale detail on both graphics settings`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/repro.html?gallery=1&instances=1', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__eidolonAnimationGallery?.ready);
    await page.locator('#gallery-actor').selectOption('Fighter');
    await page.waitForFunction(() => window.__eidolonAnimationGallery?.actorType === 'Fighter' && window.__eidolonAnimationGallery.ready);
    await page.evaluate(async (surface) => {
        const THREE = await import('three');
        const gallery = window.__eidolonAnimationGalleryController;
        const render = gallery.renderSystem;
        render.staticEnvironmentGroup.visible = false;
        render.scene.children.filter((child) => child.type === 'GridHelper').forEach((child) => { child.visible = false; });
        gallery.remoteActor.mesh.visible = false;
        gallery.targetActor.mesh.visible = false;
        render.applyLightingPreset(surface, true);
        render.setZoom(15);
        render.camera.position.set(100, 100, 100);
        gallery.controls.target.set(0, 0, 0);
        gallery.controls.update();
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(...(surface === 'town' ? [198.5, 198.5] : [1998.5, 1598.5])));
        floor.material.dispose();
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -0.01;
        floor.receiveShadow = true;
        render.scene.add(floor);
        window.__terrainPolishFloor = floor;
        document.querySelectorAll('#repro-hud, #animation-gallery, #perf-overlay').forEach((element) => { element.style.display = 'none'; });
    }, surface);
    for (const quality of ['high', 'low']) {
        const metrics = await page.evaluate(async ({ quality, surface }) => {
            const { createProceduralTerrainMaterial } = await import('/src/art/ProceduralRealmTerrain.js');
            const floor = window.__terrainPolishFloor;
            if (floor.material.map) { floor.material.map.dispose(); floor.material.dispose(); }
            const started = performance.now();
            floor.material = createProceduralTerrainMaterial(surface, { quality });
            const generationMs = performance.now() - started;
            const render = window.__eidolonAnimationGalleryController.renderSystem;
            render.setGraphicsQuality(quality);
            const frames = [];
            await new Promise((resolve) => {
                let remaining = 180;
                let previous;
                const sample = (time) => {
                    if (previous !== undefined && remaining < 120) frames.push(time - previous);
                    previous = time;
                    if (--remaining > 0) requestAnimationFrame(sample);
                    else resolve();
                };
                requestAnimationFrame(sample);
            });
            frames.sort((a, b) => a - b);
            return {
                quality, generationMs, medianMs: frames[Math.floor(frames.length / 2)],
                p95Ms: frames[Math.floor(frames.length * 0.95)],
                textureBytes: floor.material.map.image.data.byteLength,
                repeat: floor.material.map.repeat.toArray(),
                geometries: render.renderer.info.memory.geometries,
                textures: render.renderer.info.memory.textures,
                surfaceTriangles: floor.geometry.index.count / 3
            };
        }, { quality, surface });
        expect(metrics.medianMs).toBeGreaterThan(0);
        console.log(`Terrain comparison: ${JSON.stringify(metrics)}`);
        expect(metrics.textureBytes).toBe(quality === 'high' ? 256 * 256 * 4 : 128 * 128 * 4);
        await testInfo.attach(`terrain-${quality}-metrics`, { body: JSON.stringify(metrics, null, 2), contentType: 'application/json' });
        await page.screenshot({ path: testInfo.outputPath(`${surface}-${quality}.png`) });
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
}
