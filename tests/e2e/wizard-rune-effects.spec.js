import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';
import { requiresHardwareWebGL } from './browserLaunchPolicy.js';

test.use({ video: 'on' });
for (const quality of ['high', 'low']) test(`prepared ${quality} paid Wizard rune effects render and retire`, async ({ page, baseURL }, testInfo) => {
    test.setTimeout(requiresHardwareWebGL() ? 120_000 : 180_000);
    const failures = collectBrowserFailures(page, baseURL);
    await page.setViewportSize({ width: quality === 'low' ? 390 : 1280, height: 844 });
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
            const owner = new Wizard('prepared-rune-wizard');owner.name = 'Wizard';owner.level = 100;owner.recalculateStats();
            owner.stats.hp = owner.stats.maxHp;owner.stats.mana = owner.stats.maxMana;owner.stats.hpRegen = owner.stats.manaRegen = 0;
            owner.selectedBranch = 'A';owner.unlockedSkills = ['Fireball', 'Flame Whip', 'Flame Tornado', 'Meteor Drop', 'Inferno Cataclysm'];
            owner.skillRunes = { 'Meteor Drop': 'meteor_apocalypse', 'Inferno Cataclysm': 'inferno_lingering', 'Flame Tornado': 'flametornado_broad', 'Flame Whip': 'flamewhip_reach' };
            const actors = [8].map((x, i) => {
                const actor = new Actor(`magma-walker-${i}`, {});actor.meshType = 'Skeleton';actor.name = 'Field walker';
                actor.position.set(x, 0, 0);actor.stats.hp = actor.stats.maxHp = 10000;actor.stats.speed = 6;actor.stats.hpRegen = 0;return actor;
            });
            const ui = new UIManager(phone), rects = [{ x: 8, z: 0, width: 60, height: 30 }];
            const engine = { isMultiplayer: false, player: owner, uiManager: ui, renderSystem: render, effects: [],
                effectScene: render.effectGroup, scene: render.scene, currentInstanceId: 'magma-component', currentInstanceType: 'verdant_bastion_catacombs',
                currentDungeonLayout: { walkRects: rects }, collisionManager: new CollisionManager(),
                chunkManager: new ChunkManager(render.entityGroup), floatingTextManager: new FloatingTextManager(render.camera) };
            for (const method of ['spawnTransientEffect', 'isHostileActorTarget', 'isInteractableEntity', 'isPlayerClassEntity']) engine[method] = GameEngine.prototype[method].bind(engine);
            const q = { engine, owner, actors, render, ui, elapsed: 0, hits: [], spawned: [], beforeMana: owner.stats.mana };
            const add = GameEngine.prototype.addEntity.bind(engine);
            engine.addEntity = entity => { add(entity);q.spawned.push({ entity, at: q.elapsed, mesh: entity.mesh }); };
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
            for (const skill of ['Flame Whip', 'Flame Tornado', 'Meteor Drop', 'Inferno Cataclysm']) {
                button(skill, () => owner.useAbility(actors[0].position.clone(), engine, skill));
            }
            document.body.appendChild(controls);render.setCameraTarget(new THREE.Vector3(7, 0, 0));render.setZoom(15);
            let previous = performance.now();
            const frame = now => {
                if (quality === 'low' && now - previous < 1000 / 15) { q.frame = requestAnimationFrame(frame);return; }
                const dt = Math.min(.1, (now - previous) / 1000);previous = now;q.elapsed += dt;
                engine.chunkManager.update(owner, dt, engine.collisionManager, engine.floatingTextManager, engine);
                for (const record of q.spawned) if (!record.entity.isActive && record.retiredAt === undefined) record.retiredAt = q.elapsed;
                for (const entity of engine.chunkManager.getActiveEntities()) entity.render(1);
                for (const effect of engine.effects) effect.update(dt);engine.effects = engine.effects.filter(effect => effect.isActive);
                engine.floatingTextManager.update(dt);ui.updatePlayerStats(owner);ui.updateHotbarCooldowns(owner);render.render();q.frame = requestAnimationFrame(frame);
            };
            window.__wizardEffects = q;q.renderFrame = frame;q.frame = requestAnimationFrame(frame);
            const gl = render.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
            return { gpu: ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL), equipment: owner.mesh.userData.equipmentVisualItemCount,
                fallback: owner.mesh.userData.equipmentVisualFallbacks || [], missing: owner.mesh.userData.equipmentVisualMissing || [], pendingGeometry: render.actorGameplayGeometry.delivery.jobs.size };
        }, quality);
    if (requiresHardwareWebGL()) { expect(initial.gpu).toBeTruthy();expect(initial.gpu).not.toMatch(/software|swiftshader|llvmpipe|not exposed/i); }
    expect(initial.equipment).toBe(14);expect(initial.fallback).toEqual([]);expect(initial.missing).toEqual([]);
    for (const skill of ['Flame Whip', 'Flame Tornado', 'Meteor Drop', 'Inferno Cataclysm']) {
        await page.getByRole('button', { name: skill, exact: true }).click();
        await page.waitForTimeout(150);
    }
    await expect.poll(() => page.evaluate(() => window.__wizardEffects.spawned.filter(r => r.entity.type === 'Meteor').length), { timeout: 10000 }).toBe(6);
    await page.screenshot({ path: testInfo.outputPath(`wizard-runes-${quality}.png`) });
    try {
        // Software WebGL can advance less than one game second per wall second.
        // Keep exact simulated lifetime assertions below and the native deadline.
        await expect.poll(() => page.evaluate(() => window.__wizardEffects.spawned.filter(r => ['Meteor', 'FlameTornado', 'AreaOfEffect'].includes(r.entity.type)).every(r => r.retiredAt !== undefined)), { timeout: requiresHardwareWebGL() ? 20000 : 90000 }).toBe(true);
    } catch (error) {
        const retirement = await page.evaluate(() => {
            const q = window.__wizardEffects;
            return { elapsed: q.elapsed, effects: q.spawned.filter(r => ['Meteor', 'FlameTornado', 'AreaOfEffect'].includes(r.entity.type)).map(r => ({ type: r.entity.type, at: r.at, retiredAt: r.retiredAt, active: r.entity.isActive, life: r.entity.life, duration: r.entity.duration })) };
        });
        await testInfo.attach('retirement-timeout', { body: JSON.stringify({ initial, retirement }), contentType: 'application/json' });
        throw error;
    }
    const result = await page.evaluate(() => {
        const q = window.__wizardEffects;
        return { manaSpent: q.beforeMana - q.owner.stats.mana, hits: q.hits,
            effects: q.spawned.filter(r => ['Meteor', 'FlameTornado', 'AreaOfEffect'].includes(r.entity.type)).map(r => ({
                type: r.entity.type, duration: r.retiredAt - r.at, radius: r.entity.radius,
                detached: !r.mesh?.parent, active: r.entity.isActive })),
            pending: q.owner.offlineMeteorCasts.size, gpuJobs: q.render.actorGameplayGeometry.delivery.jobs.size };
    });
    expect(result.manaSpent).toBe(35 + 50 + 60 + 60);
    expect(result.effects.filter(r => r.type === 'Meteor')).toHaveLength(6);
    expect(result.effects.find(r => r.type === 'FlameTornado').radius).toBe(4.5);
    const field = result.effects.find(r => r.type === 'AreaOfEffect');
    expect(field.duration).toBeGreaterThanOrEqual(11.8);expect(field.duration).toBeLessThan(12.2);
    expect(result.effects.every(r => r.detached && !r.active)).toBe(true);
    expect(result.hits.some(hit => hit.damage > 0)).toBe(true);
    expect(result.pending).toBe(0);expect(result.gpuJobs).toBe(0);
    await testInfo.attach('wizard-rune-effect-observations', { body: JSON.stringify({ initial, result }), contentType: 'application/json' });
    await page.evaluate(() => {
        const q = window.__wizardEffects;cancelAnimationFrame(q.frame);
        for (const entity of q.engine.chunkManager.getActiveEntities()) q.engine.chunkManager.removeEntity(entity);
        for (const effect of q.engine.effects) effect.dispose?.();q.ui.dispose();q.render.dispose();
    });
    expect(failures, failures.join('\n')).toEqual([]);
});
