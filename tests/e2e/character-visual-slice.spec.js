import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

// Visual comparison for 1.18. Deliberately separate from the gem/set/potency
// stress gallery; these are ordinary leveling outfits, not balance fixtures.
for (const type of ['Fighter', 'Rogue', 'Wizard', 'Cleric']) {
    test(`${type} ordinary outfits at close-up and gameplay scale`, async ({page, baseURL}, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.setViewportSize({width: 1280, height: 800});
        await page.goto('/repro.html?gallery=1&instances=1', {waitUntil: 'networkidle'});
        await page.waitForFunction(() => window.__eidolonAnimationGallery?.ready);
        await page.locator('#gallery-actor').selectOption(type);
        await page.waitForFunction(type => window.__eidolonAnimationGallery?.ready && window.__eidolonAnimationGallery.actorType === type, type);
        await page.evaluate(() => {
            const gallery = window.__eidolonAnimationGalleryController;
            gallery.cleanupPresentation();
            const original = gallery.createGalleryEquipmentItem.bind(gallery), outfit = {};
            gallery.createGalleryEquipmentItem = (...args) => {
                const item = {...original(...args), level: 30, rarity: args[1] === 'mainHand' ? 'Rare' : 'Uncommon',
                    potency: 0, sockets: 0, gems: [], setId: '', uniqueEffect: ''};
                outfit[args[1]] = item; return item;
            };
            gallery.presentEquipmentLoadout(); gallery.createGalleryEquipmentItem = original;
            [gallery.remoteActor, gallery.targetActor].forEach(actor => { if (actor?.mesh) actor.mesh.visible = false; });
            document.querySelectorAll('#repro-hud, #animation-gallery, #perf-overlay').forEach(el => {el.style.display = 'none';});
            const render = gallery.renderSystem;
            render.scene.children.filter(child => child.type === 'GridHelper').forEach(child => {child.visible = false;});
            window.__ordinaryOutfit = (mode, view, quality) => {
                const gear = mode === 'default' ? {} : mode === 'mixed'
                    ? Object.fromEntries(Object.entries(outfit).filter(([slot]) => !['head', 'shoulders', 'chest', 'legs'].includes(slot))) : outfit;
                const actor = gallery.actor; actor.syncEquipmentVisuals(gear, {force: true});
                actor.mixer.timeScale = 1; actor.mixer.stopAllAction(); actor.state = 'IDLE';
                actor.playAnimation('Idle', true, true); actor.currentAction.stopFading(); actor.currentAction.setEffectiveWeight(1);
                actor.mixer.setTime(.21); actor.mixer.timeScale = 0;
                actor.rotation.set(0, 0, 0, 1); actor.previousRotation.copy(actor.rotation); actor.render(1);
                render.setGraphicsQuality(quality); render.applyLightingPreset('town', true);
                const p = actor.position;
                gallery.controls.target.set(p.x, p.y + 1.7, p.z);
                render.camera.position.set(p.x + (view === 'close' ? 0 : 24), p.y + (view === 'close' ? 10 : 32), p.z + 24);
                render.setZoom(view === 'close' ? 5 : 15); render.camera.zoom = 1; render.camera.updateProjectionMatrix();
                gallery.controls.update(); render.render();
                return {items: actor.mesh.userData.equipmentVisualItemCount, expected: Object.keys(gear).length,
                    finite: [...actor.mesh.matrixWorld.elements].every(Number.isFinite)};
            };
        });
        for (const quality of ['high', 'low']) for (const mode of ['default', 'full', 'mixed']) for (const view of ['close', 'gameplay']) {
            const result = await page.evaluate(({mode, view, quality}) => window.__ordinaryOutfit(mode, view, quality), {mode, view, quality});
            expect(result.items).toBe(result.expected); expect(result.finite).toBe(true);
            await page.screenshot({path: testInfo.outputPath(`${type}-${mode}-${view}-${quality}.png`)});
        }
        // Additional garment articulation gaps, using production ability and
        // casino pose paths rather than inventing gallery-only rig rotations.
        for (const pose of ['cast', 'seated', 'death']) {
            const state = await page.evaluate(async ({type, pose}) => {
                window.__ordinaryOutfit('full', 'close', 'high');
                const gallery = window.__eidolonAnimationGalleryController, actor = gallery.actor;
                actor.mixer.timeScale = 1; actor.mixer.stopAllAction();
                if (pose === 'cast') {
                    const skill = { Fighter: 'Sweeping Strike', Rogue: 'Backstab', Wizard: 'Fireball', Cleric: 'Healing Light' }[type];
                    if (!actor.playAbilityAnimation(skill)) throw new Error(`Missing ${type} cast`);
                } else actor.playAnimation(pose === 'death' ? 'Death' : 'Idle', false, true);
                actor.currentAction.stopFading(); actor.currentAction.setEffectiveWeight(1);
                actor.mixer.setTime(pose === 'death' ? .6 : .21); actor.mixer.timeScale = 0;
                if (pose === 'seated') {
                    const { CasinoController } = await import('/src/core/CasinoController.js');
                    const controller = Object.assign(Object.create(CasinoController.prototype), {
                        engine: { player: actor, currentInstanceId: '' }, poses: new Map(), cutawayActors: new Map(), active: false
                    });
                    actor.state = 'SEATED'; controller.render([actor]);
                    window.__clearSeatedPose = () => { actor.state = 'IDLE'; controller.render([actor]); };
                }
                actor.mesh.updateMatrixWorld(true); gallery.renderSystem.render();
                let finite = true;
                actor.mesh.traverse(part => { finite &&= part.matrixWorld.elements.every(Number.isFinite); });
                return { finite, items: actor.mesh.userData.equipmentVisualItemCount,
                    attached: Object.values(actor.mesh.userData.equipmentAnchors).flat().every(name =>
                        actor.mesh.getObjectByName(name)?.children.some(part => part.userData.equipmentVisual)) };
            }, {type, pose});
            expect(state).toEqual({finite: true, items: 14, attached: true});
            await page.screenshot({path: testInfo.outputPath(`${type}-${pose}-close-high.png`)});
            if (pose === 'seated') await page.evaluate(() => window.__clearSeatedPose());
        }
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
