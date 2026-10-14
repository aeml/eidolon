import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';
import { requiresHardwareWebGL } from './browserLaunchPolicy.js';

test.use({ video: 'on' });
for (const quality of ['high', 'low']) for (const rune of ['arcaneshield_reflective', 'arcaneshield_explosive']) {
    test(`prepared ${quality} ${rune} absorbs animated attacks and retires the broken shield`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL), phone = quality === 'low';
        await page.setViewportSize({ width: phone ? 390 : 1280, height: 844 });
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.goto('/', { waitUntil: 'networkidle' });
        const initial = await page.evaluate(async ({ quality, rune }) => {
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
            const owner = new Wizard('prepared-shield-wizard');owner.name = 'Wizard';owner.level = 50;owner.recalculateStats();
            owner.stats.hp = owner.stats.maxHp;owner.stats.mana = owner.stats.maxMana;owner.stats.hpRegen = owner.stats.manaRegen = 0;
            owner.selectedBranch = 'C';owner.unlockedSkills = ['Fireball', 'Arcane Shield', 'Gravity Well', 'Teleport', 'Time Warp'];
            owner.skillRunes = { 'Arcane Shield': rune };
            const actors = [2].map((x, i) => {
                const actor = new Actor(`shield-walker-${i}`, {});actor.meshType = 'Skeleton';actor.name = 'Shield attacker';
                actor.position.set(x, 0, 0);actor.stats.hp = actor.stats.maxHp = 1000;actor.stats.damage = 61;actor.stats.attackSpeed = .8;actor.stats.speed = 6;actor.stats.hpRegen = 0;return actor;
            });
            const ui = new UIManager(phone), rects = [{ x: 8, z: 0, width: 60, height: 30 }];
            const engine = { isMultiplayer: false, player: owner, uiManager: ui, renderSystem: render, effects: [],
                effectScene: render.effectGroup, scene: render.scene, currentInstanceId: 'shield-component', currentInstanceType: 'verdant_bastion_catacombs',
                currentDungeonLayout: { walkRects: rects }, collisionManager: new CollisionManager(),
                chunkManager: new ChunkManager(render.entityGroup), floatingTextManager: new FloatingTextManager(render.camera) };
            for (const method of ['spawnTransientEffect', 'isHostileActorTarget', 'isInteractableEntity', 'isPlayerClassEntity']) engine[method] = GameEngine.prototype[method].bind(engine);
            const q = { engine, owner, actors, render, ui, receipts: [], trace: [], beforeMana: owner.stats.mana, beforeHP: owner.stats.hp, animations: new Set() };
            engine.addEntity = GameEngine.prototype.addEntity.bind(engine);
            engine.collisionManager.setDungeonWalkableGeometry(rects);
            const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), new THREE.MeshStandardMaterial({ color: 0x383a32, roughness: 1 }));
            floor.rotation.x = -Math.PI / 2;floor.position.set(8, -.03, 0);render.environmentGroup.add(floor);
            owner.gameEngine = engine;await owner.ensureMesh();
            const names = ['Silk Hood', 'Robes', 'Silk Skirt', 'Sandals', 'Silk Gloves', 'Velvet Mantle', 'Silk Sash', 'Wooden Staff', 'Spell Tome', 'Ruby Ring', 'Silver Ring', 'Necklace', 'Amulet of Power', 'Orb of Mana'];
            const slots = ['head', 'chest', 'legs', 'feet', 'gloves', 'shoulders', 'belt', 'mainHand', 'offHand', 'ring1', 'ring2', 'neck', 'trinket1', 'trinket2'];
            owner.syncEquipmentVisuals(Object.fromEntries(names.map((name, i) => {
                const base = BASE_ITEMS.find(item => item.name === name);if (!base) throw Error(name);
                return [slots[i], { ...base, name, baseName: name, id: `prepared-shield-${slots[i]}`, slot: slots[i], rarity: 'Rare', stats: {}, gems: [], sockets: 0 }];
            })));
            await owner.mesh.userData.equipmentReady;engine.addEntity(owner);
            for (const actor of actors) { actor.gameEngine = engine;await actor.ensureMesh();engine.addEntity(actor); }
            const enemy = actors[0], receive = owner.takeDamage.bind(owner);
            owner.takeDamage = (...args) => {
                const shield = owner.shieldHP, hp = owner.stats.hp, enemyHP = enemy.stats.hp;
                const result = receive(...args);
                q.receipts.push({ incoming: args[0], absorbed: shield - owner.shieldHP, healthDamage: hp - owner.stats.hp, retaliation: enemyHP - enemy.stats.hp });return result;
            };
            ui.lastPlayerRef = owner;ui.showHUD();ui.updatePlayerStats(owner);ui.updateXP(owner);ui.updateHotbar(owner);
            const controls = document.createElement('div');Object.assign(controls.style, { position: 'fixed', top: '110px', left: '12px', zIndex: '999', display: 'flex', gap: '6px', flexWrap: 'wrap', maxWidth: '360px' });
            const button = (label, action) => { const node = document.createElement('button');node.textContent = label;Object.assign(node.style, { minHeight: '44px', fontSize: '14px', padding: '6px 10px' });node.onclick = action;controls.appendChild(node); };
            button('Cast Arcane Shield', () => owner.useAbility(owner.position.clone(), engine, 'Arcane Shield'));
            button('Strike shield', () => enemy.attack(owner));
            button('Break shield', () => { owner.move(new THREE.Vector3(-1, 0, 0));q.attackLoop = setInterval(() => { if (owner.arcaneShieldActive) enemy.attack(owner);else clearInterval(q.attackLoop); }, 850); });
            document.body.appendChild(controls);render.setCameraTarget(new THREE.Vector3(0, 0, 0));render.setZoom(15);
            let previous = performance.now();
            const frame = now => {
                if (quality === 'low' && now - previous < 1000 / 15) { q.frame = requestAnimationFrame(frame);return; }
                const dt = Math.min(.1, (now - previous) / 1000);previous = now;
                engine.chunkManager.update(owner, dt, engine.collisionManager, engine.floatingTextManager, engine);
                for (const entity of engine.chunkManager.getActiveEntities()) entity.render(1);
                // Match GameEngine.render: attachment alignment follows the
                // rendered actor pose, after movement/interpolation/correction.
                for (const entity of engine.chunkManager.getActiveEntities()) entity.syncPresentationTransform?.();
                const shield = owner.attachedStatusEffects.get('arcane_shield');
                q.animations.add(enemy.currentAnimationName);
                if (shield) q.trace.push({ error: Math.hypot(shield.group.position.x - owner.mesh.position.x, shield.group.position.z - owner.mesh.position.z), x: owner.position.x });
                for (const effect of engine.effects) effect.update(dt);engine.effects = engine.effects.filter(effect => effect.isActive);
                engine.floatingTextManager.update(dt);ui.updatePlayerStats(owner);ui.updateHotbarCooldowns(owner);render.render();q.frame = requestAnimationFrame(frame);
            };
            window.__shieldRunes = q;q.renderFrame = frame;q.frame = requestAnimationFrame(frame);
            const gl = render.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
            return { gpu: ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL), equipment: owner.mesh.userData.equipmentVisualItemCount, fallback: owner.mesh.userData.equipmentVisualFallbacks || [], missing: owner.mesh.userData.equipmentVisualMissing || [], mana: owner.stats.mana, hp: owner.stats.hp };
        }, { quality, rune });
        if (requiresHardwareWebGL()) { expect(initial.gpu).toBeTruthy();expect(initial.gpu).not.toMatch(/software|swiftshader|llvmpipe|not exposed/i); }
        expect(initial.equipment).toBe(14);expect(initial.fallback).toEqual([]);expect(initial.missing).toEqual([]);
        await page.getByRole('button', { name: 'Cast Arcane Shield', exact: true }).click();
        await page.getByRole('button', { name: 'Strike shield', exact: true }).click();
        await expect.poll(() => page.evaluate(() => window.__shieldRunes.receipts.length)).toBe(1);
        const partial = await page.evaluate(() => {
            const q = window.__shieldRunes;cancelAnimationFrame(q.frame);
            const effect = q.owner.attachedStatusEffects.get('arcane_shield'), gl = q.render.renderer.getContext();
            const capture = () => { q.render.render();const bytes = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, bytes);return bytes; };
            const visible = capture();effect.group.visible = false;const hidden = capture();effect.group.visible = true;const restored = capture();
            const changed = (a, b) => a.reduce((sum, value, i) => sum + Number(value !== b[i]), 0);
            q.shieldGroup = effect.group;q.frame = requestAnimationFrame(q.renderFrame);
            return { changed: changed(visible, hidden), restored: changed(visible, restored), shield: q.owner.shieldHP, hp: q.owner.stats.hp, manaSpent: q.beforeMana - q.owner.stats.mana, receipt: q.receipts[0] };
        });
        expect(partial.changed).toBeGreaterThan(0);expect(partial.restored).toBe(0);expect(partial.shield).toBeGreaterThan(0);
        expect(partial.hp).toBe(initial.hp);expect(partial.manaSpent).toBe(40);
        expect(partial.receipt.retaliation).toBe(rune === 'arcaneshield_reflective' ? Math.floor(partial.receipt.absorbed * .3) : 0);
        await page.screenshot({ path: testInfo.outputPath(`shield-${quality}-${rune}-partial.png`) });
        await page.getByRole('button', { name: 'Break shield', exact: true }).click();
        await expect.poll(() => page.evaluate(() => window.__shieldRunes.owner.arcaneShieldActive)).toBe(false);
        await expect.poll(() => page.evaluate(() => window.__shieldRunes.owner.attachedStatusEffects.has('arcane_shield'))).toBe(false);
        await page.screenshot({ path: testInfo.outputPath(`shield-${quality}-${rune}-broken.png`) });
        const result = await page.evaluate(() => {
            const q = window.__shieldRunes;return { receipts: q.receipts, trace: q.trace, animations: [...q.animations], enemyHP: q.actors[0].stats.hp, ownerHP: q.owner.stats.hp,
                history: q.owner.arcaneShieldAbsorbed, rune: q.owner.arcaneShieldRuneId, detached: q.shieldGroup.parent === null, pendingGeometry: q.render.actorGameplayGeometry.delivery.jobs.size };
        });
        await testInfo.attach('shield-rune-observation', { body: JSON.stringify({ initial, partial, ...result }), contentType: 'application/json' });
        expect(result.receipts.reduce((sum, hit) => sum + hit.absorbed, 0)).toBe(150);
        const budget = rune === 'arcaneshield_reflective' ? result.receipts.reduce((sum, hit) => sum + Math.floor(hit.absorbed * .3), 0) : 150;
        expect(result.enemyHP).toBe(1000 - budget);expect(result.history).toBe(0);expect(result.rune).toBe('');
        expect(result.trace.length).toBeGreaterThan(3);expect(result.trace.every(frame => frame.error === 0)).toBe(true);
        expect(result.trace.some(frame => frame.x < -.1)).toBe(true);expect(result.animations).toContain('Attack');
        expect(result.detached).toBe(true);expect(result.pendingGeometry).toBe(0);
        await page.evaluate(() => { const q = window.__shieldRunes;clearInterval(q.attackLoop);cancelAnimationFrame(q.frame);for (const entity of q.engine.chunkManager.getActiveEntities()) q.engine.chunkManager.removeEntity(entity);for (const effect of q.engine.effects) effect.dispose?.();q.ui.dispose();q.render.dispose(); });
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
