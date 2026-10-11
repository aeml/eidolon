import { expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';
import { requiresHardwareWebGL } from './browserLaunchPolicy.js';

export async function reviewEarthRockShelves({ page, baseURL }, testInfo, quality, engineURL = '/src/core/GameEngine.js', width = 1280) {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(quality => localStorage.setItem('eidolon.graphicsQuality', quality), quality);
    await page.goto(new URL('/', baseURL).href, { waitUntil: 'networkidle' });
    await page.evaluate(async ({ quality, engineURL }) => {
        const { GameEngine } = await import(engineURL);
        const THREE = await import('three');
        document.getElementById('start-screen').style.display = 'none';
        const game = new GameEngine('Fighter', false, true, '', 'rock-review-only', null, 'earth-elevation-rocks-v1');
        const render = game.renderSystem, world = game.worldGenerator;
        render.setGraphicsQuality(quality); world.graphicsQuality = quality;
        await render.preloadEnvironment(); await world.loadTrees(0, 200); await world.loadBuildings(0, 200);
        const hero = game.createRemotePlayer('Player', 'rock-equipped-fighter', 'Fighter'); hero.gameEngine = game;
        await hero.ensureMesh();
        const slots = ['head', 'chest', 'legs', 'feet', 'gloves', 'shoulders', 'belt', 'mainHand', 'offHand', 'ring1', 'ring2', 'neck', 'trinket1', 'trinket2'];
        const names = ['Iron Helm', 'Plate Mail', 'Plate Greaves', 'Iron Boots', 'Iron Gauntlets', 'Steel Pauldrons', 'Plated Girdle', 'Iron Sword', 'Wooden Shield', 'Ruby Ring', 'Silver Ring', 'Necklace', 'Amulet of Power', 'Orb of Mana'];
        hero.syncEquipmentVisuals(Object.fromEntries(names.map((name, i) => [slots[i], { id: `rock-${slots[i]}`, name, baseName: name, slot: slots[i], type: [7, 8].includes(i) ? 'WEAPON' : 'ARMOR', rarity: 'Rare', potency: 5 }])));
        await hero.mesh.userData.equipmentReady; render.add(hero.mesh); game.uiManager.showHUD();
        const field = render.instanceEnvironmentGroup.getObjectByName('Earth exposed rock shelves');
        const understory = render.instanceEnvironmentGroup.getObjectByName('Gloamwood heath and fern beds');
        const clock = Object.getOwnPropertyDescriptor(performance, 'now');
        Object.defineProperty(performance, 'now', { configurable: true, value: () => 12000 });
        render.applyLightingPreset('earth', true); hero.playAnimation('Run', true, true);
        window.__rockReview = { game, hero, field, understory, clock, rows: [], THREE };
    }, { quality, engineURL });
    try {
        for (const [label, x, z, zoom] of [['west-grove', -120, -200, 18], ['deep-west', -102, -311, 18], ['deep-east', 62, -297, 18], ['east-road', 390, 173, 18], ['road-break', 590, 270, 18], ['far-east', 690, 160, 18], ['road-detail', 590, 263, 10], ['grove-bed', -83, -334, 10], ['east-verge', 353, 216, 10]]) {
            const row = await page.evaluate(({ label, x, z, zoom }) => {
                const { game, hero, field, understory, THREE } = window.__rockReview, render = game.renderSystem;
                const focus = new THREE.Vector3(x, game.terrainElevation.sample(x, z), z);
                render.setZoom(zoom); render.setCameraTarget(focus); render.updateEnvironmentLighting(focus, 0);
                for (let frame = 0; frame < 8; frame++) {
                    hero.position.copy(focus).add(new THREE.Vector3((frame / 7 - .5) * 1.5, 0, 2));
                    hero.position.y = game.terrainElevation.sample(hero.position.x, hero.position.z);
                    hero.mesh.position.copy(hero.position); hero.updateAnimationMixer(1 / 60); render.render();
                }
                const gl = render.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
                return { label, zoom, poses: 8, formations: field.children.length,
                    triangles: render.renderer.info.render.triangles, calls: render.renderer.info.render.calls,
                    plants: understory.userData.plantCount,
                    spatialPlants: understory.children.every(part => part.isBatchedMesh),
                    plantGeometry: new Set(understory.children.map(part => part.geometry)).size,
                    plantMaterials: new Set(understory.children.map(part => part.material)).size,
                    opaquePlants: understory.children.every(part => !part.material.transparent && part.material.depthWrite),
                    rockTriangles: field.children.reduce((sum, part) => sum + part.geometry.attributes.position.count / 3, 0),
                    surfaces: field.children.map(part => part.material.userData.worldSurfaceDetail),
                    quality: hero.mesh.userData.authoredQuality, items: hero.mesh.userData.equipmentVisualItemCount,
                    fallback: hero.mesh.userData.equipmentVisualFallback.length,
                    groundError: Math.abs(hero.mesh.position.y - game.terrainElevation.sample(hero.mesh.position.x, hero.mesh.position.z)),
                    gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
            }, { label, x, z, zoom });
            await page.screenshot({ path: testInfo.outputPath(`${label}.png`) });
            await page.evaluate(row => window.__rockReview.rows.push(row), row);
        }
        const result = await page.evaluate(() => {
            const { game, hero, field, understory, clock, rows } = window.__rockReview;
            const scenery = [...field.children, ...understory.children];
            const geometry = new Set(scenery.map(part => part.geometry)), material = new Set(scenery.map(part => part.material));
            const released = { geometry: 0, material: 0 };
            for (const [set, key] of [[geometry, 'geometry'], [material, 'material']]) for (const object of set) {
                const dispose = object.dispose; object.dispose = function () { released[key]++; return dispose.call(this); };
            }
            hero.dispose(); game.renderSystem.clearInstanceScene(); game.renderSystem.clearInstanceScene();
            game.destroy();
            if (clock) Object.defineProperty(performance, 'now', clock); else delete performance.now;
            delete window.__rockReview;
            return { rows, released, expected: { geometry: geometry.size, material: material.size },
                scope: 'Prepared supplied14-slot Fighter across72sampled walking poses, production raised-world generator and actual HUD; no normal server input, frame-rate, combat, campaign or final-art approval.' };
        });
        await writeFile(testInfo.outputPath('rock-review.json'), JSON.stringify(result, null, 2));
        expect(result.released).toEqual(result.expected);
        for (const row of result.rows) {
            expect(row.formations).toBe(6); expect(row.rockTriangles).toBe(3708);
            expect(row.surfaces.every(surface => surface === 'stratified-rock')).toBe(true);
            expect(row.plants).toBe(quality === 'high' ? 13087 : 7439);
            expect(row.plantGeometry).toBe(row.spatialPlants ? (quality === 'high' ? 326 : 320) : 2);
            expect(row.plantMaterials).toBe(1); expect(row.opaquePlants).toBe(true);
            expect(row.quality).toBe(quality); expect(row.items).toBe(14); expect(row.fallback).toBe(0);
            expect(row.groundError).toBeLessThan(.001);
            expect(row.calls).toBeLessThanOrEqual(quality === 'high' ? 350 : 200);
            expect(row.triangles).toBeLessThanOrEqual(quality === 'high' ? 250000 : 85000);
            if (requiresHardwareWebGL()) expect(row.gpu).not.toMatch(/swiftshader|llvmpipe|software/i);
        }
        expect(failures, failures.join('\n')).toEqual([]);
    } finally {
        await page.evaluate(() => {
            const review = window.__rockReview; if (!review) return;
            review.hero.dispose(); review.game.destroy();
            if (review.clock) Object.defineProperty(performance, 'now', review.clock); else delete performance.now;
            delete window.__rockReview;
        });
    }
}
