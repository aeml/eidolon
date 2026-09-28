import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test('production town and Earth materials remain readable together on High and Low', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/repro.html?gallery=1&instances=1', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__eidolonAnimationGallery?.ready);
    await page.locator('#gallery-actor').selectOption('Fighter');
    await page.waitForFunction(() => window.__eidolonAnimationGallery?.actorType === 'Fighter' && window.__eidolonAnimationGallery.ready);
    await page.evaluate(async () => {
        const THREE = await import('three');
        const { createProceduralLanternholdStructure } = await import('/src/art/ProceduralLanternholdArchitecture.js');
        const { createProceduralTerrainMaterial } = await import('/src/art/ProceduralRealmTerrain.js');
        const { PROCEDURAL_FOLIAGE_RECIPES, getProceduralFoliageArchetype } = await import('/src/art/ProceduralRealmFoliage.js');
        const gallery = window.__eidolonAnimationGalleryController;
        const render = gallery.renderSystem;
        render.staticEnvironmentGroup.visible = false;
        render.scene.children.filter(child => child.type === 'GridHelper').forEach(child => { child.visible = false; });
        gallery.remoteActor.mesh.visible = false; gallery.targetActor.mesh.visible = false;
        render.applyLightingPreset('town', true);
        render.setZoom(28);
        render.camera.position.set(75, 95, 115);
        gallery.controls.target.set(0, 3, -2);
        gallery.controls.update();
        const grounds = [];
        const groundMaterial = (key, width, depth, quality) => {
            const material = createProceduralTerrainMaterial(key, { quality });
            const reference = key === 'town' ? [198.5, 198.5] : [1998.5, 1598.5];
            const repeat = material.map.repeat.clone().multiply(new THREE.Vector2(width / reference[0], depth / reference[1]));
            for (const map of [material.map, material.normalMap, material.roughnessMap].filter(Boolean)) map.repeat.copy(repeat);
            return material;
        };
        const addGround = (key, width, depth, y) => {
            const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), groundMaterial(key, width, depth, 'high'));
            plane.rotation.x = -Math.PI / 2; plane.position.y = y; plane.receiveShadow = true;
            render.scene.add(plane);
            grounds.push({ plane, key, width, depth });
        };
        addGround('earth', 160, 160, -.02); addGround('town', 62, 48, 0);
        const structures = [];
        for (const [id, x, z] of [['trading_house', -13, -8], ['blacksmith', 12, -12], ['stash', -7, 4]]) {
            const model = createProceduralLanternholdStructure(id, { optimized: true });
            model.position.set(x, 0, z); render.scene.add(model); structures.push(model);
        }
        const recipe = PROCEDURAL_FOLIAGE_RECIPES.find(recipe => recipe.region === 'earth');
        const parts = getProceduralFoliageArchetype(recipe.id);
        // Exercise the same instanced geometry/material path as WorldGenerator.
        for (const part of parts) {
            const mesh = new THREE.InstancedMesh(part.geometry, part.material, 3);
            for (const [index, x] of [-27, 26, 32].entries()) {
                const matrix = new THREE.Matrix4().makeTranslation(x, 0, -20 - index * 3).multiply(part.matrix);
                mesh.setMatrixAt(index, matrix);
            }
            mesh.castShadow = part.castShadow; mesh.receiveShadow = part.receiveShadow;
            mesh.instanceMatrix.needsUpdate = true; render.scene.add(mesh);
        }
        window.__townMaterialScene = { structures, grounds, groundMaterial };
        document.querySelectorAll('#repro-hud, #animation-gallery, #perf-overlay').forEach(element => { element.style.display = 'none'; });
    });
    for (const quality of ['high', 'low']) {
        await page.evaluate(async quality => {
            const render = window.__eidolonAnimationGalleryController.renderSystem;
            const scene = window.__townMaterialScene;
            for (const { plane, key, width, depth } of scene.grounds) {
                plane.material.map.dispose(); plane.material.dispose();
                plane.material = scene.groundMaterial(key, width, depth, quality);
            }
            render.setGraphicsQuality(quality);
            await new Promise(resolve => {
                let frames = 45;
                const tick = () => { if (--frames) requestAnimationFrame(tick); else resolve(); };
                requestAnimationFrame(tick);
            });
        }, quality);
        const metrics = await page.evaluate(() => {
            const renderer = window.__eidolonAnimationGalleryController.renderSystem.renderer;
            return {
                structures: window.__townMaterialScene.structures.map(model => ({ id: model.userData.structureId, batched: model.userData.renderBatched })),
                groundResolutions: window.__townMaterialScene.grounds.map(({ plane }) => plane.material.map.image.width),
                surfaceKinds: [...new Set(window.__townMaterialScene.structures.flatMap(model =>
                    model.children.map(child => child.material?.userData?.worldSurfaceDetail).filter(Boolean)))].sort(),
                calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
                textures: renderer.info.memory.textures
            };
        });
        expect(metrics.structures).toHaveLength(3);
        expect(metrics.structures.every(model => model.batched)).toBe(true);
        expect(metrics.groundResolutions).toEqual(quality === 'high' ? [256, 256] : [128, 128]);
        expect(metrics.surfaceKinds).toEqual(['slate', 'stone', 'timber']);
        expect(metrics.triangles).toBeGreaterThan(0);
        await testInfo.attach(`${quality}-scene-metrics`, { body: JSON.stringify(metrics), contentType: 'application/json' });
        console.log(`Lanternhold scene: ${JSON.stringify({ quality, ...metrics })}`);
        await page.screenshot({ path: testInfo.outputPath(`lanternhold-${quality}.png`) });
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
