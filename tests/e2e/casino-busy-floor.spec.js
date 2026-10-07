import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { cpus, loadavg } from 'node:os';
import { collectBrowserFailures } from './helpers.js';

function hostCpuSnapshot() {
    return cpus().reduce((sum, cpu) => ({
        idle: sum.idle + cpu.times.idle,
        total: sum.total + Object.values(cpu.times).reduce((a, b) => a + b, 0)
    }), { idle: 0, total: 0 });
}

// Optional bounded visual-only review while native GPU gameplay QA owns the
// renderer. Software screenshots are not native performance evidence.
if (process.env.EIDOLON_CASINO_SOFTWARE_REVIEW === '1') {
    test.use({ launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } });
}

// Controlled rendering only. Retain the separate connected wagering evidence;
// these seated models are not network clients or earned-currency acceptance.
test('equipped crowd remains readable on both casino floors at High and Low', async ({ page, baseURL }, testInfo) => {
    test.skip(process.env.EIDOLON_CASINO_FIXTURE_CATALOG !== '1', 'Explicit bounded busy-floor review');
    const profile = process.env.EIDOLON_CASINO_PROFILE === '1';
    const cpuDiagnostic = process.env.EIDOLON_CASINO_CPU_PROFILE === '1';
    const baselineCommit = process.env.EIDOLON_CASINO_BASELINE_COMMIT;
    const baselineModulesServed = new Set();
    if (cpuDiagnostic && !profile) throw new Error('CPU diagnostic requires the casino frame profile');
    if (profile && process.env.EIDOLON_CASINO_SOFTWARE_REVIEW === '1') throw new Error('Casino performance requires hardware rendering');
    if (baselineCommit) {
        if (!profile || !/^[0-9a-f]{40}$/.test(baselineCommit)) throw new Error('Casino baseline requires profile mode and an exact Git SHA');
        // Same current art/workload/browser on both sides; replace only the
        // optimized runtime modules with their immutable baseline source.
        for (const file of ['src/core/CasinoController.js', 'src/entities/AttachedStatusEffect.js', 'src/art/FittedEquipment.js', 'src/art/AuthoredFighter.js']) {
            const body = execFileSync('git', ['show', `${baselineCommit}:${file}`], { encoding: 'utf8' });
            await page.route(`**/${file}*`, route => {
                baselineModulesServed.add(file);
                return route.fulfill({ body, contentType: 'text/javascript' });
            });
        }
    }
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
        const { EQUIPMENT_RENDER_SLOTS } = await import('/src/art/ProceduralEquipment.js');
        const { applyEquipmentVisuals } = await import('/src/art/EquipmentVisuals.js');
        const { canEquipItem } = await import('/src/core/EquipmentSlots.js');
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
        const models = [], seatingVerified = new Set();
        // Keep the review bounded at 40 equipped actors, 20 per floor. Render
        // the full 92-station catalog without inventing 176 network clients.
        const floorModels = { public: 0, vip: 0 };
        for (const table of tables) for (const seat of table.seats.slice(0, 1)) {
            if (floorModels[table.floor] >= 20) continue;
            floorModels[table.floor]++;
            const type = ['Fighter', 'Rogue', 'Wizard', 'Cleric'][models.length % 4];
            const mesh = await MeshFactory.createMeshForType(type);
            if (mesh.userData.authoredClass !== type) throw new Error(`Missing authored ${type} casino model`);
            const equipment = Object.fromEntries(EQUIPMENT_RENDER_SLOTS.map((slot, index) => {
                const candidates = BASE_ITEMS.filter(item => canEquipItem(type, item, slot));
                if (!candidates.length) throw new Error(`No valid ${type} ${slot} casino fixture item`);
                return [slot, gallery.createGalleryEquipmentItem(candidates[models.length % candidates.length], slot, index + 1)];
            }));
            applyEquipmentVisuals(mesh, equipment);
            await mesh.userData.equipmentReady;
            if (mesh.userData.equipmentVisualItemCount !== 14 || mesh.userData.equipmentVisualMissing?.length) throw new Error(`Incomplete authored ${type} equipment`);
            mesh.position.set(seat.x, seat.y || 0, seat.z);
            mesh.rotation.y = seat.rotation;
            render.scene.add(mesh);
            models.push({ type, mesh, equipment, position: mesh.position, state: 'SEATED', floor: table.floor, gameEngine: controller.engine,
                standingThigh: mesh.getObjectByName('thigh_l').quaternion.clone() });
        }
        controller.render(models);
        let auras = [];
        const updateAuras = { update(dt) { auras.forEach(aura => aura.update(dt)); controller.render(models); } };
        gallery.persistentEntities.push(updateAuras);
        window.__casinoCrowd = {
            async view(quality, floor) {
                if (models[0].mesh.userData.authoredQuality !== quality) {
                    // Match new actors loaded with this setting, rather than
                    // benchmarking High-detail bodies under Low lighting.
                    controller.render([]); controller.restoreCutawayActors([]);
                    for (const model of models) {
                        const old = model.mesh, mesh = await MeshFactory.createMeshForType(model.type, { quality });
                        if (mesh.userData.authoredQuality !== quality) throw new Error(`Wrong ${model.type} casino detail`);
                        applyEquipmentVisuals(mesh, model.equipment); await mesh.userData.equipmentReady;
                        if (mesh.userData.equipmentVisualItemCount !== 14 || mesh.userData.equipmentVisualMissing?.length) throw new Error(`Incomplete ${quality} equipment`);
                        mesh.position.copy(old.position); mesh.rotation.copy(old.rotation);
                        old.removeFromParent(); MeshFactory.releaseMesh(model.type, old);
                        model.mesh = mesh; model.position = mesh.position;
                        model.standingThigh = mesh.getObjectByName('thigh_l').quaternion.clone();
                        render.scene.add(mesh);
                    }
                    seatingVerified.clear();
                }
                render.setGraphicsQuality(quality);
                const upstairs = floor === 'vip';
                controller.floor = floor;
                viewer.position.set(0, upstairs ? 8 : 0, 152);
                controller.beforeUpdate(1 / 60);
                controller.render(models);
                auras.forEach(aura => aura.dispose());
                auras = models.map(model => new AttachedStatusEffect(render.effectGroup, model, 'well_rested', { quality }));
                // A controlled full-hall overview, not the player's zoom limit.
                // setZoom(58) silently clamps at 30 and crops most of this venue.
                render.camera.left = -58 * innerWidth / innerHeight;
                render.camera.right = 58 * innerWidth / innerHeight;
                render.camera.top = 58; render.camera.bottom = -58;
                render.camera.updateProjectionMatrix();
                const focus = new THREE.Vector3(0, upstairs ? 8 : 0, 152);
                render.camera.position.copy(focus).add(new THREE.Vector3(20, 90, 85));
                gallery.controls.target.copy(focus);
                gallery.controls.update();
                const seated = models.filter(model => {
                        if (!model.mesh.visible) return false;
                        const pelvis = model.mesh.getObjectByName('pelvis'), thigh = model.mesh.getObjectByName('thigh_l');
                        const height = pelvis.getWorldPosition(new THREE.Vector3()).y - model.mesh.getWorldPosition(new THREE.Vector3()).y;
                        return controller.poses.get(model)?.authored && Math.abs(height - 1.12) < 1e-5 && thigh.quaternion.angleTo(model.standingThigh) > 1;
                    });
                seated.forEach(model => seatingVerified.add(model));
                let skinnedMeshes = 0;
                const skeletons = new Set();
                models.filter(model => model.mesh.visible).forEach(model => model.mesh.traverseVisible(part => {
                    if (part.isSkinnedMesh) { skinnedMeshes++; skeletons.add(part.skeleton); }
                }));
                return { visible: models.filter(model => model.mesh.visible).length,
                    auras: auras.filter(aura => aura.group.visible).length,
                    seated: seated.length, allSeated: seatingVerified.size, skinnedMeshes, skeletons: skeletons.size,
                    floors: { public: interior.userData.floors.public.visible, vip: interior.userData.floors.vip.visible } };
            },
            dispose() {
                gallery.persistentEntities = gallery.persistentEntities.filter(entry => entry !== updateAuras);
                controller.dispose();
                auras.forEach(aura => aura.dispose());
                models.forEach(({ type, mesh }) => { mesh.removeFromParent(); MeshFactory.releaseMesh(type, mesh); });
                disposeCasinoObject(interior);
            }
        };
        return { tables: tables.length, seats: controller.furniture.userData.seats.length, models: models.length };
    }, tables);
    expect(setup).toEqual({ tables: 92, seats: 232, models: 40 });
    if (baselineCommit) expect([...baselineModulesServed].sort()).toEqual([
        'src/art/AuthoredFighter.js', 'src/art/FittedEquipment.js', 'src/core/CasinoController.js', 'src/entities/AttachedStatusEffect.js'
    ]);
    const profiles = [];
    try {
        for (const quality of ['high', 'low']) for (const floor of ['public', 'vip']) {
            const view = await page.evaluate(({ quality, floor }) => window.__casinoCrowd.view(quality, floor), { quality, floor });
            expect(view.seated).toBe(20);
            if (floor === 'vip') expect(view.allSeated).toBe(40);
            expect(view.visible).toBe(20);
            expect(view.auras).toBe(view.visible);
            expect(view.floors).toEqual({ public: floor === 'public', vip: floor === 'vip' });
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            await page.screenshot({ path: testInfo.outputPath(`casino-crowd-${floor}-${quality}.png`) });
            if (profile) {
                // One diagnostic sample only. Profiler overhead means this run
                // cannot establish timing acceptance, even if assertions pass.
                const cpuSession = cpuDiagnostic && quality === 'low' && floor === 'public'
                    ? await page.context().newCDPSession(page) : null;
                if (cpuSession) {
                    await cpuSession.send('Profiler.enable');
                    await cpuSession.send('Profiler.start');
                }
                const cpuBefore = hostCpuSnapshot();
                const loadBefore = loadavg();
                const sample = await page.evaluate(() => new Promise((resolve, reject) => {
                    const render = window.__eidolonAnimationGalleryController.renderSystem;
                    const original = render.render;
                    const samples = [];
                    let warmup = 60, previous;
                    const timer = setTimeout(() => {
                        render.render = original;
                        reject(new Error(`Casino frame profile timed out: ${samples.length}/180`));
                    }, 30000);
                    render.render = function () {
                        const started = performance.now();
                        try { original.call(this); }
                        catch (error) { clearTimeout(timer); render.render = original; reject(error); return; }
                        const cpu = performance.now() - started;
                        const interval = previous === undefined ? 0 : started - previous;
                        previous = started;
                        if (warmup-- > 0) return;
                        const info = render.renderer.info;
                        samples.push({ interval, cpu, calls: info.render.calls, triangles: info.render.triangles });
                        if (samples.length < 180) return;
                        clearTimeout(timer);
                        render.render = original;
                        const percentile = (key, fraction) => samples.map(sample => sample[key]).sort((a, b) => a - b)[Math.floor((samples.length - 1) * fraction)];
                        const context = render.renderer.getContext();
                        const extension = context.getExtension('WEBGL_debug_renderer_info');
                        resolve({ frames: samples.length, visibility: document.visibilityState,
                            medianMs: percentile('interval', .5), p95Ms: percentile('interval', .95),
                            renderCpuMedianMs: percentile('cpu', .5), renderCpuP95Ms: percentile('cpu', .95),
                            calls: percentile('calls', .5), triangles: percentile('triangles', .5),
                            geometries: info.memory.geometries, textures: info.memory.textures,
                            renderer: extension ? context.getParameter(extension.UNMASKED_RENDERER_WEBGL) : context.getParameter(context.RENDERER) });
                    };
                }));
                if (cpuSession) {
                    const { profile: cpuProfile } = await cpuSession.send('Profiler.stop');
                    await testInfo.attach('casino-low-public-cpu-diagnostic', {
                        body: JSON.stringify(cpuProfile), contentType: 'application/json' });
                    await cpuSession.detach();
                }
                const cpuAfter = hostCpuSnapshot();
                profiles.push({ quality, floor, ...sample, skinnedMeshes: view.skinnedMeshes, skeletons: view.skeletons, baselineCommit: baselineCommit || null,
                    host: { idlePercent: 100 * (cpuAfter.idle - cpuBefore.idle) / (cpuAfter.total - cpuBefore.total),
                        loadBefore, loadAfter: loadavg() } });
                console.log('[casino-frame-profile]', JSON.stringify(profiles.at(-1)));
                expect(sample.frames).toBe(180);
                expect(sample.visibility).toBe('visible');
                expect(sample.renderer).not.toMatch(/swiftshader|llvmpipe|software/i);
                expect(sample.calls).toBeGreaterThan(0);
                expect(sample.medianMs).toBeGreaterThan(0);
                // Same hardware-specific targets as the retained raid workload.
                // These are not network, device-wide or sustained FPS claims.
                expect.soft(sample.medianMs).toBeLessThanOrEqual(quality === 'high' ? 25 : 20);
                expect.soft(sample.p95Ms).toBeLessThanOrEqual(quality === 'high' ? 50 : 33.3);
            }
        }
    } finally {
        if (profile) await testInfo.attach('casino-frame-profiles', { body: JSON.stringify(profiles, null, 2), contentType: 'application/json' });
        await page.evaluate(() => window.__casinoCrowd.dispose());
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
