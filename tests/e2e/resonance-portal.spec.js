import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test.afterEach(async ({ page }) => {
    await page.evaluate(() => window.__portalFixture?.dispose());
});

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    test(`physical resonance plaza and personal entry on ${viewport.width}px`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize(viewport);
        await page.goto('/', { waitUntil: 'networkidle' });
        const rendererIdentity = await page.evaluate(async mobile => {
            const THREE = await import('three');
            const { RenderSystem } = await import('/src/core/RenderSystem.js');
            const { MeshFactory } = await import('/src/utils/MeshFactory.js');
            const { ResonancePortal } = await import('/src/entities/ResonancePortal.js');
            const { InputManager } = await import('/src/core/InputManager.js');
            const { requestNearbyChronicleInspection } = await import('/src/core/ChronicleInspection.js');
            const { RESONANCE_PORTAL } = await import('/src/data/worldLocations.js');
            const { CHRONICLE_RESTORATIONS } = await import('/src/core/ChronicleRestoration.js');
            const { CollisionManager } = await import('/src/core/CollisionManager.js');
            const { WorldGenerator } = await import('/src/world/WorldGenerator.js');
            const { createProceduralTerrainMaterial } = await import('/src/art/ProceduralRealmTerrain.js');
            document.getElementById('start-screen').style.display = 'none';
            const render = new RenderSystem(mobile);
            render.staticEnvironmentGroup.visible = false;
            const engine = {
                player: { id: 'fixture', level: 100, state: 'IDLE', position: new THREE.Vector3(28, 0, 239), quests: [] },
                currentInstanceId: '', isMultiplayer: true, collisionManager: new CollisionManager(), sent: [],
                network: { send: (type, payload) => engine.sent.push({ type, payload }) },
                uiManager: { admin: { authorized: false } }
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
            engine.chunkManager = { getActiveEntities: () => [portal] };
            engine.inputManager = new InputManager(render.camera, render.renderer.domElement);
            engine.inputManager.subscribe('onInspect', () => requestNearbyChronicleInspection(engine));
            portal.position.set(RESONANCE_PORTAL.x, 0, RESONANCE_PORTAL.z); portal.gameEngine = engine;
            await portal.ensureMesh(); render.scene.add(portal.mesh);
            const hero = await MeshFactory.createMeshForType('Fighter');
            hero.position.copy(engine.player.position); render.entityGroup.add(hero);
            render.setGraphicsQuality('high');
            render.applyLightingPreset('town', true); render.setZoom(22);
            render.camera.position.set(72, 60, 295); render.camera.lookAt(28, 2, 235); render.camera.updateMatrixWorld(true);
            // Presentation/input coverage, not a frame-rate benchmark. Submit
            // bounded production frames instead of running the unrelated full
            // animation gallery (including summons) throughout every screenshot.
            const paint = () => { portal.update(1 / 60); render.render(); };
            const setStage = stage => {
                engine.sent = [];
                engine.uiManager.admin.authorized = stage === 'administrator';
                engine.player.quests = ['locked', 'administrator'].includes(stage) ? [] : Object.values(CHRONICLE_RESTORATIONS).map(value => ({ id: value.questId, completed: true }));
                engine.player.level = stage === 'ready' ? 99 : 100; paint();
            };
            window.__portalFixture = { engine, portal, setStage, render, paint, dispose() {
                engine.inputManager.dispose(); portal.dispose();
                hero.removeFromParent(); MeshFactory.releaseMesh('Fighter', hero); render.dispose();
            } };
            const context = render.renderer.getContext();
            const extension = context.getExtension('WEBGL_debug_renderer_info');
            return context.getParameter(extension ? extension.UNMASKED_RENDERER_WEBGL : context.RENDERER);
        }, viewport.width < 600);
        await testInfo.attach('portal-renderer', { body: rendererIdentity, contentType: 'text/plain' });
        console.log(`Portal presentation renderer (${viewport.width}px): ${rendererIdentity}`);
        for (const stage of ['locked', 'ready', 'active', 'administrator']) {
            await page.evaluate(stage => window.__portalFixture.setStage(stage), stage);
            await expect.poll(() => page.evaluate(() => window.__portalFixture.portal.mesh.userData.portalStage)).toBe(stage === 'administrator' ? 'active' : stage);
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            await page.screenshot({ path: testInfo.outputPath(`plaza-${stage}.png`) });
            if (stage === 'active') {
                await page.evaluate(() => {
                    document.activeElement?.blur();
                    const engine = window.__portalFixture.engine;
                    engine.inputManager.keys.w = true; engine.player.state = 'MOVING';
                    engine.player.targetPosition = engine.player.position.clone().addScalar(20);
                });
                await page.keyboard.press('e');
                expect(await page.evaluate(() => {
                    const engine = window.__portalFixture.engine;
                    return { moving: engine.inputManager.keys.w, target: engine.player.targetPosition, state: engine.player.state, sent: engine.sent.length };
                })).toEqual({ moving: false, target: null, state: 'IDLE', sent: 0 });
            } else await page.evaluate(() => window.__portalFixture.portal.interact(window.__portalFixture.engine));
            const dialog = page.getByRole('dialog', { name: 'Fourfold Resonance Portal' });
            await expect(dialog).toBeVisible();
            await expect(dialog.getByRole('listitem')).toHaveCount(4);
            const cross = dialog.getByRole('button', { name: 'Enter the Dark Realm' });
            if (['active', 'administrator'].includes(stage)) await expect(cross).toBeEnabled(); else await expect(cross).toBeDisabled();
            if (stage === 'administrator') {
                await expect(dialog).toContainText('Administrator passage');
                expect(await page.evaluate(() => window.__portalFixture.engine.player.quests)).toEqual([]);
            }
            const box = await dialog.boundingBox();
            expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
            expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
            await page.screenshot({ path: testInfo.outputPath(`dialog-${stage}.png`) });
            if (['active', 'administrator'].includes(stage)) {
                await cross.click();
                expect(await page.evaluate(() => window.__portalFixture.engine.sent)).toEqual([{ type: 'enter_dark_realm', payload: {} }]);
            } else {
                await page.keyboard.press('Escape');
            }
            await expect(dialog).toHaveCount(0);
        }
        await page.evaluate(() => { const fixture = window.__portalFixture; fixture.render.setGraphicsQuality('low'); fixture.paint(); });
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
