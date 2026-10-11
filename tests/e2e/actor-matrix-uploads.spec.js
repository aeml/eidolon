import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';
import { requiresHardwareWebGL } from './browserLaunchPolicy.js';

for (const quality of ['high', 'low']) test(`${quality}: unchanged actor matrix uploads preserve populated moving views`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: 1280, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const result = await page.evaluate(async quality => {
        const THREE = await import('three');
        const { GameEngine } = await import('/src/core/GameEngine.js');
        const { BASE_ITEMS } = await import('/src/core/ItemSystem.js');
        document.getElementById('start-screen').style.display = 'none';
        const game = new GameEngine('Fighter', false, true, '', 'matrix-review-only', null, 'flat-v1');
        const render = game.renderSystem, owner = render.actorInstances.multiDraw;
        render.setGraphicsQuality(quality); game.worldGenerator.graphicsQuality = quality;
        await render.preloadEnvironment(); await game.worldGenerator.loadTrees(0, 200);
        await game.worldGenerator.loadBuildings(0, 200); game.uiManager.showHUD();
        const updateMatrixAt = owner.updateMatrixAt;
        const unconditional = function (mesh, index, matrix) { mesh.setMatrixAt(index, matrix); };
        const actors = [], mixers = [];
        const outfits = {
            Fighter: ['Iron Helm', 'Plate Mail', 'Plate Greaves', 'Iron Boots', 'Iron Gauntlets', 'Steel Pauldrons', 'Plated Girdle', 'Iron Sword', 'Wooden Shield'],
            Rogue: ['Leather Cap', 'Leather Tunic', 'Leather Pants', 'Leather Boots', 'Leather Gloves', 'Reinforced Spaulders', 'Studded Belt', 'Steel Dagger', 'Iron Sword'],
            Wizard: ['Silk Hood', 'Robes', 'Silk Skirt', 'Sandals', 'Silk Gloves', 'Velvet Mantle', 'Silk Sash', 'Wooden Staff', 'Spell Tome'],
            Cleric: ['Iron Helm', 'Robes', 'Leather Pants', 'Iron Boots', 'Silk Gloves', 'Steel Pauldrons', 'Studded Belt', 'Cleric Mace', 'Wooden Shield']
        };
        const slots = ['head', 'chest', 'legs', 'feet', 'gloves', 'shoulders', 'belt', 'mainHand', 'offHand', 'ring1', 'ring2', 'neck', 'trinket1', 'trinket2'];
        for (const [index, type] of ['Fighter', 'Rogue', 'Cleric', 'Wizard'].entries()) {
            const actor = game.createRemotePlayer('Player', `matrix-class-${type}`, type);
            await actor.ensureMesh(); actor.gameEngine = game;
            const equipment = Object.fromEntries([...outfits[type], 'Ruby Ring', 'Silver Ring', 'Necklace', 'Amulet of Power', 'Orb of Mana'].map((name, i) => {
                const slot = slots[i];
                const base = BASE_ITEMS.find(item => item.name === name);
                return [slot, { ...base, slot: i === 8 && type === 'Rogue' ? 'mainHand' : slot, id: `matrix-${type}-${slot}`, baseName: name, name,
                    rarity: 'Rare', potency: 0, stats: {}, gems: [], sockets: 0 }];
            }));
            // Class restrictions still use the normal equipment pipeline.
            actor.syncEquipmentVisuals(equipment); await actor.mesh.userData.equipmentReady;
            actor.position.set(390 + index * 3, 0, 173); actor.mesh.position.copy(actor.position);
            render.add(actor.mesh); actors.push(actor);
        }
        for (let index = 0; index < 16; index++) {
            const actor = game.createRemotePlayer('Enemy', `matrix-enemy-${index}`, 'Skeleton');
            await actor.ensureMesh(); actor.position.set(390 + (index % 4 - 1.5) * 7, 0, 173 + (Math.floor(index / 4) - 1.5) * 7);
            actor.mesh.position.copy(actor.position); render.add(actor.mesh); actors.push(actor);
            const mixer = new THREE.AnimationMixer(actor.mesh);
            mixer.clipAction(actor.mesh.userData.animations.find(clip => clip.name === 'Walk')).play();
            mixers.push(mixer);
        }
        const focus = new THREE.Vector3(390, 0, 173);
        render.setZoom(18); render.setCameraTarget(focus); render.applyLightingPreset('earth', true);
        render.updateEnvironmentLighting(focus, 0);
        const canvas = render.renderer.domElement, copy = document.createElement('canvas');
        copy.width = canvas.width; copy.height = canvas.height;
        const context = copy.getContext('2d', { willReadFrequently: true });
        const select = reuse => { owner.updateMatrixAt = reuse ? updateMatrixAt : unconditional; };
        const draw = reuse => { select(reuse); render.render(); };
        const restored = () => !owner.hidden.length && !owner.group.visible &&
            !render.actorInstances.hidden.length && !render.actorInstances.group.visible;
        const capture = reuse => {
            draw(reuse); context.drawImage(canvas, 0, 0);
            return { calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles,
                pixels: context.getImageData(0, 0, copy.width, copy.height).data, restored: restored() };
        };
        const controls = [], blocks = [];
        const realNow = performance.now.bind(performance), clock = Object.getOwnPropertyDescriptor(performance, 'now');
        try {
            for (const pose of [0, .21, .63]) {
                mixers.forEach((mixer, index) => mixer.setTime(pose + index * .037));
                for (const actor of actors.slice(0, 4)) { actor.playAnimation('Walk', true, true); actor.updateAnimationMixer(pose); }
                const frozenTime = realNow();
                try {
                    Object.defineProperty(performance, 'now', { configurable: true, value: () => frozenTime });
                    draw(false); draw(true); draw(false);
                    const before = capture(false), after = capture(true), again = capture(false);
                    let changed = 0, unstable = 0;
                    for (let index = 0; index < before.pixels.length; index++) {
                        changed += before.pixels[index] !== after.pixels[index] ? 1 : 0;
                        unstable += before.pixels[index] !== again.pixels[index] ? 1 : 0;
                    }
                    controls.push({ pose, changed, unstable, beforeCalls: before.calls, afterCalls: after.calls,
                        beforeTriangles: before.triangles, afterTriangles: after.triangles,
                        restored: before.restored && after.restored && again.restored });
                } finally {
                    if (clock) Object.defineProperty(performance, 'now', clock); else delete performance.now;
                }
            }
            for (const motion of ['frozen', 'idle', 'walk']) {
                const clip = motion === 'walk' ? 'Walk' : 'Idle';
                mixers.forEach(mixer => {
                    mixer.stopAllAction();
                    mixer.clipAction(mixer.getRoot().userData.animations.find(animation => animation.name === clip)).play();
                });
                actors.slice(0, 4).forEach(actor => actor.playAnimation(clip, true, true));
                for (const reuse of [false, true, true, false]) {
                const cpu = [], intervals = [], updates = []; let previous;
                draw(reuse); draw(reuse);
                for (let frame = 0; frame < 40; frame++) {
                    await new Promise(resolve => requestAnimationFrame(time => {
                        if (motion !== 'frozen') {
                            mixers.forEach(mixer => mixer.update(1 / 60));
                            actors.slice(0, 4).forEach(actor => actor.updateAnimationMixer(1 / 60));
                        }
                        const versions = new Map([...owner.entries.values()].map(entry => [entry.mesh._matricesTexture, entry.mesh._matricesTexture.version]));
                        const start = realNow(); draw(reuse); cpu.push(realNow() - start);
                        updates.push([...versions].filter(([texture, version]) => texture.version !== version).length);
                        if (previous !== undefined) intervals.push(time - previous); previous = time; resolve();
                    }));
                }
                blocks.push({ motion, reuse, cpu, intervals, matrixTexturesDirtied: updates, restored: restored() });
                }
            }
            const gl = render.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
            const beforeMemory = { ...render.renderer.info.memory };
            const groups = owner.entries.size;
            const deliveredOutfits = actors.slice(0, 4).map(actor => ({ class: actor.mesh.userData.authoredClass,
                items: actor.mesh.userData.equipmentVisualItemCount, fallback: actor.mesh.userData.equipmentVisualFallback.length }));
            draw(true); const referencePNG = canvas.toDataURL('image/png');
            owner.updateMatrixAt = updateMatrixAt;
            mixers.forEach(mixer => { mixer.stopAllAction(); mixer.uncacheRoot(mixer.getRoot()); });
            actors.forEach(actor => actor.dispose()); render.setActorInstancesEnabled(false); render.render();
            const retiredMemory = { ...render.renderer.info.memory };
            return { quality, controls, blocks, groups, outfits: deliveredOutfits, beforeMemory, retiredMemory, referencePNG,
                gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
        } finally { owner.updateMatrixAt = updateMatrixAt; game.destroy(); }
    }, quality);
    const { referencePNG, ...report } = result;
    await writeFile(testInfo.outputPath('actor-matrix-uploads.json'), JSON.stringify(report, null, 2));
    await writeFile(testInfo.outputPath('populated-matrix-view.png'), Buffer.from(referencePNG.split(',')[1], 'base64'));
    expect(report.groups).toBeGreaterThan(0);
    if (requiresHardwareWebGL()) expect(report.gpu).not.toMatch(/swiftshader|llvmpipe|software/i);
    expect(report.outfits.map(outfit => outfit.class).sort()).toEqual(['Cleric', 'Fighter', 'Rogue', 'Wizard']);
    expect(report.outfits.every(outfit => outfit.items === 14 && outfit.fallback === 0)).toBe(true);
    for (const row of report.controls) {
        expect(row.changed).toBe(0); expect(row.unstable).toBe(0); expect(row.restored).toBe(true);
        expect(row.afterCalls).toBe(row.beforeCalls); expect(row.afterTriangles).toBe(row.beforeTriangles);
    }
    for (const block of report.blocks) {
        expect(block.restored).toBe(true);
        if (block.motion === 'frozen' && block.reuse) expect(block.matrixTexturesDirtied.every(count => count === 0)).toBe(true);
        if (!block.reuse) expect(block.matrixTexturesDirtied.every(count => count === report.groups)).toBe(true);
    }
    expect(report.retiredMemory.textures).toBeLessThan(report.beforeMemory.textures);
    expect(failures, failures.join('\n')).toEqual([]);
});
