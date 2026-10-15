import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';

for (const quality of ['high', 'low']) test(`complete garment fits and restores all supplied classes ${quality}`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: quality === 'low' ? 390 : 1280, height: 900 });
    await page.exposeFunction('captureGarmentHUD', async name => { await page.screenshot({ path: testInfo.outputPath(`${name}-hud.png`) }); });
    await page.goto('/', { waitUntil: 'networkidle' });
    const observation = await page.evaluate(async quality => {
        const THREE = await import('three');
        const { GameEngine } = await import('/src/core/GameEngine.js');
        const { BASE_ITEMS } = await import('/src/core/ItemSystem.js');
        const { waitForGeometryOwner } = await import('/tests/e2e/geometry-owner-observation.js');
        document.getElementById('start-screen').style.display = 'none';
        const game = new GameEngine('Fighter', quality === 'low', true, '', 'garment-review');
        const render = game.renderSystem;
        render.setGraphicsQuality(quality); game.worldGenerator.graphicsQuality = quality;
        await render.preloadEnvironment(); await game.worldGenerator.loadTrees(0, 200); await game.worldGenerator.loadBuildings(0, 200);
        const outfits = {
            Fighter: ['Iron Helm', 'Plate Mail', 'Plate Greaves', 'Iron Boots', 'Iron Gauntlets', 'Steel Pauldrons', 'Plated Girdle', 'Iron Sword', 'Wooden Shield'],
            Rogue: ['Leather Cap', 'Leather Tunic', 'Leather Pants', 'Leather Boots', 'Leather Gloves', 'Reinforced Spaulders', 'Studded Belt', 'Steel Dagger', 'Iron Sword'],
            Wizard: ['Silk Hood', 'Robes', 'Silk Skirt', 'Sandals', 'Silk Gloves', 'Velvet Mantle', 'Silk Sash', 'Wooden Staff', 'Spell Tome'],
            Cleric: ['Iron Helm', 'Robes', 'Leather Pants', 'Iron Boots', 'Silk Gloves', 'Steel Pauldrons', 'Studded Belt', 'Cleric Mace', 'Wooden Shield']
        };
        const slots = ['head', 'chest', 'legs', 'feet', 'gloves', 'shoulders', 'belt', 'mainHand', 'offHand', 'ring1', 'ring2', 'neck', 'trinket1', 'trinket2'];
        const actors = [], images = [], poses = [], cycles = [], frames = [];
        const look = { baseName: 'Iron Oath Regalia', rarity: 'Common', slot: 'outfit' };
        const handLooks = {
            Fighter: ['Grovekeeper Blade', 'Grovekeeper Shield'], Rogue: ['Skyweaver Dagger', 'Grovekeeper Blade'],
            Wizard: ['Hearthkeeper Staff', 'Skyweaver Tome'], Cleric: ['Tidekeeper Mace', 'Hearthkeeper Shield']
        };
        for (const [i, type] of Object.keys(outfits).entries()) {
            const actor = game.createRemotePlayer('Player', `garment-${type}`, type); actor.gameEngine = game; await actor.ensureMesh();
            const gear = Object.fromEntries([...outfits[type], 'Ruby Ring', 'Silver Ring', 'Necklace', 'Amulet of Power', 'Orb of Mana'].map((name, index) => {
                const base = BASE_ITEMS.find(item => item.name === name); if (!base) throw Error(name);
                return [slots[index], { ...base, id: `${type}-${slots[index]}`, baseName: name, rarity: 'Rare', potency: 5 }];
            }));
            actor.appearances = { mainHand: { baseName: handLooks[type][0], rarity: 'Common', slot: 'mainHand' },
                offHand: { baseName: handLooks[type][1], rarity: 'Common', slot: type === 'Rogue' ? 'mainHand' : 'offHand' } };
            actor.syncEquipmentVisuals(gear); await actor.mesh.userData.equipmentReady;
            if (actor.mesh.userData.equipmentVisualItemCount !== 14) throw Error(`Incomplete original ${type}`);
            actor.position.set((i - 1.5) * 2.5, 0, 198); actor.mesh.position.copy(actor.position); render.add(actor.mesh);
            actors.push({ actor, type, saved: JSON.stringify(gear), appearances: { ...actor.appearances } });
        }
        game.player = actors[0].actor; game.uiManager.showHUD(); game.uiManager.updatePlayerStats(game.player);
        const focus = new THREE.Vector3(0, 0, 198); render.setZoom(18); render.setCameraTarget(focus);
        await waitForGeometryOwner(render); render.render();
        const capture = async name => {
            render.render(); images.push({ name, data: render.renderer.domElement.toDataURL('image/png') });
            frames.push({ name, calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles });
            if (name === 'party-Run' || name === 'close-Fighter') await window.captureGarmentHUD(name);
        };
        await capture('original-party');
        const apply = async enabled => {
            for (const { actor, appearances, saved } of actors) {
                actor.appearances = enabled ? { ...appearances, outfit: look } : { ...appearances };
                actor.syncEquipmentVisuals(); await actor.mesh.userData.equipmentReady;
                if (actor.mesh.userData.equipmentVisualMissing?.length || actor.mesh.userData.equipmentVisualFallback?.length) throw Error('Garment missing or fallback');
                if (JSON.stringify(actor.equipment) !== saved) throw Error('Garment changed combat gear');
                if (actor.mesh.userData.equipmentVisualGarment !== (enabled ? 'iron-oath-regalia-v1' : '')) throw Error('Wrong garment selection');
            }
            await waitForGeometryOwner(render); render.render();
        };
        await apply(true);
        for (const state of ['CombatIdle', 'Run', 'Attack', 'Death']) {
            for (const { actor, type } of actors) {
                actor.mixer.stopAllAction(); actor.mesh.userData.resetRestPose(); actor.currentAction = null;
                actor.playAnimation(state, !['Attack', 'Death'].includes(state), true); actor.updateAnimationMixer(.27);
                const body = actor.mesh.getObjectByName(`${type}_Body`); let samples = 0;
                actor.mesh.updateMatrixWorld(true);
                actor.mesh.traverse(mesh => {
                    if (!mesh.isSkinnedMesh || !mesh.userData.authoredEquipment) return;
                    if (!mesh.skeleton.bones.every(bone => body.skeleton.bones.includes(bone))) throw Error('Foreign garment bones');
                    for (let i = 0; i < mesh.geometry.attributes.position.count; i += Math.max(1, Math.floor(mesh.geometry.attributes.position.count / 8))) {
                        const point = mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
                        if (!point.toArray().every(Number.isFinite) || point.distanceTo(actor.position) > 8) throw Error(`Escaped ${type} garment ${state}`);
                        samples++;
                    }
                });
                poses.push({ type, state, samples, items: actor.mesh.userData.equipmentVisualItemCount, clip: actor.currentAction.getClip().name });
            }
            if (state === 'Run') for (let frame = 0; frame < 90; frame++) {
                await new Promise(requestAnimationFrame);
                for (const { actor } of actors) actor.updateAnimationMixer(1 / 60);
                render.render();
            }
            render.setZoom(18); render.setCameraTarget(focus); await capture(`party-${state}`);
        }
        for (const current of actors) {
            for (const row of actors) row.actor.mesh.visible = row === current;
            current.actor.mesh.rotation.y = Math.PI / 4; current.actor.mixer.stopAllAction(); current.actor.mesh.userData.resetRestPose(); current.actor.currentAction = null;
            current.actor.playAnimation('CombatIdle', true, true); current.actor.updateAnimationMixer(.2);
            render.setCameraTarget(current.actor.position.clone().add(new THREE.Vector3(0, 2.1, 0)));
            const aspect = innerWidth / innerHeight;
            render.camera.top = 3; render.camera.bottom = -3; render.camera.left = -3 * aspect; render.camera.right = 3 * aspect;
            render.camera.updateProjectionMatrix(); await capture(`close-${current.type}`);
        }
        for (const row of actors) { row.actor.mesh.visible = true; row.actor.mesh.rotation.y = 0; }
        render.setZoom(18); render.setCameraTarget(focus);
        for (let i = 0; i < 3; i++) {
            await apply(false); const original = { ...render.renderer.info.memory };
            await apply(true); cycles.push({ original, garment: { ...render.renderer.info.memory } });
        }
        await apply(false); await capture('restored-party');
        const result = { poses, cycles, images, frames, restoredItems: actors.map(row => row.actor.mesh.userData.equipmentVisualItemCount),
            drawCalls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles };
        game.destroy(); return result;
    }, quality);
    for (const picture of observation.images) await writeFile(testInfo.outputPath(picture.name + '.png'), Buffer.from(picture.data.split(',')[1], 'base64'));
    delete observation.images;
    await writeFile(testInfo.outputPath('observation.json'), JSON.stringify({ quality, ...observation }, null, 2));
    // Static prepared party submissions use the existing art-contract budgets.
    // This is not a frame-time or sustained multiplayer qualification.
    const budget = quality === 'high' ? { calls: 350, triangles: 250000 } : { calls: 200, triangles: 85000 };
    for (const frame of observation.frames.filter(frame => frame.name.startsWith('party-'))) {
        expect(frame.calls, frame.name).toBeLessThanOrEqual(budget.calls);
        expect(frame.triangles, frame.name).toBeLessThanOrEqual(budget.triangles);
    }
    expect(observation.poses).toHaveLength(16);
    expect(observation.poses.every(pose => pose.samples > 0 && pose.items === 9)).toBe(true);
    expect(observation.restoredItems).toEqual([14, 14, 14, 14]);
    expect(observation.cycles[2]).toEqual(observation.cycles[1]);
    expect(failures, failures.join('\n')).toEqual([]);
});
