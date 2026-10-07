import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

// Bounded geometry-cost comparison, NOT a shared-host FPS acceptance run.
// Same placements/materials/camera; only realm-wide versus spatial batch bounds.
for (const realm of ['earth', 'water', 'fire', 'air']) {
test(`production ${realm} foliage retains its appearance while distant leaf batches are culled`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/repro.html?gallery=1&instances=1', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__eidolonAnimationGallery?.ready);
    const setup = await page.evaluate(async realm => {
        const THREE = await import('three');
        const { WorldGenerator } = await import('/src/world/WorldGenerator.js');
        const { getFoliageRenderBatches } = await import('/src/art/FoliageRenderBatches.js');
        const { createProceduralTerrainMaterial } = await import('/src/art/ProceduralRealmTerrain.js');
        const { PROCEDURAL_FOLIAGE_RECIPES } = await import('/src/data/worldFoliage.js');
        const { WORLD_REGIONS } = await import('/src/data/worldGeography.js');
        const gallery = window.__eidolonAnimationGalleryController, render = gallery.renderSystem;
        render.staticEnvironmentGroup.visible = false;
        [gallery.actor, gallery.remoteActor, gallery.targetActor].forEach(actor => { actor.mesh.visible = false; });
        render.scene.children.filter(child => child.type === 'GridHelper').forEach(child => { child.visible = false; });
        const generator = new WorldGenerator(render.scene, { addCollider() {} });
        await generator.loadTrees(0, 200);
        const spatial = new THREE.Group(); render.scene.add(spatial);
        const baseline = new THREE.Group();
        let trees = 0, first;
        for (const { id } of PROCEDURAL_FOLIAGE_RECIPES.filter(recipe => recipe.region === realm)) {
            const group = render.scene.getObjectByName(`foliage:${realm}:${id}`);
            const placements = group.userData.placements;
            spatial.add(group); trees += placements.length; first ??= placements[0];
            for (const part of getFoliageRenderBatches(id, generator.graphicsQuality)) {
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
        render.applyLightingPreset(realm, true); render.setZoom(28);
        render.updateShadowFocus(focus);
        render.camera.position.copy(focus).add(new THREE.Vector3(75, 95, 115));
        gallery.controls.target.copy(focus); gallery.controls.update();
        const region = WORLD_REGIONS[realm];
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(region.maxX-region.minX-1.5, region.maxZ-region.minZ-1.5), createProceduralTerrainMaterial(realm));
        ground.rotation.x = -Math.PI / 2;
        ground.position.set((region.minX+region.maxX)/2, -.02, (region.minZ+region.maxZ)/2); ground.receiveShadow = true;
        render.scene.add(ground);
        document.querySelectorAll('#repro-hud, #animation-gallery, #perf-overlay').forEach(el => { el.style.display = 'none'; });
        window.__foliageComparison = { baseline, spatial, render };
        return { trees, batches: spatial.children.reduce((n, g) => n + g.children.length, 0), baselineBatches: baseline.children.length };
    }, realm);
    expect(setup.trees).toBe({ earth: 391, water: 180, fire: 165, air: 165 }[realm]);
    expect(setup.batches).toBeGreaterThan(setup.baselineBatches);
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
                // Count only the compared realm's actual color/shadow draws
                // separately from the unchanged background. Fire's background
                // alone exceeds the old Earth whole-scene /3 comparison.
                const foliage = { triangles: 0, color: 0, shadow: 0 }, originals = [];
                (mode === 'baseline' ? baseline : spatial).traverse(mesh => {
                    if (!mesh.isMesh) return;
                    const color = mesh.onBeforeRender, shadow = mesh.onBeforeShadow;
                    const record = (pass, geometry, group) => {
                        const count = group?.count ?? Math.min(geometry.drawRange.count,
                            geometry.index?.count ?? geometry.attributes.position.count);
                        foliage[pass]++;
                        foliage.triangles += count / 3 * mesh.count;
                    };
                    originals.push({ mesh, color, shadow });
                    mesh.onBeforeRender = function(...args) {
                        record('color', args[3], args[5]); return color.apply(this, args);
                    };
                    mesh.onBeforeShadow = function(...args) {
                        record('shadow', args[4], args[6]); return shadow.apply(this, args);
                    };
                });
                try {
                    render.render();
                    return { triangles: render.renderer.info.render.triangles,
                        calls: render.renderer.info.render.calls, foliage };
                } finally {
                    originals.forEach(({ mesh, color, shadow }) => {
                        mesh.onBeforeRender = color; mesh.onBeforeShadow = shadow;
                    });
                }
            }, { mode, quality });
            await page.screenshot({ path: testInfo.outputPath(`${quality}-${mode}.png`) });
        }
        console.log(`Foliage draw comparison: ${JSON.stringify({ quality, ...setup, ...metrics })}`);
        await testInfo.attach(`${quality}-draw-cost`, { body: JSON.stringify({ setup, metrics }), contentType: 'application/json' });
        // Preserve the established Earth full-frame contract. Other realms
        // must still reduce the full frame AND the selected foliage by /3;
        // unchanged background geometry cannot establish or defeat that gain.
        expect.soft(metrics.spatial.triangles).toBeLessThan(metrics.baseline.triangles / (realm === 'earth' ? 3 : 1));
        expect.soft(metrics.spatial.foliage.triangles).toBeGreaterThan(0);
        expect.soft(metrics.spatial.foliage.triangles).toBeLessThan(metrics.baseline.foliage.triangles / 3);
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
}
