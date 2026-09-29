import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

// An isolated integration preview. Live movement/scenery still use level ground;
// this does not establish a complete elevated world or physical-phone acceptance.
for (const [quality, width] of [['high', 1280], ['low', 390]]) test(`Earth elevation preview uses the sampled surface: ${quality}`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const result = await page.evaluate(async quality => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { MeshFactory } = await import('/src/utils/MeshFactory.js');
        const { Actor } = await import('/src/entities/Actor.js');
        const { Projectile } = await import('/src/entities/Projectile.js');
        const { AttachedStatusEffect } = await import('/src/entities/AttachedStatusEffect.js');
        const { SpiritGuardiansEffect } = await import('/src/entities/SpiritGuardiansEffect.js');
        const { GameEngine } = await import('/src/core/GameEngine.js');
        const { InputManager } = await import('/src/core/InputManager.js');
        const { TouchAbilityAim } = await import('/src/core/TouchAbilityAim.js');
        const { intersectEngineGround } = await import('/src/core/WorldGrounding.js');
        const { installGameEngineMovement } = await import('/src/core/GameEngineMovement.js');
        const { EARTH_ELEVATION: field } = await import('/src/data/worldElevation.js');
        const { WORLD_REGIONS } = await import('/src/data/worldGeography.js');
        const { createRealmGroundGeometry } = await import('/src/art/RealmGroundGeometry.js');
        const { WorldGenerator } = await import('/src/world/WorldGenerator.js');
        const { EARTH_OUTCROP_PROFILE } = await import('/src/data/earthOutcrops.js');
        const { CollisionManager } = await import('/src/core/CollisionManager.js');
        document.getElementById('start-screen').style.display = 'none';
        const render = new RenderSystem(quality === 'low'); render.setGraphicsQuality(quality);
        await render.preloadEnvironment();
        const previousGeometry = render.groundEarth.geometry;
        render.groundEarth.geometry = createRealmGroundGeometry(WORLD_REGIONS.earth, .75, field);
        previousGeometry.dispose();
        const focus = new THREE.Vector3(-120, field.sample(-120, -187), -187);
        class MovementPreview {}
        installGameEngineMovement(MovementPreview);
        const engine = new MovementPreview();
        engine.terrainElevation = field; engine.currentInstanceId = '';
        engine.abilityController = {}; engine.playAudioCue = () => {};
        engine.renderSystem = render; engine.uiManager = {};
        const input = new InputManager(render.camera, render.scene, render.renderer.domElement);
        engine.inputManager = input;
        input.groundIntersectionResolver = (ray, target, plane) => intersectEngineGround(engine, ray, target, plane);
        const actor = new Actor('elevation-preview', {});
        engine.player = actor; actor.gameEngine = engine;
        actor.position.copy(focus).setY(0); // Exercise grounding of an old level-ground position.
        actor.setMesh(await MeshFactory.createMeshForType('Fighter'));
        actor.update(0); actor.resetTransformInterpolation(); actor.render(1);
        render.entityGroup.add(actor.mesh);
        // Exercise production generation, not fixture-only placement matrices.
        const scenery = new THREE.Group(); render.entityGroup.add(scenery);
        const world = new WorldGenerator(scenery, new CollisionManager(), { terrainElevation: field,
            terrainProfile: EARTH_OUTCROP_PROFILE, graphicsQuality: quality });
        await world.loadTrees(0, 200); await world.loadBuildings(0, 200);
        // The negotiated production generator owns both render and collision.
        const outcrops = scenery.getObjectByName('Earth exposed rock shelves');
        let outcropDraws = 0;
        outcrops.children.forEach(mesh => { mesh.onBeforeRender = () => { outcropDraws++; }; });
        let treeCount = 0, treeDraws = 0, pathDraws = 0, raisedPathTriangles = 0;
        for (const group of scenery.children.filter(g => g.userData.region === 'earth' && g.userData.proceduralFoliage)) {
            treeCount += group.userData.instanceCount;
            group.children.forEach(mesh => { mesh.onBeforeRender = () => { treeDraws++; }; });
        }
        scenery.traverse(mesh => {
            if (!mesh.userData.worldPathId) return;
            mesh.onBeforeRender = () => { pathDraws++; };
            if (mesh.parent.name === 'Earth authored paths') raisedPathTriangles += mesh.geometry.attributes.position.count / 3;
        });
        render.setZoom(18); render.setCameraTarget(focus); render.applyLightingPreset('earth', true);
        render.updateEnvironmentLighting(focus, 0); render.render(); render.render();
        let movementError = 0, jumpError = 0;
        actor.stats.speed = 12;
        actor.move(focus.clone().add(new THREE.Vector3(18, 999, -15)));
        for (let frame = 0; frame < 60; frame++) {
            actor.capturePreviousTransform(); actor.update(.05); actor.render(.5);
            movementError = Math.max(movementError,
                Math.abs(actor.position.y - field.sample(actor.position.x, actor.position.z)),
                Math.abs(actor.mesh.position.y - field.sample(actor.mesh.position.x, actor.mesh.position.z)));
            if (frame % 10 === 0) render.render();
        }
        const walked = Math.hypot(actor.position.x - focus.x, actor.position.z - focus.z);
        const jumpStarted = engine.startPlayerJump(focus);
        const jump = engine.playerJumpState;
        for (let step = 1; step <= 8; step++) {
            engine.updatePlayerJump(step === 8 ? jump.duration - jump.elapsed : jump.duration / 8);
            if (engine.playerJumpState) {
                engine.applyEntityJumpVisuals(actor, jump);
                jumpError = Math.max(jumpError, Math.abs(actor.mesh.position.y -
                    field.sample(actor.mesh.position.x, actor.mesh.position.z) - Math.sin(jump.progress * Math.PI) * jump.height));
                render.render();
            }
        }
        actor.resetTransformInterpolation(); actor.render(1); render.render();
        render.camera.updateMatrixWorld(true);
        const projected = focus.clone().project(render.camera);
        const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(projected.x, projected.y), render.camera);
        let picked;
        input.subscribe('onClick', event => { picked = input.getGroundIntersectionFromEvent(event)?.clone(); });
        render.renderer.domElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0,
            clientX: (projected.x + 1) / 2 * innerWidth, clientY: (1 - projected.y) / 2 * innerHeight }));
        window.dispatchEvent(new MouseEvent('mouseup', { button: 0 }));
        const visibleSurface = ray.intersectObject(render.groundEarth)[0].point;
        actor.abilityName = 'Fireball';
        engine.abilityController.canGroundAim = () => true;
        engine.abilityController.getAbilityCastRange = () => 12;
        const button = document.getElementById('btn-mobile-ability');
        const aim = new TouchAbilityAim(engine);
        const touch = (type, x, target) => {
            const event = new Event(type, { bubbles: true, cancelable: true });
            Object.defineProperty(event, 'changedTouches', { value: [{ identifier: 7, clientX: x, clientY: 200 }] });
            target.dispatchEvent(event);
        };
        touch('touchstart', 100, button); touch('touchmove', 180, window);
        const aimed = aim.gesture.target;
        render.render();
        let aimVertexError = 0;
        for (const line of [aim.rangeRing, aim.aimLine, aim.endpoint]) {
            const vertices = line.geometry.attributes.position;
            for (let i = 0; i < vertices.count; i++) {
                const point = new THREE.Vector3().fromBufferAttribute(vertices, i).applyMatrix4(line.matrixWorld);
                aimVertexError = Math.max(aimVertexError, Math.abs(point.y - field.sample(point.x, point.z) - .12));
            }
        }
        aim.cancel();
        engine.uiManager.getGraphicsQuality = () => quality;
        engine.effects = [];
        GameEngine.prototype.spawnTransientEffect.call(engine, 'telegraph', focus.clone().add(new THREE.Vector3(-4, 0, -4)), 0xff2200,
            { radius: 8, telegraphDuration: 2, threatTier: 'danger' });
        const warning = engine.effects[0];
        const start = focus.clone().add(new THREE.Vector3(-9, 0, 3));
        start.y = field.sample(start.x, start.z) + 1.5;
        const shot = new Projectile('hill-fireball', actor, 'Fireball', start, start.clone().add(new THREE.Vector3(20, 0, 0)));
        shot.serverAuthoritativeLifetime = true;
        let projectileDraws = 0, projectileError = 0;
        shot.mesh.traverse(mesh => { if (mesh.isMesh) mesh.onBeforeRender = () => { projectileDraws++; }; });
        render.entityGroup.add(shot.mesh);
        engine.isMultiplayer = true;
        for (let step = 0; step < 12; step++) {
            shot.capturePreviousTransform();
            shot.update(.05, null, null, { getActiveEntities: () => [] }, null, engine);
            shot.render(.5); warning.update(.05); render.render();
            projectileError = Math.max(projectileError, Math.abs(shot.mesh.position.y - field.sample(shot.mesh.position.x, shot.mesh.position.z) - 1.5));
        }
        let warningError = 0;
        for (const [mesh, offset] of [[warning.meshes[0], .16], [warning.meshes[1], .15]]) {
            const vertices = mesh.geometry.attributes.position;
            for (let i = 0; i < vertices.count; i += 3) {
                const center = new THREE.Vector3();
                for (let j = 0; j < 3; j++) center.add(new THREE.Vector3().fromBufferAttribute(vertices, i+j).applyMatrix4(mesh.matrixWorld));
                center.divideScalar(3);
                warningError = Math.max(warningError, Math.abs(center.y - field.sample(center.x, center.z) - offset));
            }
        }
        warning.dispose(); shot.dispose();
        const areas = [];
        let areaDraws = 0, areaSurfaceError = 0;
        for (const [type, dx, dz, scale, lift] of [
            ['ZoneHoly', 9, 4, 1.2, .1], ['ZoneDamage', -10, -9, 1.2, .1], ['Tripwire', 3, -8, 1, .1]
        ]) {
            const p = focus.clone().add(new THREE.Vector3(dx, 0, dz));
            p.y = field.sample(p.x, p.z) + lift;
            const area = new Projectile(`hill-${type}`, actor, type, p);
            area.setScale(scale); area.serverAuthoritativeLifetime = true;
            render.entityGroup.add(area.mesh);
            area.mesh.traverse(mesh => { if (mesh.isMesh) mesh.onBeforeRender = () => { areaDraws++; }; });
            areas.push(area);
        }
        for (let frame = 0; frame < 12; frame++) {
            for (const area of areas) {
                area.update(.05, null, null, { getActiveEntities: () => [] }, null, engine); area.render(1);
            }
            render.render();
            for (const area of areas) for (const { part } of area.groundPresentation.surfaces) {
                const vertices = part.geometry.attributes.position;
                let lift;
                for (let i = 0; i < vertices.count; i += 3) {
                    const center = new THREE.Vector3();
                    for (let j = 0; j < 3; j++) center.add(new THREE.Vector3().fromBufferAttribute(vertices, i+j).applyMatrix4(part.matrixWorld));
                    center.divideScalar(3);
                    const height = center.y - field.sample(center.x, center.z);
                    lift ??= height;
                    areaSurfaceError = Math.max(areaSurfaceError, Math.abs(height - lift));
                }
            }
        }
        areas.forEach(area => area.dispose());
        const impacts = [];
        let impactDraws = 0, impactSurfaceError = 0;
        for (const [type, dx, dz, radius] of [['Fireball', 9, 4, 6], ['Meteor', -10, -9, 10]]) {
            const point = focus.clone().add(new THREE.Vector3(dx, 0, dz));
            point.y = field.sample(point.x, point.z) + 2;
            GameEngine.prototype.spawnTransientEffect.call(engine, 'projectile_impact', point, 0xffffff,
                { projectileType: type, radius, direction: new THREE.Vector3(1, 0, .5), terminal: true });
            const effect = engine.effects.at(-1);
            effect.root.traverse(part => { if (part.isMesh) part.onBeforeRender = () => { impactDraws++; }; });
            impacts.push(effect);
        }
        for (let step = 0; step < 3; step++) {
            impacts.forEach(effect => effect.update(.15)); render.render();
            for (const effect of impacts) for (const entry of effect.groundPresentation.surfaces) {
                const vertices = entry.part.geometry.attributes.position;
                for (let i = 0; i < vertices.count; i += 3) {
                    const center = new THREE.Vector3();
                    for (let j = 0; j < 3; j++) center.add(new THREE.Vector3().fromBufferAttribute(vertices, i+j).applyMatrix4(entry.part.matrixWorld));
                    center.divideScalar(3);
                    impactSurfaceError = Math.max(impactSurfaceError,
                        Math.abs(center.y - field.sample(center.x, center.z) - .1 - entry.position.y));
                }
            }
        }
        impacts.forEach(effect => effect.dispose());
        const beamTarget = actor.position.clone().add(new THREE.Vector3(25, 0, -12));
        GameEngine.prototype.spawnTransientEffect.call(engine, 'beam', beamTarget, 0xffaa00,
            { source: actor, abilityClass: 'Wizard', abilityName: 'Scorch Beam', authoritativeEndpoint: true });
        const beam = engine.effects.at(-1);
        let beamDraws = 0;
        const beamParts = beam.root.children.filter(part => part.terrainBeam);
        beamParts.forEach(part => { part.onBeforeRender = () => { beamDraws++; }; });
        for (let step = 0; step < 3; step++) { beam.update(.08); render.render(); }
        beam.dispose();
        const rested = new AttachedStatusEffect(render.effectGroup, actor, 'well_rested', { quality });
        actor.guardianEmbraceRadius = 10;
        const embrace = new AttachedStatusEffect(render.effectGroup, actor, 'guardian_embrace', { quality });
        const guardians = new SpiritGuardiansEffect(render.effectGroup, actor, { quality });
        let attachedDraws = 0;
        for (const effect of [rested, embrace, guardians]) {
            effect.group.traverse(part => { if (part.isMesh) part.onBeforeRender = () => { attachedDraws++; }; });
        }
        for (let step = 0; step < 3; step++) {
            rested.update(.1); embrace.update(.1); guardians.update(.1); render.render();
        }
        const understory = scenery.getObjectByName('Gloamwood heath and fern beds');
        const dressed = { calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles };
        understory.visible = false; render.render();
        const understoryCost = { calls: dressed.calls - render.renderer.info.render.calls,
            triangles: dressed.triangles - render.renderer.info.render.triangles,
            plants: understory.userData.plantCount };
        understory.visible = true; render.render();
        let reviewWarning = null;
        window.__reviewEarthAuraDanger = () => {
            GameEngine.prototype.spawnTransientEffect.call(engine, 'telegraph', actor.position.clone().add(new THREE.Vector3(-4, 0, -4)), 0xff2200,
                { radius: 8, telegraphDuration: 2, threatTier: 'danger' });
            reviewWarning = engine.effects.at(-1);
            reviewWarning.update(.65); render.render();
        };
        // Additional composition view only. It does not replace the movement,
        // ground picking and combat-effect checks above or assert gameplay here.
        window.__reviewEarthShoulder = (x = -75, z = -330) => {
            reviewWarning?.dispose();
            for (const effect of [rested, embrace, guardians]) effect.group.visible = false;
            actor.position.set(x, field.sample(x, z), z);
            actor.resetTransformInterpolation(); actor.render(1);
            render.setCameraTarget(actor.position);
            render.updateEnvironmentLighting(actor.position, 0);
            render.render(); render.render();
        };
        return { treeCount, treeDraws, pathDraws, raisedPathTriangles, groundHeight: focus.y, pickedError: picked.distanceTo(focus),
            attachedDraws, understoryCost, outcropDraws,
            beamDraws, beamParts: beamParts.length,
            impactDraws, impactSurfaceError,
            areaDraws, areaSurfaceError,
            projectileDraws, projectileError, warningError,
            aimVertexError, aimTargetError: Math.abs(aimed.y - field.sample(aimed.x, aimed.z)),
            aimRange: Math.hypot(aimed.x - actor.position.x, aimed.z - actor.position.z),
            movementError, jumpError, walked, jumpStarted, landed: !engine.playerJumpState && actor.state === 'IDLE',
            surfaceError: picked.distanceTo(visibleSurface), calls: render.renderer.info.render.calls,
            triangles: render.renderer.info.render.triangles, maxGrade: field.maxGrade };
    }, quality);
    await testInfo.attach('elevation-preview', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
    console.log(`[understory ${quality}] ${JSON.stringify(result.understoryCost)}`);
    expect(result.understoryCost.calls).toBeGreaterThan(0);
    expect(result.outcropDraws).toBeGreaterThan(0);
    await page.screenshot({ path: testInfo.outputPath('grove-elevation-preview.png') });
    await page.evaluate(() => window.__reviewEarthAuraDanger());
    await page.screenshot({ path: testInfo.outputPath('grove-aura-danger-hierarchy.png') });
    await page.evaluate(() => window.__reviewEarthShoulder());
    await page.screenshot({ path: testInfo.outputPath('grove-bedrock-shoulder.png') });
    await page.evaluate(() => window.__reviewEarthShoulder(-94, -313));
    await page.screenshot({ path: testInfo.outputPath('grove-rock-formation.png') });
    expect(result.treeCount).toBeGreaterThan(0);
    expect(result.attachedDraws).toBeGreaterThan(0);
    expect(result.beamDraws).toBeGreaterThan(0);
    expect(result.beamParts).toBe(2);
    expect(result.impactDraws).toBeGreaterThan(0);
    expect(result.impactSurfaceError).toBeLessThan(.0001);
    expect(result.areaDraws).toBeGreaterThan(0);
    expect(result.areaSurfaceError).toBeLessThan(.0001);
    expect(result.projectileDraws).toBeGreaterThan(0);
    expect(result.projectileError).toBeLessThan(.00001);
    expect(result.warningError).toBeLessThan(.0001);
    expect(result.treeDraws).toBeGreaterThan(0);
    expect(result.pathDraws).toBeGreaterThan(0);
    expect(result.raisedPathTriangles).toBeGreaterThan(0);
    expect(result.raisedPathTriangles).toBeLessThan(15000);
    expect(result.groundHeight).toBeGreaterThan(1);
    expect(result.pickedError).toBeLessThan(.0001);
    expect(result.surfaceError).toBeLessThan(.0002);
    expect(result.aimVertexError).toBeLessThan(.00001);
    expect(result.aimTargetError).toBeLessThan(.00001);
    expect(result.aimRange).toBeCloseTo(12, 6);
    expect(result.maxGrade).toBeLessThanOrEqual(.35);
    expect(result.walked).toBeGreaterThan(20);
    expect(result.movementError).toBeLessThan(.00001);
    expect(result.jumpError).toBeLessThan(.00001);
    expect(result.jumpStarted && result.landed).toBe(true);
    expect(failures, failures.join('\n')).toEqual([]);
});
