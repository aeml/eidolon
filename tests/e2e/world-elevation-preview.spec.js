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
        const { WOODLAND_WIND_REACH } = await import('/src/art/WoodlandWindMaterial.js');
        const { computeFoliageCellBounds } = await import('/src/art/FoliageRenderBatches.js');
        const { mergeGeometries } = await import('three/addons/utils/BufferGeometryUtils.js');
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
        const { createRealmGroundMesh } = await import('/src/art/RealmGroundMesh.js');
        const { createRealmGroundGeometry } = await import('/src/art/RealmGroundGeometry.js');
        const { WorldGenerator } = await import('/src/world/WorldGenerator.js');
        const { EARTH_OUTCROP_PROFILE } = await import('/src/data/earthOutcrops.js');
        const { CollisionManager } = await import('/src/core/CollisionManager.js');
        document.getElementById('start-screen').style.display = 'none';
        const render = new RenderSystem(quality === 'low'); render.setGraphicsQuality(quality);
        await render.preloadEnvironment();
        const previousGround = render.groundEarth;
        render.groundEarth = createRealmGroundMesh(WORLD_REGIONS.earth, previousGround.material, field);
        render.groundEarth.position.copy(previousGround.position);
        render.groundEarth.quaternion.copy(previousGround.quaternion);
        previousGround.parent.add(render.groundEarth);
        previousGround.removeFromParent(); previousGround.geometry.dispose();
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
            return { height: actor.position.y, calls: render.renderer.info.render.calls,
                triangles: render.renderer.info.render.triangles };
        };
        // Optional missing raised-terrain evidence, not part of every CI run.
        // RAF intervals include real renderer work; do not use uncapped draws,
        // GPU finish, a fake clock or the flat-world performance receipt.
        window.__profileEarthTerrain = async () => {
            const frames = [];
            let previous, calls = 0, triangles = 0;
            for (let frame = 0; frame < 150; frame++) {
                const now = await new Promise(resolve => requestAnimationFrame(resolve));
                render.updateEnvironmentLighting(actor.position, 0);
                render.render();
                if (frame >= 30) {
                    frames.push(now - previous);
                    calls = Math.max(calls, render.renderer.info.render.calls);
                    triangles = Math.max(triangles, render.renderer.info.render.triangles);
                }
                previous = now;
            }
            frames.sort((a, b) => a - b);
            const gl = render.renderer.getContext(), info = gl.getExtension('WEBGL_debug_renderer_info');
            return { quality, frames: frames.length, median: frames[Math.floor(frames.length * .5)],
                p95: frames[Math.floor(frames.length * .95)], calls, triangles,
                renderer: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unavailable' };
        };
        // Reuse the populated-world draw-hook diagnostic outside timed samples.
        window.__diagnoseEarthTerrain = () => {
            const counts = new Map(), originals = [];
            const boundaries = [render.scene, render.staticEnvironmentGroup, render.entityGroup, scenery];
            render.scene.traverse(mesh => {
                if (!mesh.isMesh) return;
                let root = mesh;
                while (root.parent && !boundaries.includes(root.parent)) root = root.parent;
                const name = root.userData.tiledRealmGround ? 'Canonical terrain tiles' : root.name || root.type;
                if (!counts.has(name)) counts.set(name, {
                    name, color: 0, shadow: 0, triangles: 0, colorTriangles: 0, shadowTriangles: 0
                });
                const entry = counts.get(name), color = mesh.onBeforeRender, shadow = mesh.onBeforeShadow;
                const record = (pass, geometry, group) => {
                    entry[pass]++;
                    const count = group?.count ?? Math.min(geometry.drawRange.count,
                        geometry.index?.count ?? geometry.attributes.position.count);
                    const instances = mesh.isInstancedMesh ? mesh.count : geometry.isInstancedBufferGeometry ? geometry.instanceCount : 1;
                    const triangles = count / 3 * instances;
                    entry.triangles += triangles;
                    entry[`${pass}Triangles`] += triangles;
                };
                originals.push({ mesh, color, shadow });
                mesh.onBeforeRender = function(...args) { record('color', args[3], args[5]); return color.apply(this, args); };
                mesh.onBeforeShadow = function(...args) { record('shadow', args[4], args[6]); return shadow.apply(this, args); };
            });
            try {
                render.render();
                return [...counts.values()].filter(entry => entry.color + entry.shadow)
                    .sort((a, b) => b.triangles - a.triangles);
            } finally {
                originals.forEach(({ mesh, color, shadow }) => { mesh.onBeforeRender = color; mesh.onBeforeShadow = shadow; });
            }
        };
        window.__reviewFoliageShadows = () => {
            const controller = render.foliageShadowInfluence, enabledBefore = controller.enabled;
            const target = new THREE.WebGLRenderTarget(640, 422), pixels = [], costs = [];
            const previousTarget = render.renderer.getRenderTarget();
            const autoReset = render.renderer.info.autoReset;
            const wind = understory.children[0].material, updateWind = wind.onBeforeRender;
            const visibleBefore = understory.visible;
            const treeGroups = render.instanceEnvironmentGroup.children
                .filter(group => group.userData.proceduralFoliage && group.userData.region === 'earth')
                .map(group => ({ group, visible: group.visible }));
            let originalBatches = null;
            {
                // Rebatch the exact production matrices into the prior16m cells.
                // Share the same blade geometry/material/frozen wind; compare
                // actual pixels, not a separately generated placement recipe.
                originalBatches = new THREE.Group(); originalBatches.userData.earthUnderstory = true;
                const cells = new Map(), matrix = new THREE.Matrix4();
                for (const mesh of understory.children) for (let i = 0; i < mesh.count; i++) {
                    mesh.getMatrixAt(i, matrix);
                    const variant = mesh.name.split(':').at(-1);
                    const key = `${Math.floor(matrix.elements[12] / 16)}:${Math.floor(matrix.elements[14] / 16)}:${variant}`;
                    if (!cells.has(key)) cells.set(key, { source: mesh, matrices: [] });
                    cells.get(key).matrices.push(matrix.clone());
                }
                for (const { source, matrices } of cells.values()) {
                    const mesh = new THREE.InstancedMesh(source.geometry, source.material, matrices.length);
                    mesh.receiveShadow = true; mesh.castShadow = false;
                    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
                    mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingBox();
                    mesh.boundingBox.expandByVector(new THREE.Vector3(WOODLAND_WIND_REACH * 1.4, 0, WOODLAND_WIND_REACH * 1.4));
                    mesh.boundingSphere = mesh.boundingBox.getBoundingSphere(new THREE.Sphere());
                    mesh.userData.windBoundsIncluded = true; originalBatches.add(mesh);
                }
                // Reassemble prior tree cells from the actual current buffers,
                // retaining the same geometry, materials, shadows and placement
                // identities. A generated duplicate forest is not a pixel oracle.
                for (const { group } of treeGroups) {
                    const prior = new THREE.Group();
                    Object.assign(prior.userData, group.userData);
                    const treeCells = new Map();
                    for (const source of group.children) for (let i = 0; i < source.count; i++) {
                        const placement = group.userData.placements[source.userData.placementIndices[i]];
                        const key = `${source.material.uuid}:${source.castShadow}:${source.receiveShadow}:${Math.floor(placement.x / 16)}:${Math.floor(placement.z / 16)}`;
                        if (!treeCells.has(key)) treeCells.set(key, { source, geometries: [] });
                        source.getMatrixAt(i, matrix);
                        const geometry = source.geometry.index ? source.geometry.toNonIndexed() : source.geometry.clone();
                        treeCells.get(key).geometries.push(geometry.applyMatrix4(matrix));
                    }
                    for (const { source, geometries } of treeCells.values()) {
                        const geometry = mergeGeometries(geometries, false);
                        geometries.forEach(part => part.dispose());
                        if (!geometry) throw new Error('Unable to reconstruct prior same-material forest');
                        const mesh = new THREE.InstancedMesh(geometry, source.material, 1);
                        mesh.castShadow = source.castShadow; mesh.receiveShadow = source.receiveShadow;
                        mesh.setMatrixAt(0, new THREE.Matrix4());
                        mesh.userData.ownedComparisonGeometry = true;
                        mesh.instanceMatrix.needsUpdate = true;
                        computeFoliageCellBounds(mesh); prior.add(mesh);
                    }
                    originalBatches.add(prior);
                }
                understory.parent.add(originalBatches); originalBatches.visible = false;
            }
            wind.onBeforeRender = () => {};
            try {
                // Three's automatic reset happens after shadow submission;
                // accumulate the complete shadow+color frame for this comparison.
                render.renderer.info.autoReset = false;
                render.renderer.setRenderTarget(target);
                for (const mode of ['unculled', 'culled', ...(originalBatches ? ['original-batches'] : [])]) {
                    controller.enabled = mode !== 'unculled';
                    understory.visible = mode !== 'original-batches';
                    for (const { group, visible } of treeGroups) group.visible = visible && mode !== 'original-batches';
                    if (originalBatches) originalBatches.visible = mode === 'original-batches';
                    render.renderer.info.reset();
                    render.renderer.render(render.scene, render.camera);
                    const image = new Uint8Array(640 * 422 * 4);
                    render.renderer.readRenderTargetPixels(target, 0, 0, 640, 422, image);
                    pixels.push(image); costs.push({ ...render.renderer.info.render });
                    if (controller.omitted.size || controller.hidden.size) throw new Error('Scenery flags retained after render');
                }
                let changed = 0, batchingChanged = 0;
                for (let i = 0; i < pixels[0].length; i += 4) {
                    if ([0, 1, 2].some(channel => Math.abs(pixels[0][i + channel] - pixels[1][i + channel]) > 2)) changed++;
                    if (pixels[2] && [0, 1, 2].some(channel => Math.abs(pixels[2][i + channel] - pixels[1][i + channel]) > 2)) batchingChanged++;
                }
                return { changed, batchingChanged, total: 640 * 422, costs };
            } finally {
                controller.endFrame(); controller.enabled = enabledBefore;
                render.renderer.info.autoReset = autoReset;
                understory.visible = visibleBefore;
                for (const { group, visible } of treeGroups) group.visible = visible;
                originalBatches?.removeFromParent();
                originalBatches?.traverse(mesh => {
                    if (mesh.isInstancedMesh) mesh.dispose();
                    if (mesh.userData.ownedComparisonGeometry) mesh.geometry.dispose();
                });
                wind.onBeforeRender = updateWind;
                render.renderer.setRenderTarget(previousTarget); target.dispose();
            }
        };
        window.__reviewSurfaceCulling = () => {
            const baseline = new THREE.Mesh(createRealmGroundGeometry(WORLD_REGIONS.earth, .75, field), render.groundEarth.children[0].material);
            baseline.position.copy(render.groundEarth.position); baseline.quaternion.copy(render.groundEarth.quaternion);
            baseline.receiveShadow = true; render.scene.add(baseline);
            const target = new THREE.WebGLRenderTarget(640, 422), pixels = [], costs = [];
            const previousTarget = render.renderer.getRenderTarget();
            const wind = understory.children[0].material, updateWind = wind.onBeforeRender;
            // Freeze the already compiled wind phase between synchronous draws.
            wind.onBeforeRender = () => {};
            try {
                for (const spatial of [false, true]) {
                    baseline.visible = !spatial; render.groundEarth.visible = spatial;
                    understory.children.forEach(mesh => { mesh.frustumCulled = spatial; });
                    render.renderer.setRenderTarget(target); render.renderer.render(render.scene, render.camera);
                    costs.push({ calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles });
                    const data = new Uint8Array(640 * 422 * 4);
                    render.renderer.readRenderTargetPixels(target, 0, 0, 640, 422, data); pixels.push(data);
                }
                let changed = 0;
                for (let i = 0; i < pixels[0].length; i += 4) {
                    if ([0, 1, 2].some(c => Math.abs(pixels[0][i + c] - pixels[1][i + c]) > 2)) changed++;
                }
                return { changed, total: 640 * 422, costs };
            } finally {
                wind.onBeforeRender = updateWind; render.renderer.setRenderTarget(previousTarget);
                target.dispose();
                baseline.removeFromParent(); baseline.geometry.dispose(); render.groundEarth.visible = true;
                understory.children.forEach(mesh => { mesh.frustumCulled = true; });
            }
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
    // Existing production willow at ordinary gameplay zoom, not a model fixture.
    await page.evaluate(() => window.__reviewEarthShoulder(-33, -235));
    await page.screenshot({ path: testInfo.outputPath('grove-willow-curtains.png') });
    await page.evaluate(() => window.__reviewEarthShoulder(-94, -313));
    for (const [name, x, z] of [['west-bank', 340, 200], ['woodland-cut', 470, 200], ['outer-fold', 600, 200]]) {
        const view = await page.evaluate(([x, z]) => window.__reviewEarthShoulder(x, z), [x, z]);
        await testInfo.attach(`bastion-${name}`, { body: JSON.stringify(view), contentType: 'application/json' });
        console.log(`[bastion ${quality} ${name}] ${JSON.stringify(view)}`);
        const shadows = await page.evaluate(() => window.__reviewFoliageShadows());
        await testInfo.attach(`bastion-${name}-shadow-equivalence`, { body: JSON.stringify(shadows), contentType: 'application/json' });
        console.log(`[foliage shadows ${quality} ${name}] ${JSON.stringify(shadows)}`);
        expect(shadows.changed / shadows.total).toBeLessThan(.001);
        expect(shadows.batchingChanged / shadows.total).toBeLessThan(.001);
        expect(shadows.costs[1].triangles).toBeLessThanOrEqual(shadows.costs[0].triangles);
        expect(shadows.costs[1].calls).toBeLessThanOrEqual(shadows.costs[0].calls);
        await page.screenshot({ path: testInfo.outputPath(`bastion-${name}.png`) });
        if (process.env.EIDOLON_E2E_RAISED_TERRAIN_DIAGNOSE === '1') {
            const draws = await page.evaluate(() => window.__diagnoseEarthTerrain());
            for (const draw of draws) {
                expect(draw.triangles).toBe(draw.colorTriangles + draw.shadowTriangles);
                expect(draw.colorTriangles).toBeGreaterThanOrEqual(0);
                expect(draw.shadowTriangles).toBeGreaterThanOrEqual(0);
            }
            await testInfo.attach(`raised-terrain-${name}-draws`, { body: JSON.stringify(draws), contentType: 'application/json' });
            console.log(`[raised terrain draws ${quality} ${name}] ${JSON.stringify(draws.slice(0, 10))}`);
        }
        if (process.env.EIDOLON_E2E_RAISED_TERRAIN_PROFILE === '1') {
            const profile = await page.evaluate(() => window.__profileEarthTerrain());
            await testInfo.attach(`raised-terrain-${name}-profile`, {
                body: JSON.stringify(profile), contentType: 'application/json'
            });
            console.log(`[raised terrain ${quality} ${name}] ${JSON.stringify(profile)}`);
            expect(profile.frames).toBe(120);
            expect(profile.renderer).not.toBe('unavailable');
            expect(profile.renderer).not.toMatch(/SwiftShader|llvmpipe/i);
            // Retain the original populated-world budgets at both qualities.
            expect.soft(profile.median, `${name} median`).toBeLessThanOrEqual(quality === 'high' ? 20 : 33.4);
            expect.soft(profile.p95, `${name} p95`).toBeLessThanOrEqual(quality === 'high' ? 33.4 : 50);
            expect.soft(profile.calls, `${name} calls`).toBeLessThanOrEqual(quality === 'high' ? 350 : 200);
            expect.soft(profile.triangles, `${name} triangles`).toBeLessThanOrEqual(quality === 'high' ? 250000 : 85000);
        }
    }
    const culling = await page.evaluate(() => window.__reviewSurfaceCulling());
    await testInfo.attach('surface-culling-equivalence', { body: JSON.stringify(culling), contentType: 'application/json' });
    console.log(`[surface culling ${quality}] ${JSON.stringify(culling)}`);
    expect(culling.changed / culling.total).toBeLessThan(.001);
    expect(culling.costs[1].triangles).toBeLessThan(culling.costs[0].triangles / 2);
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
