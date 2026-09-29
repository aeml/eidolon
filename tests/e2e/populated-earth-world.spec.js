import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';

// Bounded production-renderer scene review, not campaign or network coverage.
for (const elemental of ['earth', 'water-fire', 'air']) for (const [quality, width] of [['high', 1280], ['low', 390]]) {
    test(`populated ${elemental === 'air' ? 'Air' : elemental === 'water-fire' ? 'Water and Fire' : 'Earth and town'}: ${quality} at ${width}px`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height: 844 });
        await page.goto('/', { waitUntil: 'networkidle' });
        const locations = await page.evaluate(async ({ quality, mobile, elemental }) => {
            const THREE = await import('three');
            const { RenderSystem } = await import('/src/core/RenderSystem.js');
            const { WorldGenerator } = await import('/src/world/WorldGenerator.js');
            const { CollisionManager } = await import('/src/core/CollisionManager.js');
            const { MeshFactory } = await import('/src/utils/MeshFactory.js');
            const { Actor } = await import('/src/entities/Actor.js');
            const { WorldReading } = await import('/src/entities/WorldReading.js');
            const { EARTH_LOCATIONS, LANTERNHOLD_COURTYARDS, WORLD_READINGS } = await import('/src/data/worldPopulation.js');
            const { WATER_LOCATIONS, FIRE_LOCATIONS, AIR_LOCATIONS } = await import('/src/data/elementalPopulation.js');
            const { getLanternholdWalkCollider } = await import('/src/art/ProceduralLanternholdArchitecture.js');
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
            const understory = render.instanceEnvironmentGroup.getObjectByName('Gloamwood heath and fern beds');
            const windMaterial = understory.children[0].material;
            let windUniforms;
            const compileWind = windMaterial.onBeforeCompile;
            windMaterial.onBeforeCompile = shader => { compileWind(shader); windUniforms = shader.uniforms; };
            for (const [kind, x, z, angle] of [['trading_house', -22, 185, Math.PI / 4], ['forge', -28, 218, Math.PI / 2], ['stash', -16, 193, 0]]) {
                const type = { trading_house: 'TradingHouse', forge: 'Forge', stash: 'Stash' }[kind];
                const mesh = await MeshFactory.createMeshForType(type);
                if (!(mesh.userData.drawMeshCount < mesh.userData.sourceMeshCount)) throw new Error(`Unoptimized production service: ${type}`);
                mesh.position.set(x, .5, z); mesh.rotation.y = angle;
                render.instanceEnvironmentGroup.add(mesh); collision.addOrientedCollider(getLanternholdWalkCollider(mesh));
            }
            for (const chapter of chronicleInvestigations.filter(c => elemental === 'water-fire' ? ['water', 'fire'].includes(c.realm) : c.realm === elemental)) for (const site of chapter.sites) {
                if (site.kind !== 'inspect') continue;
                const model = createChronicleSiteModel(site, chapter.realm); model.mesh.position.set(site.x, 0, site.z);
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
            if (elemental === 'earth') for (const [x, z] of [[125, 180], [130, 215], [125, 250]]) {
                // Authored starter positions, prepared art reference only.
                const skeleton = await MeshFactory.createMeshForType('Skeleton');
                skeleton.position.set(x, 0, z); render.entityGroup.add(skeleton);
            }
            engine.chunkManager = { getActiveEntities: () => readings };
            engine.inputManager = new InputManager(render.camera, render.scene, render.renderer.domElement);
            engine.inputManager.subscribe('onInspect', () => requestNearbyChronicleInspection(engine));
            const sites = elemental === 'air' ? AIR_LOCATIONS : elemental === 'water-fire' ? [...WATER_LOCATIONS, ...FIRE_LOCATIONS] : [
                ...LANTERNHOLD_COURTYARDS,
                { id: 'lanternhold-service-court', x: 0, z: 199, region: 'town' },
                { id: 'lanternhold-trading-roof', x: -17, z: 191, region: 'town' },
                { id: 'lanternhold-east-gate', x: 108, z: 200, region: 'earth' },
                { id: 'first-road-encounter', x: 119, z: 178, region: 'earth' },
                ...EARTH_LOCATIONS
            ];
            const samples = [];
            const visit = id => {
                const site = sites.find(s => s.id === id);
                const reading = readings.find(r => r.id === `world-reading-${id}`);
                const x = reading?.position.x ?? site.x + (site.arrivalOffset?.[0] || 0);
                const z = reading?.position.z ?? site.z + (site.arrivalOffset?.[1] || 0);
                engine.player.position.set(x - (reading ? 4 : 0), 0, z + (reading ? 3 : 0)); hero.position.copy(engine.player.position);
                if (id === 'keepers-empty-house') {
                    // Review from the actual open-front inspection approach,
                    // not with the prepared hero standing inside the diary table.
                    engine.player.position.z += 4.1; hero.position.copy(engine.player.position);
                }
                render.setZoom(15); render.setCameraTarget(engine.player.position); render.setSceneryFocus(engine.player.position);
                render.applyLightingPreset(site.region || 'earth', true);
                // Match the runtime's player-following sun/shadow frame, not
                // a static light left at the world origin between visits.
                render.updateEnvironmentLighting(engine.player.position, 0);
                world.updateTownPresentation(1 / 60, engine.player.position); render.render();
                const stats = { id, calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles,
                    geometries: render.renderer.info.memory.geometries, textures: render.renderer.info.memory.textures,
                    shadowFocusError: render.shadowTarget.distanceTo(engine.player.position) };
                const gateViews = {
                    'verdant-approach': ['verdant_bastion_catacombs', [800, 6, 232.19]],
                    'molten-approach': ['molten_core', [-2367.51, 6.6, 200]],
                    'abyssal-approach': ['abyssal_well', [0, 6.3, -1377.91]],
                    'spire-muster': ['tempest_spire', [2378.91, 6.6, 200]]
                };
                if (gateViews[id]) {
                    const [dungeonType, portalPosition] = gateViews[id];
                    const gatePoint = new THREE.Vector3(...portalPosition).project(render.camera);
                    const ray = new THREE.Raycaster();
                    ray.setFromCamera(new THREE.Vector2(gatePoint.x, gatePoint.y), render.camera);
                    const hit = ray.intersectObjects(render.instanceEnvironmentGroup.children, true)
                        .find(hit => hit.object.visible && hit.object.material?.visible !== false);
                    let target = hit?.object;
                    while (target && !target.userData.proceduralDungeonEntrance) target = target.parent;
                    stats.gateInView = Math.abs(gatePoint.x) < .95 && Math.abs(gatePoint.y) < .95;
                    stats.gateProjection = gatePoint.toArray();
                    stats.gateHit = target?.userData.dungeonType;
                    stats.portalHit = Boolean(hit?.object.userData.portalSurface);
                    stats.approachBlocked = Boolean(collision.checkCollision(engine.player.position, 1.25));
                    if (!stats.gateInView || stats.gateHit !== dungeonType ||
                        (id !== 'verdant-approach' && !stats.portalHit) || stats.approachBlocked) {
                        throw new Error(`Unreadable or blocked dungeon arrival: ${JSON.stringify(stats)}`);
                    }
                }
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
                if (id === 'first-road-encounter') {
                    const cart = render.instanceEnvironmentGroup.getObjectByName('Lanternhold stranded supply cart');
                    const point = cart.localToWorld(new THREE.Vector3(0, 1.6, 0)).project(render.camera);
                    stats.cartInView = Math.abs(point.x) < .85 && Math.abs(point.y) < .85 && Math.abs(point.z) < 1;
                    if (!stats.cartInView) throw new Error(`Starter cart out of view: ${point.toArray()}`);
                }
                if (id === 'keepers-empty-house') {
                    const diary = new THREE.Vector3(site.x, 1.5, site.z).project(render.camera);
                    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(diary.x, diary.y), render.camera);
                    const hit = ray.intersectObjects([render.instanceEnvironmentGroup, render.entityGroup], true)
                        .find(hit => hit.object.visible);
                    stats.diaryHit = hit?.object.userData.entityId;
                    if (stats.diaryHit !== 'chronicle-site-mara_diary') throw new Error(`Diary approach obscured: ${JSON.stringify(stats)}`);
                }
                samples.push(stats); return stats;
            };
            let airShot = null, impactActor = null, attackActor = null, contactFeedback = null;
            // A bounded input/render fixture, not a network cast or damage test.
            // Server travel/hit regression is separately exercised in Go.
            const { Projectile } = await import('/src/entities/Projectile.js');
            engine.inputManager.subscribe('onRightClick', () => {
                if (elemental !== 'air') return;
                airShot?.dispose();
                const target = engine.inputManager.getGroundIntersection().clone();
                target.y = 1.5;
                airShot = new Projectile('air-visual-review', { isMultiplayer: true, stats: { intelligence: 20 } },
                    'Fireball', engine.player.position.clone().setY(1.5), target);
                render.entityGroup.add(airShot.mesh);
            });
            window.__populatedWorld = { visit, engine, samples,
                reviewWind() {
                    visit('first-grove-arch');
                    if (!windUniforms) throw new Error('No production understory shader compiled in grove');
                    const beforeRender = windMaterial.onBeforeRender;
                    const canvas = document.createElement('canvas');
                    canvas.width = render.renderer.domElement.width; canvas.height = render.renderer.domElement.height;
                    const context = canvas.getContext('2d', { willReadFrequently: true });
                    const frames = [];
                    try {
                        for (const seconds of [0, 1.25]) {
                            windMaterial.onBeforeRender = () => { beforeRender(); windUniforms.woodlandTime.value = seconds; };
                            render.render(); context.drawImage(render.renderer.domElement, 0, 0);
                            frames.push(context.getImageData(0, 0, canvas.width, canvas.height).data);
                        }
                    } finally { windMaterial.onBeforeRender = beforeRender; }
                    let changed = 0;
                    for (let i = 0; i < frames[0].length; i += 4) {
                        if (Math.max(...[0, 1, 2].map(c => Math.abs(frames[0][i + c] - frames[1][i + c]))) > 3) changed++;
                    }
                    return { changed, motion: windUniforms.woodlandMotion.value,
                        calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles };
                },
                async reviewBasicAttack(fraction) {
                    // Prepared timeline samples on the actual world renderer,
                    // not server damage or earned gameplay evidence.
                    if (!attackActor) {
                        attackActor = new Actor('basic-contact-review', {});
                        attackActor.meshType = 'Fighter';
                        attackActor.position.copy(engine.player.position);
                        await attackActor.ensureMesh(); render.entityGroup.add(attackActor.mesh);
                        attackActor.mesh.position.copy(attackActor.position);
                        hero.visible = false;
                        impactActor.position.copy(engine.player.position).add(new THREE.Vector3(-2.4, 0, 2.4));
                        impactActor.mesh.position.copy(impactActor.position);
                        attackActor.mesh.lookAt(impactActor.position);
                        attackActor.rotation.copy(attackActor.mesh.quaternion);
                    }
                    attackActor.stats.attackSpeed = 1.8;
                    attackActor.setAttackingState();
                    attackActor.mixer.update(1.8 * fraction);
                    contactFeedback?.dispose(); contactFeedback = null;
                    impactActor.hitReaction?.update(1);
                    if (fraction >= .35) {
                        const { GameEngine } = await import('/src/core/GameEngine.js');
                        const { createTransientEffect } = await import('/src/core/TransientEffects.js');
                        const feedbackEngine = { player: attackActor, remotePlayers: new Map([[impactActor.id, impactActor]]),
                            isPlayerClassEntity: GameEngine.prototype.isPlayerClassEntity, isNearbyCombatEvent: () => true,
                            resolveCombatFeedbackKind: GameEngine.prototype.resolveCombatFeedbackKind,
                            spawnTransientEffect(type, position, color, options) {
                                contactFeedback = createTransientEffect(render.effectGroup, type, position, color, { ...options, quality });
                                return Boolean(contactFeedback);
                            } };
                        GameEngine.prototype.renderCombatFeedback.call(feedbackEngine, {
                            sourceId: attackActor.id, targetId: impactActor.id, kind: 'physical', amount: 25
                        });
                        const elapsed = (fraction - .35) * 1.8;
                        contactFeedback.update(elapsed); impactActor.hitReaction?.update(elapsed);
                    }
                    render.render();
                    return { chestYaw: attackActor.mesh.getObjectByName('Rig_Chest').rotation.y,
                        stationaryRoot: attackActor.position.equals(engine.player.position),
                        feedbackActive: Boolean(contactFeedback?.isActive),
                        impactSeconds: attackActor.mesh.userData.basicAttackContactTime /
                            attackActor.animations.Attack.getEffectiveTimeScale() };
                },
                endBasicAttackReview() {
                    contactFeedback?.dispose(); contactFeedback = null;
                    attackActor?.dispose(); attackActor = null; hero.visible = true;
                    impactActor.position.copy(engine.player.position).add(new THREE.Vector3(-4, 0, 5));
                    impactActor.mesh.position.copy(impactActor.position);
                },
                async reviewImpact(dt) {
                    if (!impactActor) {
                        visit('first-grove-arch');
                        impactActor = new Actor('impact-review', {});
                        impactActor.meshType = 'Skeleton';
                        // Keep the review encounter in the open approach, not
                        // hidden behind the arch's near pier at this camera.
                        impactActor.position.copy(engine.player.position).add(new THREE.Vector3(-4, 0, 5));
                        await impactActor.ensureMesh();
                        render.entityGroup.add(impactActor.mesh);
                        impactActor.mesh.position.copy(impactActor.position);
                        impactActor.playHitReaction(engine.player.position, 25);
                    }
                    impactActor.hitReaction.update(dt);
                    render.render();
                    return { angle: impactActor.hitReaction.pivot.quaternion.angleTo(new THREE.Quaternion()),
                        stationaryHitbox: impactActor.mesh.getObjectByName('ActorInteractionHitbox').parent === impactActor.mesh };
                },
                prepareAirShot(x) {
                    airShot?.dispose(); airShot = null;
                    engine.player.position.set(x, 0, 200); hero.position.copy(engine.player.position);
                    render.setZoom(15); render.setCameraTarget(engine.player.position); render.setSceneryFocus(engine.player.position);
                    render.applyLightingPreset('air', true); render.render(); render.camera.updateMatrixWorld(true);
                    const target = new THREE.Vector3(x + 8, 0, 200).project(render.camera);
                    const bounds = render.renderer.domElement.getBoundingClientRect();
                    return { x: bounds.x + (target.x + 1) * bounds.width / 2,
                        y: bounds.y + (1 - target.y) * bounds.height / 2 };
                }, advanceAirShot() {
                    if (!airShot) return null;
                    const aim = engine.inputManager.getGroundIntersection().clone();
                    airShot.update(.25, null, null, null, null, engine); render.render();
                    const projected = airShot.position.clone().project(render.camera);
                    return { aim: aim.toArray(), position: airShot.position.toArray(), active: airShot.isActive,
                        visible: airShot.mesh.visible, projected: projected.toArray(),
                        travel: airShot.position.distanceTo(engine.player.position.clone().setY(1.5)) };
                }, diagnoseDraws() {
                    const counts = new Map(), originals = [];
                    const boundaries = [render.scene, render.instanceEnvironmentGroup, render.staticEnvironmentGroup, render.entityGroup];
                    render.scene.traverse(mesh => {
                        if (!mesh.isMesh) return;
                        let root = mesh;
                        while (root.parent && !boundaries.includes(root.parent)) root = root.parent;
                        const name = root.name || root.type;
                        if (!counts.has(name)) counts.set(name, { name, color: 0, shadow: 0 });
                        const entry = counts.get(name), color = mesh.onBeforeRender, shadow = mesh.onBeforeShadow;
                        originals.push({ mesh, color, shadow });
                        mesh.onBeforeRender = function(...args) { entry.color++; return color.apply(this, args); };
                        mesh.onBeforeShadow = function(...args) { entry.shadow++; return shadow.apply(this, args); };
                    });
                    try {
                        render.render();
                        return [...counts.values()].filter(entry => entry.color + entry.shadow)
                            .sort((a, b) => b.color + b.shadow - a.color - a.shadow);
                    } finally {
                        originals.forEach(({ mesh, color, shadow }) => { mesh.onBeforeRender = color; mesh.onBeforeShadow = shadow; });
                    }
                }, async profile() {
                const profiles = [];
                const profileSites = elemental === 'air' ? ['open-observatory', 'spire-muster', 'horizon-orrery', 'weatherkeepers-bivouac'] :
                    elemental === 'water-fire' ? ['flood-shelter', 'stranded-flotilla', 'tide-rib', 'kiln-span', 'communal-kiln', 'quenched-foundry'] :
                        ['lanternhold-common-well', 'lanternhold-menders-yard', 'lanternhold-trading-roof', 'foresters-yard', 'returning-scar', 'first-grove-arch'];
                for (const id of profileSites) {
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
                const resources = () => ({ geometries: render.renderer.info.memory.geometries,
                    textures: render.renderer.info.memory.textures, programs: render.renderer.info.programs.length });
                const beforeRepeat = resources();
                for (const id of profileSites) visit(id);
                const afterRepeat = resources();
                const gl = render.renderer.getContext(), extension = gl.getExtension('WEBGL_debug_renderer_info');
                return { renderer: gl.getParameter(extension ? extension.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
                    userAgent: navigator.userAgent, quality, mobile, beforeRepeat, afterRepeat, profiles };
            }, dispose() {
                contactFeedback?.dispose(); attackActor?.dispose(); impactActor?.dispose();
                airShot?.dispose();
                readings.forEach(r => r.dispose()); portal.dispose(); engine.inputManager.dispose();
                hero.removeFromParent(); MeshFactory.releaseMesh('Fighter', hero);
                render.clearInstanceScene(); render.dispose();
            } };
            return sites.map(s => s.id);
        }, { quality, mobile: width < 600, elemental });
        try {
            for (const id of locations) {
                const stats = await page.evaluate(id => window.__populatedWorld.visit(id), id);
                await page.screenshot({ path: testInfo.outputPath(`${id}.png`) });
                expect(stats.calls).toBeGreaterThan(0);
                expect(stats.shadowFocusError).toBeLessThan(1);
                if (stats.readingHit !== undefined || ['bellkeepers-cairn', 'unbound-milestone', 'soundings-stone', 'unclaimed-names', 'commons-register', 'counterseal-stone', 'unsent-dispatch', 'unmeasured-sky'].includes(id)) {
                    expect(stats.readingHit, JSON.stringify(stats)).toBe(`world-reading-${id}`);
                    expect(stats.approachBlocked).toBe(false);
                    await page.keyboard.press('e');
                    await expect(page.locator('#world-reading-dialog')).toBeVisible();
                    await page.getByRole('button', { name: 'Close reading' }).click();
                    await expect(page.locator('#world-reading-dialog')).toHaveCount(0);
                }
            }
            if (elemental === 'earth') {
                for (const [phase, dt] of [['before', 0], ['contact', .045], ['settled', .3]]) {
                    const result = await page.evaluate(dt => window.__populatedWorld.reviewImpact(dt), dt);
                    expect(result.stationaryHitbox).toBe(true);
                    if (phase === 'contact') expect(result.angle).toBeGreaterThan(.05);
                    else expect(result.angle).toBe(0);
                    await page.screenshot({ path: testInfo.outputPath(`earth-impact-${phase}.png`) });
                }
                for (const [phase, fraction] of [['ready', 0], ['windup', .2], ['contact', .35], ['impact', .37], ['recovery', .85]]) {
                    const result = await page.evaluate(fraction => window.__populatedWorld.reviewBasicAttack(fraction), fraction);
                    expect(result.stationaryRoot).toBe(true);
                    expect(result.impactSeconds).toBeCloseTo(1.8 * .35, 5);
                    if (phase === 'contact') expect(result.chestYaw).toBeCloseTo(.65, 4);
                    expect(result.feedbackActive).toBe(['contact', 'impact'].includes(phase));
                    await page.screenshot({ path: testInfo.outputPath(`earth-basic-${phase}.png`) });
                }
                await page.evaluate(() => window.__populatedWorld.endBasicAttackReview());
                const moving = await page.evaluate(() => window.__populatedWorld.reviewWind());
                expect(moving.motion).toBe(1);
                expect(moving.changed).toBeGreaterThan(20);
                await page.screenshot({ path: testInfo.outputPath('grove-wind.png') });
                await page.emulateMedia({ reducedMotion: 'reduce' });
                const still = await page.evaluate(() => window.__populatedWorld.reviewWind());
                expect(still.motion).toBe(0);
                expect(still.changed).toBe(0);
                expect(still.calls).toBe(moving.calls);
                expect(still.triangles).toBe(moving.triangles);
                await page.emulateMedia({ reducedMotion: 'no-preference' });
                await writeFile(testInfo.outputPath('understory-wind.json'), JSON.stringify({ moving, still }, null, 2));
            }
            const result = await page.evaluate(() => ({ samples: window.__populatedWorld.samples, sent: window.__populatedWorld.engine.sent }));
            expect(result.sent).toEqual([]);
            if (elemental === 'air') for (const x of [1010, 2850]) {
                const target = await page.evaluate(x => window.__populatedWorld.prepareAirShot(x), x);
                expect(target.x).toBeGreaterThan(0); expect(target.x).toBeLessThan(width);
                expect(target.y).toBeGreaterThan(0); expect(target.y).toBeLessThan(844);
                await page.mouse.click(target.x, target.y, { button: 'right' });
                const shot = await page.evaluate(() => window.__populatedWorld.advanceAirShot());
                expect(shot).not.toBeNull();
                expect(Math.hypot(shot.aim[0] - x - 8, shot.aim[2] - 200)).toBeLessThan(.25);
                expect(shot.position[1]).toBeCloseTo(1.5, 5);
                expect(shot.travel).toBeCloseTo(5, 4);
                expect(shot.active).toBe(true); expect(shot.visible).toBe(true);
                expect(shot.projected.every(v => Number.isFinite(v) && Math.abs(v) <= 1)).toBe(true);
                await page.screenshot({ path: testInfo.outputPath(`air-fireball-${x}.png`) });
            }
            const countsPath = testInfo.outputPath('scene-counts.json');
            await writeFile(countsPath, JSON.stringify(result.samples, null, 2));
            await testInfo.attach('scene-counts', { path: countsPath, contentType: 'application/json' });
            // Opt-in local hardware acceptance; shared CI is not a comparable
            // frame-time environment. No busy loop, uncapped render or GPU finish.
            if (elemental === 'earth' && process.env.EIDOLON_E2E_POPULATION_DIAGNOSE === '1') {
                const breakdown = await page.evaluate(() => ['lanternhold-common-well', 'returning-scar', 'first-grove-arch'].map(id => {
                    window.__populatedWorld.visit(id);
                    return { id, draws: window.__populatedWorld.diagnoseDraws() };
                }));
                await writeFile(testInfo.outputPath('draw-breakdown.json'), JSON.stringify(breakdown, null, 2));
            }
            if (process.env.EIDOLON_E2E_POPULATION_PROFILE === '1') {
                const profile = await page.evaluate(() => window.__populatedWorld.profile());
                const path = testInfo.outputPath('frame-profile.json');
                await writeFile(path, JSON.stringify(profile, null, 2));
                await testInfo.attach('frame-profile', { path, contentType: 'application/json' });
                expect(profile.renderer).not.toMatch(/SwiftShader|llvmpipe/i);
                expect(profile.afterRepeat).toEqual(profile.beforeRepeat);
                for (const view of profile.profiles) {
                    expect(view.median, `${view.id} median`).toBeLessThanOrEqual(quality === 'high' ? 20 : 33.4);
                    expect(view.p95, `${view.id} p95`).toBeLessThanOrEqual(quality === 'high' ? 33.4 : 50);
                    expect(view.calls, `${view.id} calls`).toBeLessThanOrEqual(quality === 'high' ? 350 : 200);
                    expect(view.triangles, `${view.id} triangles`).toBeLessThanOrEqual(quality === 'high' ? 250000 : 85000);
                }
            }
            expect(failures, failures.join('\n')).toEqual([]);
        } finally { await page.evaluate(() => window.__populatedWorld.dispose()); }
    });
}
