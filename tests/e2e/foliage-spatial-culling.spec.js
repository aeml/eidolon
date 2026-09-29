import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

// Bounded geometry-cost comparison, NOT a shared-host FPS acceptance run.
// Same placements/materials/camera; only realm-wide versus spatial batch bounds.
test('production woodland retains its appearance while distant leaf batches are culled', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/repro.html?gallery=1&instances=1', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__eidolonAnimationGallery?.ready);
    const setup = await page.evaluate(async () => {
        const THREE = await import('three');
        const { WorldGenerator } = await import('/src/world/WorldGenerator.js');
        const { getFoliageRenderBatches } = await import('/src/art/FoliageRenderBatches.js');
        const { createProceduralTerrainMaterial } = await import('/src/art/ProceduralRealmTerrain.js');
        const gallery = window.__eidolonAnimationGalleryController, render = gallery.renderSystem;
        render.staticEnvironmentGroup.visible = false;
        [gallery.actor, gallery.remoteActor, gallery.targetActor].forEach(actor => { actor.mesh.visible = false; });
        render.scene.children.filter(child => child.type === 'GridHelper').forEach(child => { child.visible = false; });
        const generator = new WorldGenerator(render.scene, { addCollider() {} });
        await generator.loadTrees(0, 200);
        const spatial = new THREE.Group(); render.scene.add(spatial);
        const baseline = new THREE.Group();
        let trees = 0, first;
        for (const id of ['ossuary_birch', 'grave_pine', 'mourning_willow']) {
            const group = render.scene.getObjectByName(`foliage:earth:${id}`);
            const placements = group.userData.placements;
            spatial.add(group); trees += placements.length; first ??= placements[0];
            for (const part of getFoliageRenderBatches(id)) {
                const mesh = new THREE.InstancedMesh(part.geometry, part.material, placements.length);
                placements.forEach((p, i) => mesh.setMatrixAt(i, new THREE.Matrix4().compose(
                    new THREE.Vector3(p.x, 0, p.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rotation),
                    new THREE.Vector3().setScalar(p.scale)).multiply(part.matrix)));
                mesh.castShadow = part.castShadow; mesh.receiveShadow = part.receiveShadow;
                mesh.computeBoundingBox(); mesh.computeBoundingSphere(); baseline.add(mesh);
            }
        }
        // Wind is intentionally unrelated to this static-tree equivalence
        // comparison; its performance.now uniforms differ between draws.
        render.scene.getObjectByName('Gloamwood heath and fern beds').visible = false;
        render.scene.add(baseline); spatial.visible = false;
        const focus = new THREE.Vector3(first.x, 2, first.z);
        render.applyLightingPreset('earth', true); render.setZoom(28);
        render.updateShadowFocus(focus);
        render.camera.position.copy(focus).add(new THREE.Vector3(75, 95, 115));
        gallery.controls.target.copy(focus); gallery.controls.update();
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(1998.5, 1598.5), createProceduralTerrainMaterial('earth'));
        ground.rotation.x = -Math.PI / 2; ground.position.set(0, -.02, 200); ground.receiveShadow = true;
        render.scene.add(ground);
        document.querySelectorAll('#repro-hud, #animation-gallery, #perf-overlay').forEach(el => { el.style.display = 'none'; });
        window.__foliageComparison = { baseline, spatial, render };
        return { trees, batches: spatial.children.reduce((n, g) => n + g.children.length, 0), baselineBatches: baseline.children.length };
    });
    expect(setup.trees).toBe(330); expect(setup.batches).toBeGreaterThan(setup.baselineBatches);
    for (const quality of ['high', 'low']) {
        const metrics = {};
        for (const mode of ['baseline', 'spatial']) {
            metrics[mode] = await page.evaluate(async ({ mode, quality }) => {
                const { baseline, spatial, render } = window.__foliageComparison;
                baseline.visible = mode === 'baseline'; spatial.visible = mode === 'spatial';
                render.setGraphicsQuality(quality);
                await new Promise(resolve => {
                    let frames = 30;
                    const tick = () => { if (--frames) requestAnimationFrame(tick); else resolve(); };
                    requestAnimationFrame(tick);
                });
                return { triangles: render.renderer.info.render.triangles, calls: render.renderer.info.render.calls };
            }, { mode, quality });
            await page.screenshot({ path: testInfo.outputPath(`${quality}-${mode}.png`) });
        }
        console.log(`Foliage draw comparison: ${JSON.stringify({ quality, ...setup, ...metrics })}`);
        expect(metrics.spatial.triangles).toBeLessThan(metrics.baseline.triangles / 3);
        await testInfo.attach(`${quality}-draw-cost`, { body: JSON.stringify({ setup, metrics }), contentType: 'application/json' });
        const appearance = await page.evaluate(async () => {
            const THREE = await import('three');
            const { baseline, spatial, render } = window.__foliageComparison;
            const target = new THREE.WebGLRenderTarget(720, 500), pixels = [];
            const previous = render.renderer.getRenderTarget();
            try {
                // Two synchronous draws share camera, particles and lighting.
                // Read the base scene including actual tree shadows; no
                // postprocessing or screenshot encoding can hide missing leaves.
                for (const mode of ['baseline', 'spatial']) {
                    baseline.visible = mode === 'baseline'; spatial.visible = mode === 'spatial';
                    render.renderer.setRenderTarget(target);
                    render.renderer.render(render.scene, render.camera);
                    const data = new Uint8Array(720 * 500 * 4);
                    render.renderer.readRenderTargetPixels(target, 0, 0, 720, 500, data); pixels.push(data);
                }
                let changed = 0;
                for (let i = 0; i < pixels[0].length; i += 4) {
                    if ([0, 1, 2].some(channel => Math.abs(pixels[0][i + channel] - pixels[1][i + channel]) > 2)) changed++;
                }
                return { changed, total: 720 * 500 };
            } finally {
                render.renderer.setRenderTarget(previous); target.dispose();
                baseline.visible = false; spatial.visible = true;
            }
        });
        expect(appearance.changed / appearance.total, JSON.stringify(appearance)).toBeLessThan(.001);
        await testInfo.attach(`${quality}-pixel-equivalence`, { body: JSON.stringify(appearance), contentType: 'application/json' });
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
