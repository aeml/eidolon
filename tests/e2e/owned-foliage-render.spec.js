import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';
for (const quality of ['high', 'low']) test(`owned foliage preserves views and repeated quality changes ${quality}`, async ({ page, baseURL }, testInfo) => {
    test.skip(process.env.EIDOLON_E2E_NATIVE_COVERAGE_PENDING === 'true', 'Required native predeploy foliage coverage');
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: quality === 'low' ? 390 : 1280, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const gpu = await page.evaluate(async quality => {
        const THREE = await import('three');
        const { GameEngine } = await import('/src/core/GameEngine.js');
        const { BASE_ITEMS } = await import('/src/core/ItemSystem.js');
        const { waitForGeometryOwner } = await import('/tests/e2e/geometry-owner-observation.js');
        document.getElementById('start-screen').style.display = 'none';
        const game = new GameEngine('Fighter', quality === 'low', true, '', 'activation-review');
        const render = game.renderSystem;
        render.setGraphicsQuality(quality); game.worldGenerator.graphicsQuality = quality;
        await render.preloadEnvironment(); await game.worldGenerator.loadTrees(0, 200);
        await game.worldGenerator.loadBuildings(0, 200);
        const outfits = {
            Fighter: ['Iron Helm', 'Plate Mail', 'Plate Greaves', 'Iron Boots', 'Iron Gauntlets', 'Steel Pauldrons', 'Plated Girdle', 'Iron Sword', 'Wooden Shield'],
            Rogue: ['Leather Cap', 'Leather Tunic', 'Leather Pants', 'Leather Boots', 'Leather Gloves', 'Reinforced Spaulders', 'Studded Belt', 'Steel Dagger', 'Iron Sword'],
            Wizard: ['Silk Hood', 'Robes', 'Silk Skirt', 'Sandals', 'Silk Gloves', 'Velvet Mantle', 'Silk Sash', 'Wooden Staff', 'Spell Tome'],
            Cleric: ['Iron Helm', 'Robes', 'Leather Pants', 'Iron Boots', 'Silk Gloves', 'Steel Pauldrons', 'Studded Belt', 'Cleric Mace', 'Wooden Shield']
        };
        const slots = ['head', 'chest', 'legs', 'feet', 'gloves', 'shoulders', 'belt', 'mainHand', 'offHand', 'ring1', 'ring2', 'neck', 'trinket1', 'trinket2'];
        const actors = [], outfitsObserved = [], mixers = [];
        for (const [index, type] of Object.keys(outfits).entries()) {
            const actor = game.createRemotePlayer('Player', `activation-${type}`, type); actor.gameEngine = game;
            await actor.ensureMesh();
            const equipment = Object.fromEntries([...outfits[type], 'Ruby Ring', 'Silver Ring', 'Necklace', 'Amulet of Power', 'Orb of Mana'].map((name, i) => {
                const base = BASE_ITEMS.find(item => item.name === name); if (!base) throw Error(name);
                return [slots[i], { ...base, id: `${type}-${slots[i]}`, baseName: name, rarity: 'Rare', potency: 5 }];
            }));
            actor.syncEquipmentVisuals(equipment); await actor.mesh.userData.equipmentReady;
            const items = actor.mesh.userData.equipmentVisualItemCount;
            if (items !== 14) throw Error(`${type} incomplete outfit: ${items}`);
            outfitsObserved.push({ type, items });
            actor.position.set(390 + index * 3, 0, 173); actor.mesh.position.copy(actor.position);
            render.add(actor.mesh); actor.playAnimation('Run', true, true); actors.push(actor);
        }
        game.player = actors[0]; game.uiManager.showHUD(); game.uiManager.updatePlayerStats(game.player);
        for (let index = 0; index < 16; index++) {
            const actor = game.createRemotePlayer('Enemy', `activation-enemy-${index}`, 'Skeleton');
            await actor.ensureMesh(); actor.position.set(390 + (index % 4 - 1.5) * 7, 0, 173 + (Math.floor(index / 4) - 1.5) * 7);
            actor.mesh.position.copy(actor.position); render.add(actor.mesh);
            const mixer = new THREE.AnimationMixer(actor.mesh);
            mixer.clipAction(actor.mesh.userData.animations.find(clip => clip.name === 'Walk')).play(); mixers.push(mixer);
        }
        const focus = new THREE.Vector3(390, 0, 173);
        render.setZoom(18); render.setCameraTarget(focus); render.updateEnvironmentLighting(focus, 0);
        await waitForGeometryOwner(render);
        for (let i = 0; i < 60; i++) {
            await new Promise(requestAnimationFrame);
            actors.forEach(actor => actor.updateAnimationMixer(1 / 60)); mixers.forEach(mixer => mixer.update(1 / 60)); render.render();
        }
        window.__cpuReview = { game, render, actors, mixers, outfitsObserved };
        const gl = render.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
        return gl.getParameter(debug.UNMASKED_RENDERER_WEBGL);
    }, quality);
    const multiDraw = await page.evaluate(() => window.__cpuReview.render.renderer.extensions.has('WEBGL_multi_draw'));
    if (process.env.EIDOLON_E2E_REQUIRE_NATIVE_GPU === '1') {
        expect(gpu).not.toMatch(/software|swiftshader|llvmpipe/i); expect(multiDraw).toBe(true);
    }
    test.skip(!multiDraw, 'Native multi-draw unavailable; ordinary cell ownership has separate CPU coverage');
    const observation = await page.evaluate(async () => {
        const { getOwnedFoliageDraws } = await import('/src/art/OwnedFoliageDraws.js');
        const { updateFoliageRenderQuality } = await import('/src/art/FoliageRenderBatches.js');
        const THREE = await import('three');
        const { game, render, actors, mixers, outfitsObserved } = window.__cpuReview;
        const groups = [];
        render.scene.traverse(root => { if (root.userData.proceduralFoliage) groups.push(root); });
        const originals = groups.map(group => {
            const owner = getOwnedFoliageDraws(group);
            if (!owner) throw Error('Native GameEngine did not construct owned foliage draws');
            return { source: owner.source, parent: group.parent, owner };
        });
        const sources = originals.map(record => record.source);
        const select = candidate => {
            for (const { source, parent, owner } of originals) {
                source.removeFromParent(); owner.group.removeFromParent(); parent.add(candidate ? owner.group : source);
            }
        };
        const canvas = render.renderer.domElement, copy = document.createElement('canvas');
        copy.width = canvas.width; copy.height = canvas.height;
        const ctx = copy.getContext('2d', { willReadFrequently: true });
        const capture = candidate => {
            select(candidate); render.render(); ctx.drawImage(canvas, 0, 0);
            return { pixels: ctx.getImageData(0, 0, copy.width, copy.height).data,
                calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles };
        };
        const differences = (a, b) => { let count = 0; for (let i = 0; i < a.length; i += 4)
            if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) count++; return count; };
        const pairs = [], now = performance.now.bind(performance), clock = Object.getOwnPropertyDescriptor(performance, 'now');
        const views = [[390, 173], [405, 185], [373, 163], ...sources.filter(s => s.userData.region !== 'earth').map(s => {
            const p = s.userData.placements[Math.floor(s.userData.placements.length / 2)]; return [p.x, p.z];
        })];
        for (const [x, z] of views) {
            render.setCameraTarget(new THREE.Vector3(x, 0, z));
            render.updateEnvironmentLighting(new THREE.Vector3(x, 0, z), 0);
            for (let i = 0; i < 3; i++) render.render();
            const frozen = now(); Object.defineProperty(performance, 'now', { configurable: true, value: () => frozen });
            capture(false); capture(true);
            const before = capture(false), after = capture(true), again = capture(false);
            if (clock) Object.defineProperty(performance, 'now', clock); else delete performance.now;
            pairs.push({ x, z, changed: differences(before.pixels, after.pixels), unstable: differences(before.pixels, again.pixels),
                before: { calls: before.calls, triangles: before.triangles }, after: { calls: after.calls, triangles: after.triangles } });
        }
        render.setCameraTarget(new THREE.Vector3(373, 0, 163)); render.updateEnvironmentLighting(new THREE.Vector3(373, 0, 163), 0);
        for (const delta of [.1, .3, .6]) {
            actors.forEach(actor => actor.updateAnimationMixer(delta)); mixers.forEach(mixer => mixer.update(delta));
            const frozen = now(); Object.defineProperty(performance, 'now', { configurable: true, value: () => frozen });
            capture(false); capture(true);
            const before = capture(false), after = capture(true), again = capture(false);
            if (clock) Object.defineProperty(performance, 'now', clock); else delete performance.now;
            pairs.push({ pose: delta, changed: differences(before.pixels, after.pixels), unstable: differences(before.pixels, again.pixels),
                before: { calls: before.calls, triangles: before.triangles }, after: { calls: after.calls, triangles: after.triangles } });
        }
        const qualityCycles = [];
        for (const quality of ['low', 'high', 'low', 'high']) {
            const qualityStarted = now();
            for (const record of originals) {
                updateFoliageRenderQuality(record.owner.group, quality);
                record.owner = getOwnedFoliageDraws(record.owner.group);
            }
            render.setGraphicsQuality(quality);
            const qualityMS = now() - qualityStarted;
            const frozen = now(); Object.defineProperty(performance, 'now', { configurable: true, value: () => frozen });
            capture(false); capture(true);
            const before = capture(false), after = capture(true), again = capture(false);
            if (clock) Object.defineProperty(performance, 'now', clock); else delete performance.now;
            qualityCycles.push({ quality, qualityMS, changed: differences(before.pixels, after.pixels), unstable: differences(before.pixels, again.pixels),
                beforeTriangles: before.triangles, afterTriangles: after.triangles, memory: { ...render.renderer.info.memory } });
        }
        select(false); render.render();
        const beforeMemory = { ...render.renderer.info.memory };
        for (const { owner } of originals) owner.dispose();
        render.render(); const afterMemory = { ...render.renderer.info.memory };
        render.clearGroupChildren(render.instanceEnvironmentGroup, { dispose: true }); render.render();
        const retired = { ...render.renderer.info.memory }, lifecycle = [];
        for (let cycle = 0; cycle < 3; cycle++) {
            game.worldGenerator.graphicsQuality = render.graphicsQuality;
            await game.worldGenerator.loadTrees(0, 200); render.render(); render.render();
            const roots = render.instanceEnvironmentGroup.children.filter(root => root.userData.proceduralFoliage);
            const active = { roots: roots.length, owned: roots.filter(root => getOwnedFoliageDraws(root)).length,
                batches: roots.reduce((sum, root) => sum + root.children.length, 0), memory: { ...render.renderer.info.memory } };
            render.clearGroupChildren(render.instanceEnvironmentGroup, { dispose: true }); render.render();
            lifecycle.push({ active, retired: { ...render.renderer.info.memory }, remainingRoots: render.foliageShadowInfluence.roots.size });
        }
        const summary = { sources: sources.length, sourceCells: sources.reduce((sum, s) => sum + s.children.length, 0),
            outfits: outfitsObserved, pairs, qualityCycles, beforeMemory, afterMemory, retired, lifecycle, pending: render.actorGameplayGeometry.delivery.jobs.size };
        game.destroy(); return summary;
    });
    await writeFile(testInfo.outputPath('observation.json'), JSON.stringify({ quality, gpu, ...observation }, null, 2));
    expect(observation.sources).toBeGreaterThan(0);
    expect(observation.pending).toBe(0);
    expect(observation.outfits.map(r => r.items)).toEqual([14, 14, 14, 14]);
    for (const pair of observation.pairs) {
        expect(pair.unstable).toBe(0); expect(pair.changed).toBe(0);
        expect(pair.after.triangles).toBe(pair.before.triangles);
        expect(pair.after.calls).toBeLessThanOrEqual(pair.before.calls);
    }
    expect(observation.pairs.slice(0, 3).every(pair => pair.after.calls < pair.before.calls)).toBe(true);
    for (const cycle of observation.qualityCycles) {
        expect(cycle.unstable).toBe(0); expect(cycle.changed).toBe(0); expect(cycle.afterTriangles).toBe(cycle.beforeTriangles);
    }
    expect(observation.qualityCycles[2].memory).toEqual(observation.qualityCycles[0].memory);
    expect(observation.qualityCycles[3].memory).toEqual(observation.qualityCycles[1].memory);
    for (const cycle of observation.lifecycle) {
        expect(cycle.active.roots).toBe(9); expect(cycle.active.owned).toBe(9);
        expect(cycle.active.batches).toBeLessThan(40); expect(cycle.remainingRoots).toBe(0);
        expect(cycle.retired).toEqual(observation.retired);
        expect(cycle.active.memory).toEqual(observation.lifecycle[0].active.memory);
    }
    expect(failures).toEqual([]);
});
