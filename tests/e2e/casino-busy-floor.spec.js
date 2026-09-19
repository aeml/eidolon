import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { collectBrowserFailures } from './helpers.js';

// Controlled rendering only. Retain the separate connected wagering evidence;
// these seated models are not network clients or earned-currency acceptance.
test('equipped crowd remains readable on both casino floors at High and Low', async ({ page, baseURL }, testInfo) => {
    test.skip(process.env.EIDOLON_CASINO_FIXTURE_CATALOG !== '1', 'Explicit bounded busy-floor review');
    const output = execFileSync('go', ['test', './internal/game', '-run', '^TestCasinoBrowserFixtureCatalog$', '-count=1', '-v'],
        { cwd: 'server', encoding: 'utf8', timeout: 120000 });
    const line = output.split('\n').find(line => line.startsWith('[casino-fixture-catalog]'));
    if (!line) throw new Error('Missing canonical casino table catalog');
    const tables = JSON.parse(line.slice('[casino-fixture-catalog]'.length));
    const failures = collectBrowserFailures(page, baseURL);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/repro.html?gallery=1&instances=1', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__eidolonAnimationGallery?.ready);
    const setup = await page.evaluate(async tables => {
        const THREE = await import('three');
        const { MeshFactory } = await import('/src/utils/MeshFactory.js');
        const { BASE_ITEMS } = await import('/src/core/ItemSystem.js');
        const { applyProceduralEquipment, EQUIPMENT_RENDER_SLOTS } = await import('/src/art/ProceduralEquipment.js');
        const { CasinoController } = await import('/src/core/CasinoController.js');
        const { AttachedStatusEffect } = await import('/src/entities/AttachedStatusEffect.js');
        const { CollisionManager } = await import('/src/core/CollisionManager.js');
        const { createCasinoInterior, disposeCasinoObject } = await import('/src/art/ProceduralCasino.js');
        const gallery = window.__eidolonAnimationGalleryController;
        gallery.cleanupPresentation();
        [gallery.actor, gallery.remoteActor, gallery.targetActor].forEach(actor => { if (actor?.mesh) actor.mesh.visible = false; });
        const render = gallery.renderSystem;
        render.setEnvironmentContext('casino', new THREE.Vector3(0, 0, 166), true);
        render.scene.traverse(object => { if (object.type === 'GridHelper') object.visible = false; });
        document.querySelectorAll('#repro-hud, #animation-gallery, #perf-overlay').forEach(element => { element.style.display = 'none'; });
        const collisionManager = new CollisionManager();
        const interior = createCasinoInterior(render.scene, collisionManager);
        const viewer = { position: new THREE.Vector3(26, 0, 160), state: 'IDLE' };
        const controller = new CasinoController({ renderSystem: render, collisionManager, currentInstanceId: 'lanternhold-casino',
            player: viewer, network: { socket: { readyState: WebSocket.OPEN }, send() {} } });
        controller.engine.casino = controller;
        controller.updateState({ tables, floor: 'public' });
        render.scene.add(controller.furniture);
        const models = [];
        // Four people at every card table, plus one at each slot machine:40.
        // Use all classes and full equipment, not cheap proxy cubes.
        for (const table of tables) for (const seat of table.seats.slice(0, 4)) {
            const type = ['Fighter', 'Rogue', 'Wizard', 'Cleric'][models.length % 4];
            const mesh = await MeshFactory.createMeshForType(type);
            const equipment = Object.fromEntries(EQUIPMENT_RENDER_SLOTS.map((slot, index) => {
                const candidates = BASE_ITEMS.filter(item => item.slot === slot.replace(/[12]$/, ''));
                return [slot, gallery.createGalleryEquipmentItem(candidates[models.length % candidates.length], slot, index + 1)];
            }));
            const fit = applyProceduralEquipment(mesh, equipment);
            if (fit.items !== 14 || fit.missing.length) throw new Error(`Incomplete ${type} equipment`);
            mesh.position.set(seat.x, seat.y || 0, seat.z);
            mesh.rotation.y = seat.rotation;
            render.scene.add(mesh);
            models.push({ type, mesh, position: mesh.position, state: 'SEATED', floor: table.floor, gameEngine: controller.engine });
        }
        controller.render(models);
        let auras = [];
        window.__casinoCrowd = {
            view(quality, floor) {
                render.setGraphicsQuality(quality);
                const upstairs = floor === 'vip';
                controller.floor = floor;
                viewer.position.set(upstairs ? 0 : 26, upstairs ? 8 : 0, upstairs ? 140 : 160);
                controller.beforeUpdate(1 / 60);
                controller.render(models);
                auras.forEach(aura => aura.dispose());
                auras = models.map(model => new AttachedStatusEffect(render.effectGroup, model, 'well_rested', { quality }));
                render.setZoom(30);
                const focus = new THREE.Vector3(0, upstairs ? 8 : 0, upstairs ? 149 : 166);
                render.camera.position.copy(focus).add(new THREE.Vector3(20, 70, 65));
                gallery.controls.target.copy(focus);
                gallery.controls.update();
                return { visible: models.filter(model => model.mesh.visible).length,
                    auras: auras.filter(aura => aura.group.visible).length,
                    seated: models.filter(model => model.mesh.getObjectByName('Rig_Hips')?.position.y === 1.12).length };
            },
            dispose() {
                controller.dispose();
                auras.forEach(aura => aura.dispose());
                models.forEach(({ type, mesh }) => { mesh.removeFromParent(); MeshFactory.releaseMesh(type, mesh); });
                disposeCasinoObject(interior);
            }
        };
        return { tables: tables.length, seats: controller.furniture.userData.seats.length, models: models.length };
    }, tables);
    expect(setup).toEqual({ tables: 16, seats: 56, models: 40 });
    try {
        for (const quality of ['high', 'low']) for (const floor of ['public', 'vip']) {
            const view = await page.evaluate(({ quality, floor }) => window.__casinoCrowd.view(quality, floor), { quality, floor });
            expect(view.seated).toBe(40);
            expect(view.visible).toBe(floor === 'public' ? 28 : 40);
            expect(view.auras).toBe(view.visible);
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            await page.screenshot({ path: testInfo.outputPath(`casino-crowd-${floor}-${quality}.png`) });
        }
    } finally {
        await page.evaluate(() => window.__casinoCrowd.dispose());
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
