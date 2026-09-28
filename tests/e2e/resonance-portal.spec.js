import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    test(`physical resonance plaza and personal entry on ${viewport.width}px`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.setViewportSize(viewport);
        await page.goto('/repro.html?gallery=1&instances=1', { waitUntil: 'networkidle' });
        await page.waitForFunction(() => window.__eidolonAnimationGallery?.ready);
        await page.evaluate(async () => {
            const THREE = await import('three');
            const { ResonancePortal } = await import('/src/entities/ResonancePortal.js');
            const { RESONANCE_PORTAL } = await import('/src/data/worldLocations.js');
            const { CHRONICLE_RESTORATIONS } = await import('/src/core/ChronicleRestoration.js');
            const { CollisionManager } = await import('/src/core/CollisionManager.js');
            const { WorldGenerator } = await import('/src/world/WorldGenerator.js');
            const { createProceduralTerrainMaterial } = await import('/src/art/ProceduralRealmTerrain.js');
            const gallery = window.__eidolonAnimationGalleryController, render = gallery.renderSystem;
            render.staticEnvironmentGroup.visible = false;
            render.scene.children.filter(child => child.type === 'GridHelper').forEach(child => { child.visible = false; });
            gallery.remoteActor.mesh.visible = false; gallery.targetActor.mesh.visible = false;
            const engine = {
                player: { id: 'fixture', level: 100, state: 'IDLE', position: new THREE.Vector3(28, 0, 239), quests: [] },
                currentInstanceId: '', collisionManager: new CollisionManager(), sent: [],
                network: { send: (type, payload) => engine.sent.push({ type, payload }) }
            };
            const ground = new THREE.Mesh(new THREE.PlaneGeometry(198.5, 198.5), createProceduralTerrainMaterial('town'));
            ground.rotation.x = -Math.PI / 2; ground.position.set(0, -.01, 200); ground.receiveShadow = true; render.scene.add(ground);
            const world = new WorldGenerator(render.scene, engine.collisionManager);
            await world.loadBuildings(0, 200);
            const plaza = new THREE.Box3(new THREE.Vector3(20, .2, 227), new THREE.Vector3(36, 4, 243));
            const blocked = engine.collisionManager.colliders.some(box => box.intersectsBox(plaza)) ||
                engine.collisionManager.orientedColliders.some(collider => collider.box.clone().applyMatrix4(collider.matrix).intersectsBox(plaza));
            if (blocked) throw new Error('Portal plaza overlaps an existing town collider');
            const portal = new ResonancePortal(RESONANCE_PORTAL.entityId);
            portal.position.set(RESONANCE_PORTAL.x, 0, RESONANCE_PORTAL.z); portal.gameEngine = engine;
            await portal.ensureMesh(); render.scene.add(portal.mesh);
            gallery.actor.position.copy(engine.player.position); gallery.actor.mesh.position.copy(engine.player.position);
            render.applyLightingPreset('town', true); render.setZoom(22);
            render.camera.position.set(72, 60, 295); gallery.controls.target.set(28, 2, 235); gallery.controls.update();
            document.querySelectorAll('#repro-hud, #animation-gallery, #perf-overlay').forEach(node => { node.style.display = 'none'; });
            const setStage = stage => {
                engine.player.quests = stage === 'locked' ? [] : Object.values(CHRONICLE_RESTORATIONS).map(value => ({ id: value.questId, completed: true }));
                engine.player.level = stage === 'ready' ? 99 : 100; portal.update(0);
            };
            const tick = () => { portal.update(1 / 60); requestAnimationFrame(tick); }; tick();
            window.__portalFixture = { engine, portal, setStage };
        });
        for (const stage of ['locked', 'ready', 'active']) {
            await page.evaluate(stage => window.__portalFixture.setStage(stage), stage);
            await expect.poll(() => page.evaluate(() => window.__portalFixture.portal.mesh.userData.portalStage)).toBe(stage);
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            await page.screenshot({ path: testInfo.outputPath(`plaza-${stage}.png`) });
            await page.evaluate(() => window.__portalFixture.portal.interact(window.__portalFixture.engine));
            const dialog = page.getByRole('dialog', { name: 'Fourfold Resonance Portal' });
            await expect(dialog).toBeVisible();
            await expect(dialog.getByRole('listitem')).toHaveCount(4);
            const cross = dialog.getByRole('button', { name: 'Enter the Dark Realm' });
            if (stage === 'active') await expect(cross).toBeEnabled(); else await expect(cross).toBeDisabled();
            const box = await dialog.boundingBox();
            expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
            expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
            await page.screenshot({ path: testInfo.outputPath(`dialog-${stage}.png`) });
            if (stage === 'active') {
                await cross.click();
                expect(await page.evaluate(() => window.__portalFixture.engine.sent)).toEqual([{ type: 'enter_dark_realm', payload: {} }]);
            } else {
                await page.keyboard.press('Escape');
            }
            await expect(dialog).toHaveCount(0);
        }
        await page.evaluate(() => window.__eidolonAnimationGalleryController.renderSystem.setGraphicsQuality('low'));
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await page.screenshot({ path: testInfo.outputPath('plaza-active-low.png') });
        // Native modal focus stays inside; movement after opening closes it,
        // preventing a stale dialog from submitting travel at a remote location.
        await page.evaluate(() => window.__portalFixture.portal.interact(window.__portalFixture.engine));
        await page.keyboard.press('Tab');
        expect(await page.evaluate(() => Boolean(document.activeElement.closest('#resonance-portal-dialog')))).toBe(true);
        await page.evaluate(() => { window.__portalFixture.engine.player.position.x += 30; window.__portalFixture.portal.update(0); });
        await expect(page.locator('#resonance-portal-dialog')).toHaveCount(0);
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
