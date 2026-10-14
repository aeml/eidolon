import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';
import { requiresHardwareWebGL } from './browserLaunchPolicy.js';

test.use({ video: 'on' });
for (const quality of ['high', 'low']) test(`prepared ${quality} paid Cleric rune effects render and retire`, async ({ page, baseURL }, testInfo) => {
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
            const { Cleric } = await import('/src/entities/Cleric.js');
            const { Actor } = await import('/src/entities/Actor.js');
            const { BASE_ITEMS } = await import('/src/core/ItemSystem.js');
            document.getElementById('start-screen').style.display = 'none';
            const phone = quality === 'low', render = new RenderSystem(phone);render.setGraphicsQuality(quality);
            document.body.appendChild(render.renderer.domElement);
            const owner = new Cleric('prepared-rune-cleric');owner.name = 'Cleric';owner.level = 100;owner.recalculateStats();
            owner.stats.hp = owner.stats.maxHp;owner.stats.mana = owner.stats.maxMana;owner.stats.hpRegen = owner.stats.manaRegen = 0;
            owner.selectedBranch = 'B';owner.unlockedSkills = ['Spirit Guardians', 'Radiant Strike', 'Consecrated Ground', 'Spirit Guardians Boost', 'Avenging Seraph'];
            owner.skillRunes = { 'Spirit Guardians': 'spirits_sanctuary', 'Radiant Strike': 'radiantstrike_smite', 'Consecrated Ground': 'consecratedground_sanctuary', 'Spirit Guardians Boost': 'spiritboost_wide', 'Avenging Seraph': 'seraph_guardian' };
            const actors = [2].map((x, i) => {
                const actor = new Actor(`cleric-walker-${i}`, {});actor.meshType = 'Skeleton';actor.name = 'Field walker';
                actor.position.set(x, 0, 0);actor.stats.hp = actor.stats.maxHp = 10000;actor.stats.speed = 6;actor.stats.hpRegen = 0;return actor;
            });
            const ui = new UIManager(phone), rects = [{ x: 8, z: 0, width: 60, height: 30 }];
            const engine = { isMultiplayer: false, player: owner, uiManager: ui, renderSystem: render, effects: [],
                effectScene: render.effectGroup, scene: render.scene, currentInstanceId: 'cleric-component', currentInstanceType: 'verdant_bastion_catacombs',
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
            const names = ['Iron Helm', 'Robes', 'Leather Pants', 'Iron Boots', 'Silk Gloves', 'Steel Pauldrons', 'Studded Belt', 'Cleric Mace', 'Wooden Shield', 'Ruby Ring', 'Silver Ring', 'Necklace', 'Amulet of Power', 'Orb of Mana'];
            const slots = ['head', 'chest', 'legs', 'feet', 'gloves', 'shoulders', 'belt', 'mainHand', 'offHand', 'ring1', 'ring2', 'neck', 'trinket1', 'trinket2'];
            owner.syncEquipmentVisuals(Object.fromEntries(names.map((name, i) => {
                const base = BASE_ITEMS.find(item => item.name === name);if (!base) throw Error(name);
                return [slots[i], { ...base, name, baseName: name, id: `prepared-cleric-${slots[i]}`, slot: slots[i], rarity: 'Rare', stats: {}, gems: [], sockets: 0 }];
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
            for (const skill of ['Radiant Strike', 'Consecrated Ground', 'Spirit Guardians Boost', 'Avenging Seraph']) {
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
            window.__clericEffects = q;q.renderFrame = frame;q.frame = requestAnimationFrame(frame);
            const gl = render.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
            return { gpu: ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL), equipment: owner.mesh.userData.equipmentVisualItemCount,
                fallback: owner.mesh.userData.equipmentVisualFallbacks || [], missing: owner.mesh.userData.equipmentVisualMissing || [], pendingGeometry: render.actorGameplayGeometry.delivery.jobs.size };
        }, quality);
    if (requiresHardwareWebGL()) { expect(initial.gpu).toBeTruthy();expect(initial.gpu).not.toMatch(/software|swiftshader|llvmpipe|not exposed/i); }
    expect(initial.equipment).toBe(14);expect(initial.fallback).toEqual([]);expect(initial.missing).toEqual([]);
    for (const skill of ['Radiant Strike', 'Consecrated Ground', 'Spirit Guardians Boost', 'Avenging Seraph']) {
        await page.getByRole('button', { name: skill, exact: true }).click();
        await page.waitForTimeout(150);
    }
    await expect.poll(() => page.evaluate(() => window.__clericEffects.spawned.filter(r => r.entity.constructor.name === 'AvengingSeraph' && r.entity.mesh?.parent).length)).toBe(1);
    const active = await page.evaluate(() => {
        const q = window.__clericEffects;
        q.zoneVisual = q.owner.consecratedZone.visual;q.spiritVisual = q.owner.spiritEffect;
        q.seraph = q.spawned.find(r => r.entity.constructor.name === 'AvengingSeraph').entity;q.seraphMesh = q.seraph.mesh;
        return { radius: q.owner.spiritRadius, visualRadius: q.owner.spiritEffect.effectRadius,
            sanctuary: q.owner.spiritSanctuaryTimer > 0 && q.owner.consecratedSanctuaryTimer > 0,
            summonHealth: q.seraph.stats.maxHp, expectedHealth: Math.floor((500 + q.owner.stats.wisdom * 10) * 1.5) };
    });
    expect(active.radius).toBe(30);expect(active.visualRadius).toBe(30);expect(active.sanctuary).toBe(true);expect(active.summonHealth).toBe(active.expectedHealth);
    await page.screenshot({ path: testInfo.outputPath(`cleric-runes-${quality}.png`) });
    // The capped simulation clock can run slower on software WebGL.
    await expect.poll(() => page.evaluate(() => {
        const q = window.__clericEffects;return !q.owner.spiritsActive && !q.owner.consecratedZone && !q.seraph.isActive;
    }), { timeout: requiresHardwareWebGL() ? 22000 : 90000 }).toBe(true);
    const result = await page.evaluate(() => {
        const q = window.__clericEffects;
        return { manaSpent: q.beforeMana - q.owner.stats.mana, hits: q.hits,
            zoneDetached: !q.zoneVisual.parent, spiritDisposed: !q.spiritVisual.isActive,
            seraphDetached: !q.seraphMesh.parent, summons: q.owner.offlineSeraphs.size,
            seraphLifetime: (() => { const r = q.spawned.find(r => r.entity === q.seraph); return r.retiredAt - r.at; })(),
            gpuJobs: q.render.actorGameplayGeometry.delivery.jobs.size };
    });
    expect(result.manaSpent).toBe(20 + 40 + 40 + 60);
    expect(result.seraphLifetime).toBeGreaterThanOrEqual(14.8);expect(result.seraphLifetime).toBeLessThan(15.2);
    expect(result.zoneDetached).toBe(true);expect(result.spiritDisposed).toBe(true);expect(result.seraphDetached).toBe(true);
    expect(result.hits.some(hit => hit.damage > 0)).toBe(true);expect(result.summons).toBe(0);expect(result.gpuJobs).toBe(0);
    await testInfo.attach('cleric-rune-effect-observations', { body: JSON.stringify({ initial, active, result }), contentType: 'application/json' });
    await page.evaluate(() => {
        const q = window.__clericEffects;cancelAnimationFrame(q.frame);
        for (const entity of q.engine.chunkManager.getActiveEntities()) q.engine.chunkManager.removeEntity(entity);
        for (const effect of q.engine.effects) effect.dispose?.();q.ui.dispose();q.render.dispose();
    });
    expect(failures, failures.join('\n')).toEqual([]);
});
