import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';

// Bounded production-renderer scene review, not campaign or network coverage.
for (const [quality, width] of [['high', 1280], ['low', 390]]) {
    test(`populated Earth and town: ${quality} at ${width}px`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height: 844 });
        await page.goto('/', { waitUntil: 'networkidle' });
        const locations = await page.evaluate(async ({ quality, mobile }) => {
            const THREE = await import('three');
            const { RenderSystem } = await import('/src/core/RenderSystem.js');
            const { WorldGenerator } = await import('/src/world/WorldGenerator.js');
            const { CollisionManager } = await import('/src/core/CollisionManager.js');
            const { MeshFactory } = await import('/src/utils/MeshFactory.js');
            const { WorldReading } = await import('/src/entities/WorldReading.js');
            const { EARTH_LOCATIONS, LANTERNHOLD_COURTYARDS, WORLD_READINGS } = await import('/src/data/worldPopulation.js');
            const { createProceduralLanternholdStructure, getLanternholdWalkCollider } = await import('/src/art/ProceduralLanternholdArchitecture.js');
            const { createChronicleSiteModel } = await import('/src/art/ChronicleSiteModels.js');
            const { chronicleInvestigations } = await import('/src/data/chronicleInvestigations.generated.js');
            const { ResonancePortal } = await import('/src/entities/ResonancePortal.js');
            const { InputManager } = await import('/src/core/InputManager.js');
            const { requestNearbyChronicleInspection } = await import('/src/core/ChronicleInspection.js');
            document.getElementById('start-screen').style.display = 'none';
            const render = new RenderSystem(mobile); render.setGraphicsQuality(quality);
            await render.preloadEnvironment();
            const collision = new CollisionManager();
            const world = new WorldGenerator(render.instanceEnvironmentGroup, collision, { graphicsQuality: quality });
            await world.createTownBase(0, 200, 100);
            await world.loadBuildings(0, 200); await world.loadTrees(0, 200); await world.createOverworldStructures();
            for (const [kind, x, z, angle] of [['trading_house', -22, 185, Math.PI / 4], ['forge', -28, 218, Math.PI / 2], ['stash', -16, 193, 0]]) {
                const mesh = createProceduralLanternholdStructure(kind); mesh.position.set(x, .5, z); mesh.rotation.y = angle;
                render.instanceEnvironmentGroup.add(mesh); collision.addOrientedCollider(getLanternholdWalkCollider(mesh));
            }
            for (const chapter of chronicleInvestigations.filter(c => c.realm === 'earth')) for (const site of chapter.sites) {
                if (site.kind !== 'inspect') continue;
                const model = createChronicleSiteModel(site, 'earth'); model.mesh.position.set(site.x, 0, site.z);
                render.instanceEnvironmentGroup.add(model.mesh);
            }
            const engine = { player: { id: 'scene-review', position: new THREE.Vector3(), state: 'IDLE', quests: [] },
                isMultiplayer: true, currentInstanceId: '', currentInstanceType: 'overworld', sent: [], network: { send: (...args) => engine.sent.push(args) } };
            const readings = [];
            for (const site of WORLD_READINGS) {
                const reading = new WorldReading(site.id); reading.position.set(site.x, 0, site.z); reading.gameEngine = engine;
                await reading.ensureMesh(); render.entityGroup.add(reading.mesh); readings.push(reading);
            }
            const portal = new ResonancePortal('resonance-portal'); portal.position.set(28, 0, 235); portal.gameEngine = engine;
            await portal.ensureMesh(); render.entityGroup.add(portal.mesh);
            const hero = await MeshFactory.createMeshForType('Fighter'); render.entityGroup.add(hero);
            engine.chunkManager = { getActiveEntities: () => readings };
            engine.inputManager = new InputManager(render.camera, render.renderer.domElement);
            engine.inputManager.subscribe('onInspect', () => requestNearbyChronicleInspection(engine));
            const sites = [...LANTERNHOLD_COURTYARDS, ...EARTH_LOCATIONS];
            const samples = [];
            const visit = id => {
                const site = sites.find(s => s.id === id);
                const reading = readings.find(r => r.id === `world-reading-${id}`);
                const x = reading?.position.x ?? site.x + (site.arrivalOffset?.[0] || 0);
                const z = reading?.position.z ?? site.z + (site.arrivalOffset?.[1] || 0);
                engine.player.position.set(x - (reading ? 4 : 0), 0, z + (reading ? 3 : 0)); hero.position.copy(engine.player.position);
                render.setZoom(15); render.setCameraTarget(engine.player.position); render.setSceneryFocus(engine.player.position);
                render.applyLightingPreset(site.region === 'town' ? 'town' : 'earth', true);
                world.updateTownPresentation(1 / 60, engine.player.position); render.render();
                const stats = { id, calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles,
                    geometries: render.renderer.info.memory.geometries, textures: render.renderer.info.memory.textures };
                if (reading) {
                    render.scene.updateMatrixWorld(true); render.camera.updateMatrixWorld(true);
                    const point = reading.mesh.localToWorld(new THREE.Vector3(0, 1.7, 0)).project(render.camera);
                    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(point.x, point.y), render.camera);
                    const hit = ray.intersectObjects([render.instanceEnvironmentGroup, render.entityGroup], true)
                        .find(hit => hit.object.visible);
                    stats.readingHit = hit?.object.userData.entityId;
                    stats.firstHit = hit?.object.name;
                    stats.approachBlocked = Boolean(collision.checkCollision(engine.player.position, 1.25));
                }
                samples.push(stats); return stats;
            };
            window.__populatedWorld = { visit, engine, samples, async profile() {
                const profiles = [];
                for (const id of ['lanternhold-common-well', 'lanternhold-menders-yard', 'foresters-yard', 'returning-scar']) {
                    visit(id);
                    const frameTimes = [], cpuTimes = []; let previous;
                    for (let i = 0; i < 150; i++) {
                        const now = await new Promise(resolve => requestAnimationFrame(resolve));
                        const start = performance.now();
                        world.updateTownPresentation(1 / 60, engine.player.position); render.render();
                        if (i >= 30) { frameTimes.push(now - previous); cpuTimes.push(performance.now() - start); }
                        previous = now;
                    }
                    const percentile = (values, p) => values.sort((a, b) => a - b)[Math.floor((values.length - 1) * p)];
                    profiles.push({ id, median: percentile(frameTimes, .5), p95: percentile(frameTimes, .95),
                        cpuP95: percentile(cpuTimes, .95), calls: render.renderer.info.render.calls,
                        triangles: render.renderer.info.render.triangles });
                }
                const gl = render.renderer.getContext(), extension = gl.getExtension('WEBGL_debug_renderer_info');
                return { renderer: gl.getParameter(extension ? extension.UNMASKED_RENDERER_WEBGL : gl.RENDERER), profiles };
            }, dispose() {
                readings.forEach(r => r.dispose()); portal.dispose(); engine.inputManager.dispose();
                hero.removeFromParent(); MeshFactory.releaseMesh('Fighter', hero);
                render.clearInstanceScene(); render.dispose();
            } };
            return sites.map(s => s.id);
        }, { quality, mobile: width < 600 });
        try {
            for (const id of locations) {
                const stats = await page.evaluate(id => window.__populatedWorld.visit(id), id);
                await page.screenshot({ path: testInfo.outputPath(`${id}.png`) });
                expect(stats.calls).toBeGreaterThan(0);
                if (stats.readingHit !== undefined || ['bellkeepers-cairn', 'unbound-milestone'].includes(id)) {
                    expect(stats.readingHit, JSON.stringify(stats)).toBe(`world-reading-${id}`);
                    expect(stats.approachBlocked).toBe(false);
                    await page.keyboard.press('e');
                    await expect(page.locator('#world-reading-dialog')).toBeVisible();
                    await page.getByRole('button', { name: 'Close reading' }).click();
                    await expect(page.locator('#world-reading-dialog')).toHaveCount(0);
                }
            }
            const result = await page.evaluate(() => ({ samples: window.__populatedWorld.samples, sent: window.__populatedWorld.engine.sent }));
            expect(result.sent).toEqual([]);
            const countsPath = testInfo.outputPath('scene-counts.json');
            await writeFile(countsPath, JSON.stringify(result.samples, null, 2));
            await testInfo.attach('scene-counts', { path: countsPath, contentType: 'application/json' });
            // Opt-in local hardware acceptance; shared CI is not a comparable
            // frame-time environment. No busy loop, uncapped render or GPU finish.
            if (process.env.EIDOLON_E2E_POPULATION_PROFILE === '1') {
                const profile = await page.evaluate(() => window.__populatedWorld.profile());
                const path = testInfo.outputPath('frame-profile.json');
                await writeFile(path, JSON.stringify(profile, null, 2));
                await testInfo.attach('frame-profile', { path, contentType: 'application/json' });
                expect(profile.renderer).not.toMatch(/SwiftShader|llvmpipe/i);
                for (const view of profile.profiles) {
                    expect(view.median, `${view.id} median`).toBeLessThanOrEqual(quality === 'high' ? 20 : 33.4);
                    expect(view.p95, `${view.id} p95`).toBeLessThanOrEqual(quality === 'high' ? 33.4 : 50);
                }
            }
            expect(failures, failures.join('\n')).toEqual([]);
        } finally { await page.evaluate(() => window.__populatedWorld.dispose()); }
    });
}
