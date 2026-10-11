import { expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';
import { requiresHardwareWebGL } from './browserLaunchPolicy.js';

export async function reviewEarthRockShelves({ page, baseURL }, testInfo, quality, engineURL = '/src/core/GameEngine.js', width = 1280, viewRange = [0, 9]) {
    const phone = width <= 800;
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(quality => localStorage.setItem('eidolon.graphicsQuality', quality), quality);
    await page.goto(new URL('/', baseURL).href, { waitUntil: 'networkidle' });
    await page.evaluate(async ({ quality, engineURL, phone, comparePlantGeometry }) => {
        const { GameEngine } = await import(engineURL);
        const THREE = await import('three');
        document.getElementById('start-screen').style.display = 'none';
        // Match startup's narrow-viewport policy. A desktop engine under phone
        // CSS left a clipped desktop menu and never installed touch controls.
        const game = new GameEngine('Fighter', phone, true, '', 'rock-review-only', null, 'earth-elevation-rocks-v1');
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
        const independentPlantGeometry = comparePlantGeometry && understory.children.every(mesh => mesh.isBatchedMesh)
            ? understory.children.map(mesh => mesh.geometry.clone()) : null;
        window.__rockReview = { game, hero, field, understory, clock, rows: [], comparisons: [], plantComparisons: [],
            independentPlantGeometry, THREE };
    }, { quality, engineURL, phone, comparePlantGeometry: process.env.EIDOLON_E2E_UNDERSTORY_GEOMETRY_REVIEW === '1' });
    try {
        const views = [['west-grove', -120, -200, 18], ['deep-west', -102, -311, 18], ['deep-east', 62, -297, 18], ['east-road', 390, 173, 18], ['road-break', 590, 270, 18], ['far-east', 690, 160, 18], ['road-detail', 590, 263, 10], ['grove-bed', -83, -334, 10], ['east-verge', 353, 216, 10]].slice(...viewRange);
        for (const [label, x, z, zoom] of views) {
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
                const controls = game.isMobile ? [...document.querySelectorAll('#joystick-zone, #mobile-actions .mobile-btn, #hotbar-container .hotbar-slot, #btn-mobile-menu')].map(element => {
                    const rect = element.getBoundingClientRect();
                    return { id: element.id, x: rect.x, y: rect.y, width: rect.width, height: rect.height,
                        reachable: element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)) };
                }) : [];
                return { label, zoom, poses: 8, formations: field.children.length,
                    phonePolicy: game.isMobile, mobileInput: game.inputManager.isMobile,
                    desktopMenuVisible: getComputedStyle(document.getElementById('menu-bar')).display !== 'none',
                    controls, viewport: { width: innerWidth, height: innerHeight },
                    triangles: render.renderer.info.render.triangles, calls: render.renderer.info.render.calls,
                    displayBeforeFxaa: render.composer ? render.composer.passes.indexOf(render.outputPass) < render.composer.passes.indexOf(render.fxaaPass) : null,
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
            const plantComparison = await page.evaluate(label => {
                const review = window.__rockReview, render = review.game.renderSystem;
                if (!review.independentPlantGeometry) return null;
                const meshes = review.understory.children, shared = meshes.map(mesh => mesh.geometry);
                const canvas = render.renderer.domElement, copy = document.createElement('canvas');
                copy.width = canvas.width; copy.height = canvas.height;
                const context = copy.getContext('2d', { willReadFrequently: true });
                const capture = geometries => {
                    meshes.forEach((mesh, i) => { mesh.geometry = geometries[i]; });
                    render.render(); render.render(); context.drawImage(canvas, 0, 0);
                    return { pixels: context.getImageData(0, 0, copy.width, copy.height).data,
                        calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles };
                };
                const difference = (a, b) => {
                    let changed = 0, maximum = 0;
                    for (let i = 0; i < a.length; i++) {
                        const delta = Math.abs(a[i] - b[i]);
                        if (delta) changed++; maximum = Math.max(maximum, delta);
                    }
                    return { changed, maximum };
                };
                try {
                    const before = capture(review.independentPlantGeometry), after = capture(shared);
                    const again = capture(review.independentPlantGeometry);
                    const row = { label, change: difference(before.pixels, after.pixels),
                        stability: difference(before.pixels, again.pixels),
                        before: { calls: before.calls, triangles: before.triangles },
                        after: { calls: after.calls, triangles: after.triangles } };
                    review.plantComparisons.push(row); return row;
                } finally { meshes.forEach((mesh, i) => { mesh.geometry = shared[i]; }); render.render(); }
            }, label);
            if (plantComparison) {
                expect(plantComparison.change.changed).toBe(0);
                expect(plantComparison.stability.changed).toBe(0);
                expect(plantComparison.after).toEqual(plantComparison.before);
            }
            if (quality === 'high' && ['west-grove', 'grove-bed'].includes(label)) {
                const comparison = await page.evaluate(label => {
                    const review = window.__rockReview, render = review.game.renderSystem;
                    const passes = render.composer.passes;
                    const canvas = render.renderer.domElement, copy = document.createElement('canvas');
                    copy.width = canvas.width; copy.height = canvas.height;
                    const context = copy.getContext('2d', { willReadFrequently: true });
                    const previous = [render.renderPass, render.bloomPass, render.fxaaPass, render.outputPass];
                    const capture = selected => {
                        render.composer.passes = selected; render.render(); context.drawImage(canvas, 0, 0);
                        return { pixels: context.getImageData(0, 0, copy.width, copy.height).data, png: copy.toDataURL('image/png'),
                            calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles };
                    };
                    const difference = (a, b) => {
                        let changed = 0, maximum = 0, sum = 0;
                        for (let i = 0; i < a.length; i++) {
                            const delta = Math.abs(a[i] - b[i]);
                            if (delta) changed++; maximum = Math.max(maximum, delta); sum += delta;
                        }
                        return { changed, maximum, mean: sum / a.length };
                    };
                    try {
                        capture(previous); capture(passes);
                        const before = capture(previous), after = capture(passes), repeat = capture(previous);
                        const row = { label, change: difference(before.pixels, after.pixels), stability: difference(before.pixels, repeat.pixels),
                            before: { calls: before.calls, triangles: before.triangles }, after: { calls: after.calls, triangles: after.triangles } };
                        review.comparisons.push(row);
                        return { ...row, beforePNG: before.png, afterPNG: after.png };
                    } finally { render.composer.passes = passes; render.render(); }
                }, label);
                for (const variant of ['before', 'after']) {
                    await writeFile(testInfo.outputPath(`${label}-display-fxaa-${variant}.png`), Buffer.from(comparison[`${variant}PNG`].split(',')[1], 'base64'));
                }
                expect(comparison.stability.changed).toBe(0);
                expect(comparison.change.changed).toBeGreaterThan(0);
            }
            await page.screenshot({ path: testInfo.outputPath(`${label}.png`) });
            await page.evaluate(row => window.__rockReview.rows.push(row), row);
        }
        const result = await page.evaluate(() => {
            const { game, hero, field, understory, clock, rows, comparisons, plantComparisons,
                independentPlantGeometry } = window.__rockReview;
            const scenery = [...field.children, ...understory.children];
            const geometry = new Set(scenery.map(part => part.geometry)), material = new Set(scenery.map(part => part.material));
            const released = { geometry: 0, material: 0, plantTexture: 0 };
            for (const [set, key] of [[geometry, 'geometry'], [material, 'material']]) for (const object of set) {
                const dispose = object.dispose; object.dispose = function () { released[key]++; return dispose.call(this); };
            }
            const plantTextures = new Set(understory.children.filter(mesh => mesh.isBatchedMesh)
                .flatMap(mesh => [mesh._matricesTexture, mesh._colorsTexture, mesh._indirectTexture]));
            for (const texture of plantTextures) {
                const dispose = texture.dispose;
                texture.dispose = function () { released.plantTexture++; return dispose.call(this); };
            }
            const plantGeometryBytes = [...new Set(understory.children.map(mesh => mesh.geometry))]
                .reduce((sum, geometry) => sum + Object.values(geometry.attributes)
                    .reduce((bytes, attribute) => bytes + attribute.array.byteLength, 0), 0);
            independentPlantGeometry?.forEach(geometry => geometry.dispose());
            hero.dispose(); game.renderSystem.clearInstanceScene(); game.renderSystem.clearInstanceScene();
            game.destroy();
            if (clock) Object.defineProperty(performance, 'now', clock); else delete performance.now;
            delete window.__rockReview;
            return { rows, comparisons, plantComparisons, plantGeometryBytes, released,
                expected: { geometry: geometry.size, material: material.size, plantTexture: plantTextures.size },
                scope: `Prepared supplied14-slot Fighter across${rows.length * 8}sampled walking poses in${rows.length}views, production raised-world generator and actual HUD; no normal server input, frame-rate, combat, campaign or final-art approval.` };
        });
        await writeFile(testInfo.outputPath('rock-review.json'), JSON.stringify(result, null, 2));
        expect(result.rows.map(row => row.label)).toEqual(views.map(view => view[0]));
        expect(result.rows.every(row => row.poses === 8)).toBe(true);
        expect(result.comparisons.map(row => row.label)).toEqual(quality === 'high' ? views.map(view => view[0]).filter(label => ['west-grove', 'grove-bed'].includes(label)) : []);
        expect(result.released).toEqual(result.expected);
        for (const row of result.rows) {
            expect(row.phonePolicy).toBe(phone);
            expect(Boolean(row.mobileInput)).toBe(phone);
            expect(row.desktopMenuVisible).toBe(!phone);
            if (phone) {
                expect(row.controls.map(control => control.id)).toEqual(expect.arrayContaining(['joystick-zone', 'btn-mobile-menu', 'btn-mobile-attack', 'btn-mobile-ability', 'btn-mobile-interact']));
                expect(row.controls.length).toBeGreaterThanOrEqual(7);
                for (const control of row.controls) {
                    expect(control.width).toBeGreaterThanOrEqual(44);
                    expect(control.height).toBeGreaterThanOrEqual(44);
                    expect(control.x).toBeGreaterThanOrEqual(0); expect(control.y).toBeGreaterThanOrEqual(0);
                    expect(control.x + control.width).toBeLessThanOrEqual(row.viewport.width);
                    expect(control.y + control.height).toBeLessThanOrEqual(row.viewport.height);
                    expect(control.reachable, `${row.label}: ${control.id}`).toBe(true);
                }
            }
            expect(row.displayBeforeFxaa).toBe(quality === 'high' ? true : null);
            expect(row.formations).toBe(6); expect(row.rockTriangles).toBe(3708);
            expect(row.surfaces.every(surface => surface === 'stratified-rock')).toBe(true);
            expect(row.plants).toBe(quality === 'high' ? 13087 : 7439);
            expect(row.plantGeometry).toBe(row.spatialPlants ? 1 : 2);
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
            review.independentPlantGeometry?.forEach(geometry => geometry.dispose());
            review.hero.dispose(); review.game.destroy();
            if (review.clock) Object.defineProperty(performance, 'now', review.clock); else delete performance.now;
            delete window.__rockReview;
        });
    }
}
