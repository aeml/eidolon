import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

// Prepared frame-stepped runtime actors, not an authenticated party test.
for (const [width, height, mobile] of [[1280, 900, false], [390, 844, true]]) {
    test(`moving casts keep equipped feet striding at ${width}px`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async mobile => {
            const THREE = await import('three');
            const { RenderSystem } = await import('/src/core/RenderSystem.js');
            const { Actor } = await import('/src/entities/Actor.js');
            const factories = await import('/src/art/ProceduralHumanoid.js');
            const { UIManager } = await import('/src/ui/UIManager.js');
            document.getElementById('start-screen').style.display = 'none';
            document.body.classList.toggle('mobile-mode', mobile);
            const render = new RenderSystem(mobile), ui = new UIManager(mobile);
            render.setGraphicsQuality(mobile ? 'low' : 'high');
            await render.preloadEnvironment(); ui.showHUD(); ui.toggleChat(true);
            const actors = ['Fighter', 'Rogue', 'Wizard', 'Cleric'].map((type, i) => {
                const actor = new Actor(`review-${type}`, { STATS: { STRENGTH: 5, INTELLIGENCE: 5, DEXTERITY: 6, WISDOM: 5, STAMINA: 5 } });
                actor.meshType = type; actor.setMesh(factories[`createProcedural${type}`]({ batch: true }));
                const footwear = ['Iron Boots', 'Leather Boots', 'Sandals', 'Iron Boots'][i];
                actor.syncEquipmentVisuals({ feet: { id: `review-boots-${i}`, baseName: footwear,
                    name: footwear, type: 'ARMOR', slot: 'feet', rarity: 'Rare', level: 42 } });
                actor.position.set((i - 1.5) * 4, 0, 200);
                actor.targetPosition = actor.position.clone().add(new THREE.Vector3(100, 0, 0));
                actor.state = 'MOVING'; actor.stats.speed = 6; actor.playAnimation('Run');
                actor.update(.15, null, null, null);
                actor.playAbilityAnimation(['Guardian Roar', 'Cloak & Vanish', 'Fireball', 'Spirit Guardians'][i], { duration: 1 });
                actor.mesh.position.copy(actor.position); render.entityGroup.add(actor.mesh);
                return actor;
            });
            ui.updatePlayerStats(actors[0]);
            render.onWindowResize(); render.applyLightingPreset('town', true);
            window.__movingCastReview = { render, actors, elapsed: .15, THREE };
        }, mobile);
        const frames = [];
        for (let frame = 0; frame < 3; frame++) {
            frames.push(await page.evaluate(() => {
                const { render, actors, THREE } = window.__movingCastReview;
                for (let tick = 0; tick < 9; tick++) for (const actor of actors) actor.update(1 / 60, null, null, null);
                window.__movingCastReview.elapsed += .15;
                actors.forEach(actor => actor.mesh.position.copy(actor.position));
                render.setCameraTarget(new THREE.Vector3(window.__movingCastReview.elapsed * 6, 0, 200));
                render.render(); render.render();
                return actors.map(actor => ({ active: actor.movingCastGait.active, cast: Boolean(actor.currentAbilityAnimation),
                    thigh: actor.mesh.getObjectByName('Rig_ThighRight').rotation.x,
                    ankle: actor.mesh.getObjectByName('Equipment_FootRight').rotation.x }));
            }));
            await page.screenshot({ path: testInfo.outputPath(`moving-cast-${frame}.png`), style: '#perf-overlay { visibility: hidden !important; }' });
        }
        for (let actor = 0; actor < 4; actor++) {
            expect(frames.every(frame => frame[actor].active && frame[actor].cast)).toBe(true);
            const strides = frames.map(frame => frame[actor].thigh), ankles = frames.map(frame => frame[actor].ankle);
            expect(Math.max(...strides) - Math.min(...strides)).toBeGreaterThan(.5);
            expect(Math.max(...ankles) - Math.min(...ankles)).toBeGreaterThan(.1);
        }
        const gestures = await page.evaluate(() => {
            const { render, actors } = window.__movingCastReview;
            actors.forEach((actor, i) => {
                actor.state = 'IDLE'; actor.targetPosition = null;
                actor.playAbilityAnimation(['Iron Fortress', 'Poison Coating', 'Gravity Well', 'Blessing of Resolve'][i]);
                for (let frame = 0; frame < 25; frame++) actor.updateAnimationMixer(1 / 60);
            });
            render.render(); render.render();
            return actors.map(actor => actor.currentAnimationName);
        });
        expect(gestures).toEqual(['Guard', 'Guard', 'Channel', 'Bless']);
        await page.screenshot({ path: testInfo.outputPath('support-gestures.png'), style: '#perf-overlay { visibility: hidden !important; }' });
        for (const clipName of ['Walk', 'Run']) {
            const contacts = await page.evaluate(clipName => {
                const { render, actors, THREE } = window.__movingCastReview;
                const heights = actors.map(actor => {
                    actor.currentAbilityAnimation = null;
                    actor.movingCastGait?.restore();
                    actor.state = 'MOVING'; actor.isRunning = clipName === 'Run';
                    actor.playAnimation(clipName, true, true);
                    // Finish the crossfade, then inspect a known stance phase.
                    actor.updateAnimationMixer(.2);
                    actor.currentAction.time = actor.currentAction.getClip().duration * .25;
                    actor.updateAnimationMixer(0); actor.mesh.updateMatrixWorld(true);
                    let min = Infinity; const point = new THREE.Vector3();
                    for (const side of ['Left', 'Right']) actor.mesh.getObjectByName(`Equipment_Foot${side}`).traverseVisible(part => {
                        if (!part.isMesh) return;
                        const p = part.geometry.attributes.position;
                        for (let i = 0; i < p.count; i++) {
                            point.fromBufferAttribute(p, i).applyMatrix4(part.matrixWorld);
                            min = Math.min(min, point.y - actor.mesh.position.y);
                        }
                    });
                    return min;
                });
                render.render(); render.render(); return heights;
            }, clipName);
            for (const height of contacts) { expect(height).toBeGreaterThan(-.012); expect(height).toBeLessThan(.025); }
            await page.screenshot({ path: testInfo.outputPath(`${clipName.toLowerCase()}-stance.png`), style: '#perf-overlay { visibility: hidden !important; }' });
        }
        expect(failures).toEqual([]);
    });
}
