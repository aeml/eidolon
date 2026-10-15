import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';
import { requiresHardwareWebGL } from './browserLaunchPolicy.js';

test.use({ video: 'on' });

for (const quality of ['high', 'low']) {
    test(`prepared ${quality} Magma uses a grounded stationary field while actors walk through it`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL), phone = quality === 'low';
        await page.setViewportSize({ width: phone ? 390 : 1280, height: 844 });
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.goto('/', { waitUntil: 'networkidle' });
        const initial = await page.evaluate(async quality => {
            const THREE = await import('three');
            const { RenderSystem } = await import('/src/core/RenderSystem.js');
            const { GameEngine } = await import('/src/core/GameEngine.js');
            const { ChunkManager } = await import('/src/core/ChunkManager.js');
            const { CollisionManager } = await import('/src/core/CollisionManager.js');
            const { FloatingTextManager } = await import('/src/ui/FloatingTextManager.js');
            const { UIManager } = await import('/src/ui/UIManager.js');
            const { Wizard } = await import('/src/entities/Wizard.js');
            const { Actor } = await import('/src/entities/Actor.js');
            const { BASE_ITEMS } = await import('/src/core/ItemSystem.js');
            document.getElementById('start-screen').style.display = 'none';
            const phone = quality === 'low', render = new RenderSystem(phone);render.setGraphicsQuality(quality);
            document.body.appendChild(render.renderer.domElement);
            const owner = new Wizard('prepared-magma-wizard');owner.name = 'Wizard';owner.level = 50;owner.recalculateStats();
            owner.stats.hp = owner.stats.maxHp;owner.stats.mana = owner.stats.maxMana;owner.stats.hpRegen = owner.stats.manaRegen = 0;
            owner.selectedBranch = 'A';owner.unlockedSkills = ['Fireball', 'Flame Whip', 'Flame Tornado', 'Meteor Drop', 'Inferno Cataclysm'];
            owner.skillRunes = { Fireball: 'fireball_magma' };
            const actors = [10, 16].map((x, i) => {
                const actor = new Actor(`magma-walker-${i}`, {});actor.meshType = 'Skeleton';actor.name = 'Field walker';
                actor.position.set(x, 0, 0);actor.stats.hp = actor.stats.maxHp = 10000;actor.stats.speed = 6;actor.stats.hpRegen = 0;return actor;
            });
            const ui = new UIManager(phone), rects = [{ x: 8, z: 0, width: 60, height: 30 }];
            const engine = { isMultiplayer: false, player: owner, uiManager: ui, renderSystem: render, effects: [],
                effectScene: render.effectGroup, scene: render.scene, currentInstanceId: 'magma-component', currentInstanceType: 'verdant_bastion_catacombs',
                currentDungeonLayout: { walkRects: rects }, collisionManager: new CollisionManager(),
                chunkManager: new ChunkManager(render.entityGroup), floatingTextManager: new FloatingTextManager(render.camera) };
            for (const method of ['spawnTransientEffect', 'isHostileActorTarget', 'isInteractableEntity', 'isPlayerClassEntity']) engine[method] = GameEngine.prototype[method].bind(engine);
            const q = { engine, owner, actors, render, ui, pauseForComparison: true, elapsed: 0, hits: [], trace: [], field: null, beforeMana: owner.stats.mana };
            const add = GameEngine.prototype.addEntity.bind(engine);
            engine.addEntity = entity => {
                add(entity);
                if (entity.effectType === 'BurningGround') { q.field = entity;q.fieldMesh = entity.mesh;q.origin = entity.position.clone();q.created = q.elapsed;q.fieldSteps = [];const update = entity.update.bind(entity);entity.update = (...args) => { const before = entity.elapsedTime;const result = update(...args);if (entity.elapsedTime > before) q.fieldSteps.push({ elapsed: entity.elapsedTime, dt: args[0] });return result; }; }
            };
            engine.collisionManager.setDungeonWalkableGeometry(rects);
            const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), new THREE.MeshStandardMaterial({ color: 0x383a32, roughness: 1 }));
            floor.rotation.x = -Math.PI / 2;floor.position.set(8, -.03, 0);render.environmentGroup.add(floor);
            owner.gameEngine = engine;await owner.ensureMesh();
            const names = ['Silk Hood', 'Robes', 'Silk Skirt', 'Sandals', 'Silk Gloves', 'Velvet Mantle', 'Silk Sash', 'Wooden Staff', 'Spell Tome', 'Ruby Ring', 'Silver Ring', 'Necklace', 'Amulet of Power', 'Orb of Mana'];
            const slots = ['head', 'chest', 'legs', 'feet', 'gloves', 'shoulders', 'belt', 'mainHand', 'offHand', 'ring1', 'ring2', 'neck', 'trinket1', 'trinket2'];
            owner.syncEquipmentVisuals(Object.fromEntries(names.map((name, i) => {
                const base = BASE_ITEMS.find(item => item.name === name);if (!base) throw Error(name);
                return [slots[i], { ...base, name, baseName: name, id: `prepared-magma-${slots[i]}`, slot: slots[i], rarity: 'Rare', stats: {}, gems: [], sockets: 0 }];
            })));
            await owner.mesh.userData.equipmentReady;engine.addEntity(owner);
            for (const actor of actors) {
                actor.gameEngine = engine;await actor.ensureMesh();engine.addEntity(actor);
                const receive = actor.takeDamage.bind(actor);
                actor.takeDamage = (...args) => {
                    const before = actor.stats.hp, result = receive(...args);
                    q.hits.push({ id: actor.id, field: args[3]?.inherited === true, damage: before - actor.stats.hp, elapsed: q.elapsed, x: actor.position.x, z: actor.position.z });return result;
                };
            }
            ui.lastPlayerRef = owner;ui.showHUD();ui.updatePlayerStats(owner);ui.updateXP(owner);ui.updateHotbar(owner);
            const controls = document.createElement('div');Object.assign(controls.style, { position: 'fixed', top: '110px', left: '12px', zIndex: '999', display: 'flex', gap: '6px', flexWrap: 'wrap', maxWidth: '360px' });
            const button = (label, action) => {
                const node = document.createElement('button');node.textContent = label;Object.assign(node.style, { minHeight: '44px', fontSize: '14px', padding: '6px 10px' });node.onclick = action;controls.appendChild(node);
            };
            button('Cast Magma Orb', () => owner.useAbility(actors[0].position.clone(), engine, 'Fireball'));
            button('Walk through field', () => {
                actors[0].move(new THREE.Vector3(q.origin.x + 14, 0, -2));actors[1].move(new THREE.Vector3(q.origin.x + 1, 0, 2));q.walkAt = q.elapsed;
                if (q.pauseForComparison) { q.pauseForComparison = false;q.frame = requestAnimationFrame(q.renderFrame); }
            });
            document.body.appendChild(controls);render.setCameraTarget(new THREE.Vector3(7, 0, 0));render.setZoom(15);
            let previous = performance.now();
            const frame = now => {
                if (quality === 'low' && now - previous < 1000 / 15) { q.frame = requestAnimationFrame(frame);return; }
                const dt = Math.min(.1, (now - previous) / 1000);previous = now;q.elapsed += dt;
                engine.chunkManager.update(owner, dt, engine.collisionManager, engine.floatingTextManager, engine);
                if (q.field) {
                    q.trace.push({ elapsed: q.elapsed - q.created, active: q.field.isActive, error: q.field.position.distanceTo(q.origin), y: q.field.position.y, actors: actors.map(actor => ({ x: actor.position.x, z: actor.position.z, state: actor.state, target: actor.targetPosition?.toArray() || null })) });
                    if (!q.field.isActive && !q.expiry) q.expiry = { elapsed: q.elapsed - q.created, step: dt, fieldElapsed: q.field.elapsedTime, meshRetired: q.field.mesh === null };
                }
                for (const entity of engine.chunkManager.getActiveEntities()) entity.render(1);
                for (const effect of engine.effects) effect.update(dt);engine.effects = engine.effects.filter(effect => effect.isActive);
                engine.floatingTextManager.update(dt);ui.updatePlayerStats(owner);ui.updateHotbarCooldowns(owner);render.render();
                // Hold this prepared simulation at the field's first frame.
                // Pixel readback and button actionability must not consume the
                // three-second gameplay lifetime before the walk can begin.
                if (!q.field || !q.pauseForComparison) q.frame = requestAnimationFrame(frame);
            };
            window.__magmaGround = q;q.renderFrame = frame;q.frame = requestAnimationFrame(frame);
            const gl = render.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
            return { gpu: ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL), equipment: owner.mesh.userData.equipmentVisualItemCount,
                fallback: owner.mesh.userData.equipmentVisualFallbacks || [], missing: owner.mesh.userData.equipmentVisualMissing || [], pendingGeometry: render.actorGameplayGeometry.delivery.jobs.size };
        }, quality);
        if (requiresHardwareWebGL()) { expect(initial.gpu).toBeTruthy();expect(initial.gpu).not.toMatch(/software|swiftshader|llvmpipe|not exposed/i); }
        expect(initial.equipment).toBe(14);expect(initial.fallback).toEqual([]);expect(initial.missing).toEqual([]);
        await page.getByRole('button', { name: 'Cast Magma Orb', exact: true }).click();
        await expect.poll(() => page.evaluate(() => Boolean(window.__magmaGround.field?.isActive))).toBe(true);
        const contrast = await page.evaluate(async quality => {
            // Resolve modules before freezing the comparison. An await between
            // reference and replica lets unrelated timers/geometry deliveries
            // change the scene even though this fixture's RAF is cancelled.
            const { Projectile } = await import('/src/entities/Projectile.js');
            const { updateProceduralProjectileVisual } = await import('/src/art/ProceduralProjectileEffects.js');
            const q = window.__magmaGround;cancelAnimationFrame(q.frame);
            const gl = q.render.renderer.getContext();
            const capture = () => { q.render.render();const bytes = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, bytes);return bytes; };
            const visible = capture();q.field.mesh.visible = false;const hidden = capture();q.field.mesh.visible = true;const restored = capture();
            const replica = new Projectile('replicated-magma-visual', q.owner, 'MagmaGround', q.origin.clone(), q.origin.clone(), { quality });
            replica.setScale(1);
            for (const step of q.fieldSteps) updateProceduralProjectileVisual(replica.mesh, 'MagmaGround', step.elapsed, step.dt);
            q.field.mesh.visible = false;q.render.entityGroup.add(replica.mesh);const replicated = capture();
            const originalParts = [], replicaParts = [];
            q.field.mesh.traverse(part => originalParts.push(part));replica.mesh.traverse(part => replicaParts.push(part));
            const poseDifferences = originalParts.flatMap((part, i) => {
                const other = replicaParts[i], a = [...part.position, ...part.quaternion, ...part.scale], b = [...other.position, ...other.quaternion, ...other.scale];
                return a.some((value, j) => value !== b[j]) ? [{ name: part.name, maxDifference: Math.max(...a.map((value, j) => Math.abs(value - b[j]))) }] : [];
            });
            const sharedSurfaces = originalParts.every((part, i) => !part.isMesh || part.geometry === replicaParts[i].geometry && part.material === replicaParts[i].material);
            replica.dispose();q.field.mesh.visible = true;const afterReplica = capture();
            const changed = (a, b) => a.reduce((sum, value, i) => sum + Number(value !== b[i]), 0);
            return { changed: changed(visible, hidden), restored: changed(visible, restored), replicaDifference: changed(visible, replicated), poseDifferences, sharedSurfaces, afterReplica: changed(visible, afterReplica), radius: q.fieldMesh.userData.gameplayRadius };
        }, quality);
        await page.getByRole('button', { name: 'Walk through field', exact: true }).click();
        await page.screenshot({ path: testInfo.outputPath(`magma-${quality}-walking.png`) });
        await expect.poll(() => page.evaluate(() => Boolean(window.__magmaGround.expiry))).toBe(true);
        const result = await page.evaluate(() => {
            const q = window.__magmaGround;return { walkFieldAge: q.walkAt - q.created, hits: q.hits, trace: q.trace, expiry: q.expiry, manaSpent: q.beforeMana - q.owner.stats.mana,
                radius: q.field.radius, duration: q.field.duration, origin: q.origin.toArray(), fieldDetached: q.fieldMesh.parent === null, pendingGeometry: q.render.actorGameplayGeometry.delivery.jobs.size };
        });
        await testInfo.attach('magma-ground-observation', { body: JSON.stringify({ initial, contrast, ...result }), contentType: 'application/json' });
        expect(contrast.changed).toBeGreaterThan(0);expect(contrast.restored).toBe(0);expect(contrast.radius).toBe(5);expect(contrast.replicaDifference).toBe(0);expect(contrast.afterReplica).toBe(0);
        expect(result.walkFieldAge).toBe(0);
        expect(result.manaSpent).toBe(30);expect(result.radius).toBe(5);expect(result.duration).toBe(3);
        expect(result.trace.every(frame => frame.error === 0 && frame.y === 0)).toBe(true);
        expect(result.hits.some(hit => hit.id === 'magma-walker-0' && hit.field)).toBe(true);
        expect(result.hits.some(hit => hit.id === 'magma-walker-1' && hit.field)).toBe(true);
        expect(result.expiry.elapsed).toBeGreaterThanOrEqual(3 - result.expiry.step - 1e-8);
        expect(result.expiry.elapsed).toBeLessThanOrEqual(3 + result.expiry.step + 1e-8);
        expect(result.expiry.fieldElapsed).toBeGreaterThanOrEqual(3);expect(result.expiry.fieldElapsed).toBeLessThanOrEqual(3 + result.expiry.step + 1e-8);
        expect(result.expiry.meshRetired).toBe(true);expect(result.fieldDetached).toBe(true);expect(result.pendingGeometry).toBe(0);
        await page.evaluate(() => {
            const q = window.__magmaGround;cancelAnimationFrame(q.frame);
            for (const entity of q.engine.chunkManager.getActiveEntities()) q.engine.chunkManager.removeEntity(entity);
            for (const effect of q.engine.effects) effect.dispose?.();q.ui.dispose();q.render.dispose();
        });
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
