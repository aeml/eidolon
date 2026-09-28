import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

// Bounded geometry-cost comparison, NOT a shared-host FPS acceptance run.
// Same placements/materials/camera; only realm-wide versus spatial batch bounds.
test('production birches retain their appearance while distant leaf batches are culled', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/repro.html?gallery=1&instances=1', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__eidolonAnimationGallery?.ready);
    const setup = await page.evaluate(async () => {
        const THREE = await import('three');
        const { WorldGenerator } = await import('/src/world/WorldGenerator.js');
        const { getProceduralFoliageArchetype } = await import('/src/art/ProceduralRealmFoliage.js');
        const { createProceduralTerrainMaterial } = await import('/src/art/ProceduralRealmTerrain.js');
        const gallery = window.__eidolonAnimationGalleryController, render = gallery.renderSystem;
        render.staticEnvironmentGroup.visible = false;
        [gallery.actor, gallery.remoteActor, gallery.targetActor].forEach(actor => { actor.mesh.visible = false; });
        render.scene.children.filter(child => child.type === 'GridHelper').forEach(child => { child.visible = false; });
        const generator = new WorldGenerator(render.scene, { addCollider() {} });
        await generator.loadTrees(0, 200);
        const spatial = render.scene.getObjectByName('foliage:earth:ossuary_birch');
        const placements = spatial.userData.placements;
        const baseline = new THREE.Group();
        for (const part of getProceduralFoliageArchetype('ossuary_birch')) {
            const mesh = new THREE.InstancedMesh(part.geometry, part.material, placements.length);
            placements.forEach((p, i) => mesh.setMatrixAt(i, new THREE.Matrix4().compose(
                new THREE.Vector3(p.x, 0, p.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rotation),
                new THREE.Vector3().setScalar(p.scale)).multiply(part.matrix)));
            mesh.castShadow = part.castShadow; mesh.receiveShadow = part.receiveShadow;
            mesh.computeBoundingBox(); mesh.computeBoundingSphere(); baseline.add(mesh);
        }
        render.scene.add(baseline); spatial.visible = false;
        const focus = new THREE.Vector3(placements[0].x, 2, placements[0].z);
        render.applyLightingPreset('earth', true); render.setZoom(28);
        render.camera.position.copy(focus).add(new THREE.Vector3(75, 95, 115));
        gallery.controls.target.copy(focus); gallery.controls.update();
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(1998.5, 1598.5), createProceduralTerrainMaterial('earth'));
        ground.rotation.x = -Math.PI / 2; ground.position.set(0, -.02, 200); ground.receiveShadow = true;
        render.scene.add(ground);
        document.querySelectorAll('#repro-hud, #animation-gallery, #perf-overlay').forEach(el => { el.style.display = 'none'; });
        window.__foliageComparison = { baseline, spatial, render };
        return { trees: placements.length, batches: spatial.children.length, baselineBatches: baseline.children.length };
    });
    expect(setup.trees).toBe(120); expect(setup.batches).toBeGreaterThan(setup.baselineBatches);
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
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
