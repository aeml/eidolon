import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

for (const [quality, width] of [['high', 1280], ['low', 390]]) {
    test(`Earth soil response beside equipped Fighter and raised scenery: ${quality}`, async ({ page, baseURL }, testInfo) => {
        test.skip(process.env.EIDOLON_E2E_EARTH_SOIL_COMPARE !== '1', 'Explicit private predecessor art comparison; retained native execution is the evidence');
        const previous = execFileSync('git', ['show', '8e6cdb8f:src/art/EarthGroundComposition.js'], { encoding: 'utf8' });
        const terrain = execFileSync('git', ['show', '8e6cdb8f:src/art/ProceduralRealmTerrain.js'], { encoding: 'utf8' })
            .replace("'./EarthGroundComposition.js'", "'./EarthGroundCompositionReference.js'");
        await page.route('**/src/art/EarthGroundCompositionReference.js', route => route.fulfill({ body: previous, contentType: 'text/javascript' }));
        await page.route('**/src/art/ProceduralRealmTerrainReference.js', route => route.fulfill({ body: terrain, contentType: 'text/javascript' }));
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        const failures = collectBrowserFailures(page, baseURL);
        await page.setViewportSize({ width, height: 844 }); await page.goto('/', { waitUntil: 'networkidle' });
        const result = await page.evaluate(async quality => {
            const THREE = await import('three');
            const { RenderSystem } = await import('/src/core/RenderSystem.js');
            const { WorldGenerator } = await import('/src/world/WorldGenerator.js');
            const { CollisionManager } = await import('/src/core/CollisionManager.js');
            const { MeshFactory } = await import('/src/utils/MeshFactory.js');
            const { Actor } = await import('/src/entities/Actor.js');
            const { EARTH_ELEVATION: field } = await import('/src/data/worldElevation.js');
            const { EARTH_OUTCROP_PROFILE } = await import('/src/data/earthOutcrops.js');
            const { createRealmGroundMesh } = await import('/src/art/RealmGroundMesh.js');
            const { WORLD_REGIONS } = await import('/src/data/worldGeography.js');
            const { createProceduralTerrainMaterial: referenceMaterial } = await import('/src/art/ProceduralRealmTerrainReference.js');
            document.getElementById('start-screen').style.display = 'none';
            const render = new RenderSystem(false); render.setGraphicsQuality(quality); await render.preloadEnvironment(); render.waterTexture = null;
            const oldGround = render.groundEarth;
            render.groundEarth = createRealmGroundMesh(WORLD_REGIONS.earth, oldGround.material, field);
            render.groundEarth.position.copy(oldGround.position); render.groundEarth.quaternion.copy(oldGround.quaternion);
            oldGround.parent.add(render.groundEarth); oldGround.removeFromParent(); oldGround.geometry.dispose();
            const current = oldGround.material, previous = referenceMaterial('earth', { quality });
            const world = new WorldGenerator(render.instanceEnvironmentGroup, new CollisionManager(), { graphicsQuality: quality,
                terrainElevation: field, terrainProfile: EARTH_OUTCROP_PROFILE, understorySpatialBatches: render.renderer.extensions.has('WEBGL_multi_draw') });
            await world.loadTrees(0, 200); await world.loadBuildings(0, 200);
            const materials = new Set();
            render.instanceEnvironmentGroup.traverse(mesh => {
                if (!mesh.material?.userData.woodlandWind || materials.has(mesh.material)) return;
                const material = mesh.material; materials.add(material); const compile = material.onBeforeCompile, update = material.onBeforeRender; let uniforms;
                material.onBeforeCompile = shader => { compile(shader); uniforms = shader.uniforms; };
                material.onBeforeRender = () => { update(); if (uniforms) uniforms.woodlandTime.value = 12.5; };
            });
            const root = await MeshFactory.createMeshForType('Fighter', { quality });
            if (root.userData.authoredClass !== 'Fighter') throw new Error('Supplied Fighter missing');
            const actor = new Actor('soil-visual-review', {}); actor.meshType = 'Fighter'; actor.setMesh(root); render.entityGroup.add(root);
            const slots = ['head', 'chest', 'legs', 'feet', 'gloves', 'shoulders', 'belt', 'mainHand', 'offHand', 'neck', 'ring1', 'ring2', 'trinket1', 'trinket2'];
            const names = ['Iron Helm', 'Plate Mail', 'Plate Greaves', 'Iron Boots', 'Iron Gauntlets', 'Steel Pauldrons', 'Plated Girdle', 'Iron Sword', 'Wooden Shield', 'Necklace', 'Ruby Ring', 'Silver Ring', 'Amulet of Power', 'Orb of Mana'];
            actor.syncEquipmentVisuals(Object.fromEntries(names.map((name, i) => [slots[i], { id: slots[i], name, baseName: name, slot: slots[i], rarity: 'Rare', type: name === 'Iron Sword' ? 'WEAPON' : 'ARMOR' }])));
            await root.userData.equipmentReady;
            if (root.userData.equipmentVisualItemCount !== 14 || root.userData.equipmentVisualFallback?.length) throw new Error('Full fitted outfit missing');
            const copy = document.createElement('canvas'); copy.width = render.renderer.domElement.width; copy.height = render.renderer.domElement.height;
            const context = copy.getContext('2d', { willReadFrequently: true });
            const reports = [], images = [];
            const delta = (a, b) => { let changed = 0, maximum = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { changed++; maximum = Math.max(maximum, Math.abs(a[i] - b[i])); } return { changed, maximum }; };
            const capture = mode => {
                // Raised ground is a tiled Group. Change every actual receiver
                // material, rather than writing an unused property on its root.
                render.groundEarth.traverse(tile => { if (tile.isMesh) tile.material = mode === 'previous' ? previous : current; });
                render.render(); context.drawImage(render.renderer.domElement, 0, 0);
                return { pixels: context.getImageData(0, 0, copy.width, copy.height).data, png: copy.toDataURL('image/png'),
                    calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles,
                    geometries: render.renderer.info.memory.geometries, textures: render.renderer.info.memory.textures };
            };
            const memory = () => ({ ...render.renderer.info.memory });
            try {
                for (const [label, x, z, state, time, zoom] of [['gate-run', 140, 190, 'Run', .3, 18], ['road-attack', 470, 200, 'Attack', 14 / 30, 18],
                    ['woodland-idle', -33, -235, 'CombatIdle', .3, 18], ['road-detail', 470, 200, 'CombatIdle', .3, 10]]) {
                    const focus = new THREE.Vector3(x, field.sample(x, z), z); root.position.copy(focus); root.rotation.y = .7;
                    actor.mixer.stopAllAction(); root.userData.resetRestPose(); actor.currentAction = null; actor.playAnimation(state, true, true); actor.updateAnimationMixer(time);
                    render.setZoom(zoom); render.setCameraTarget(focus); render.applyLightingPreset('earth', true); render.updateShadowFocus(focus);
                    capture('previous'); capture('candidate'); const before = capture('previous'), repeat = capture('previous'), after = capture('candidate');
                    const { pixels: oldPixels, png: oldPNG, ...oldStats } = before, { pixels: newPixels, png: newPNG, ...newStats } = after;
                    reports.push({ label, baselineRepeat: delta(oldPixels, repeat.pixels), candidate: delta(oldPixels, newPixels), previous: oldStats, current: newStats });
                    images.push({ name: `${label}-previous.png`, png: oldPNG }, { name: `${label}-candidate.png`, png: newPNG });
                }
                const warm = memory();
                for (const mode of ['previous', 'candidate', 'previous', 'candidate']) capture(mode);
                const gl = render.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
                return { quality, renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), reports, images, warm, afterRepeat: memory(),
                    scope: 'Production raised scene, supplied14-slot Fighter and fixed sampled poses, gameplay zoom18/detail10. Same geometry/shadows/camera/maps; wind shader uniform held only for comparison. No actual connected combat/HUD/whole-game/device budget acceptance.' };
            } finally {
                render.groundEarth.traverse(tile => { if (tile.isMesh) tile.material = current; });
                previous.map.dispose(); previous.dispose(); actor.dispose(); render.dispose();
            }
        }, quality);
        for (const capture of result.images) await writeFile(testInfo.outputPath(capture.name), Buffer.from(capture.png.split(',')[1], 'base64'));
        delete result.images;
        const path = testInfo.outputPath('comparison.json'); await writeFile(path, JSON.stringify(result, null, 2));
        await testInfo.attach('Earth soil comparison', { path, contentType: 'application/json' });
        expect(result.renderer).not.toMatch(/SwiftShader|llvmpipe/i);
        for (const report of result.reports) {
            expect(report.baselineRepeat.changed).toBe(0); expect(report.baselineRepeat.maximum).toBe(0);
            expect(report.candidate.changed).toBeGreaterThan(0);
            expect(report.current).toEqual(report.previous);
        }
        expect(result.afterRepeat).toEqual(result.warm);
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
