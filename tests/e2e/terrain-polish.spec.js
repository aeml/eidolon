import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test('graphics changes resize real shadow targets and release unused postprocessing', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: 960, height: 720 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const result = await page.evaluate(async () => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const render = new RenderSystem(false), snapshots = [];
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x777777 }));
        floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
        const box = new THREE.Mesh(new THREE.BoxGeometry(3, 5, 3), new THREE.MeshStandardMaterial({ color: 0x98745c }));
        box.position.y = 2.5; box.castShadow = true;
        render.scene.add(floor, box);
        render.setCameraTarget(new THREE.Vector3()); render.setZoom(15);
        render.applyLightingPreset('earth', true); render.updateShadowFocus(new THREE.Vector3());
        try {
            for (const quality of ['high', 'medium', 'low', 'medium', 'high', 'low', 'high']) {
                render.setGraphicsQuality(quality); render.render();
                snapshots.push({ quality, requested: render.keyLight.shadow.mapSize.x,
                    allocated: render.keyLight.shadow.map?.width ?? null,
                    composer: Boolean(render.composer), bloom: Boolean(render.bloomPass),
                    enabled: render.usePostProcessing, textures: render.renderer.info.memory.textures });
            }
            // A repeated current setting must not churn its active targets.
            const shadow = render.keyLight.shadow.map, composer = render.composer;
            render.setGraphicsQuality('high'); render.render();
            return { snapshots, reused: shadow === render.keyLight.shadow.map && composer === render.composer };
        } finally { render.dispose(); }
    });
    await testInfo.attach('quality-resource-transitions', { body: JSON.stringify(result), contentType: 'application/json' });
    for (const state of result.snapshots) {
        expect(state.allocated, JSON.stringify(state)).toBe(state.quality === 'high' ? 4096 : state.quality === 'medium' ? 2048 : null);
        expect(state.composer).toBe(state.quality !== 'low');
        expect(state.bloom).toBe(state.quality !== 'low');
        expect(state.enabled).toBe(state.quality !== 'low');
    }
    const low = result.snapshots.filter(s => s.quality === 'low');
    const high = result.snapshots.filter(s => s.quality === 'high');
    expect(low[1].textures).toBe(low[0].textures);
    expect(high.at(-1).textures).toBe(high[0].textures);
    expect(low[0].textures).toBeLessThan(high[0].textures);
    expect(result.reused).toBe(true);
    expect(failures, failures.join('\n')).toEqual([]);
});

for (const surface of ['town', 'earth', 'air', 'water']) {
test(`${surface} ground keeps gameplay-scale detail on both graphics settings`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
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
                surfaceMaps: ['normalMap', 'roughnessMap'].map(channel => ({
                    channel,
                    bytes: floor.material[channel]?.image.data.byteLength || 0,
                    colorSpace: floor.material[channel]?.colorSpace,
                    repeat: floor.material[channel]?.repeat.toArray()
                })),
                repeat: floor.material.map.repeat.toArray(),
                geometries: render.renderer.info.memory.geometries,
                textures: render.renderer.info.memory.textures,
                surfaceTriangles: floor.geometry.index.count / 3
            };
        }, { quality, surface });
        expect(metrics.medianMs).toBeGreaterThan(0);
        console.log(`Terrain comparison: ${JSON.stringify(metrics)}`);
        expect(metrics.textureBytes).toBe(quality === 'high' ? 256 * 256 * 4 : 128 * 128 * 4);
        expect(metrics.surfaceTriangles).toBe(2);
        for (const surfaceMap of metrics.surfaceMaps) {
            expect(surfaceMap.bytes).toBe(metrics.textureBytes);
            expect(surfaceMap.colorSpace).toBe(''); // Three.NoColorSpace, not sRGB albedo.
            expect(surfaceMap.repeat).toEqual(metrics.repeat);
        }
        await testInfo.attach(`terrain-${quality}-metrics`, { body: JSON.stringify(metrics, null, 2), contentType: 'application/json' });
        await page.screenshot({ path: testInfo.outputPath(`${surface}-${quality}.png`) });
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
}
