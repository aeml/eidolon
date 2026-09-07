import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

// This exercises the offline fallback with production actors, meshes, chunk
// updates and collision. Normal login is multiplayer; this is deliberately a
// prepared component scene, not earned progression or an offline login mode.
async function scene(page, mode) {
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async mode => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { GameEngine } = await import('/src/core/GameEngine.js');
        const { ChunkManager } = await import('/src/core/ChunkManager.js');
        const { CollisionManager } = await import('/src/core/CollisionManager.js');
        const { FloatingTextManager } = await import('/src/ui/FloatingTextManager.js');
        const { Cleric } = await import('/src/entities/Cleric.js');
        const { Actor } = await import('/src/entities/Actor.js');
        document.getElementById('start-screen').style.display = 'none';
        const render = new RenderSystem(false);
        document.body.appendChild(render.renderer.domElement);
        const owner = new Cleric('offline-owner');
        owner.name = 'Cleric'; owner.stats.wisdom = 10;
        owner.stats.mana = owner.stats.maxMana = 1000;
        owner.stats.hpRegen = owner.stats.manaRegen = 0;
        owner.unlockedSkills.push('Avenging Seraph'); owner.talentRanks = { CLR_17: 5, CLR_18: 5 };
        const enemy = new Actor('offline-enemy', {});
        enemy.meshType = 'Skeleton'; enemy.name = 'Training skeleton';
        enemy.position.set(10, 0, 0); enemy.stats.hp = enemy.stats.maxHp = 10000; enemy.stats.hpRegen = 0;
        const walkRects = [{ x: 0, z: 0, width: 8, height: 24 }, { x: 10, z: 0, width: 8, height: 24 },
            ...(mode === 'wall' ? [] : [{ x: 5, z: 0, width: 4, height: 6 }])];
        const engine = { isMultiplayer: false, player: owner, renderSystem: render, effects: [],
            effectScene: render.effectGroup, scene: render.scene,
            currentInstanceId: 'offline-component-dungeon', currentInstanceType: 'verdant_bastion_catacombs',
            currentDungeonLayout: { walkRects }, collisionManager: new CollisionManager(),
            chunkManager: new ChunkManager(render.entityGroup), floatingTextManager: new FloatingTextManager(render.camera) };
        for (const method of ['addEntity', 'spawnTransientEffect', 'isHostileActorTarget', 'isInteractableEntity', 'isPlayerClassEntity']) {
            engine[method] = GameEngine.prototype[method].bind(engine);
        }
        engine.collisionManager.setDungeonWalkableGeometry(walkRects);
        for (const rect of walkRects) {
            const tile = new THREE.Mesh(new THREE.PlaneGeometry(rect.width, rect.height),
                new THREE.MeshStandardMaterial({ color: 0x3b4940, roughness: 1 }));
            tile.rotation.x = -Math.PI/2; tile.position.set(rect.x, -.03, rect.z);
            render.environmentGroup.add(tile);
        }
        await owner.ensureMesh(); await enemy.ensureMesh();
        engine.addEntity(owner);
        if (mode !== 'follow') engine.addEntity(enemy);
        const hits = [];
        const takeDamage = enemy.takeDamage.bind(enemy);
        enemy.takeDamage = (amount, attacker) => {
            hits.push({ amount, owner: attacker === owner, at: performance.now() });
            return takeDamage(amount, attacker);
        };
        const controls = document.createElement('div');
        Object.assign(controls.style, { position: 'fixed', top: '12px', left: '12px', zIndex: '300' });
        const addButton = (label, action) => {
            const button = document.createElement('button'); button.textContent = label;
            Object.assign(button.style, { minHeight: '44px', padding: '10px', fontSize: '16px' });
            button.onclick = action; controls.appendChild(button);
        };
        const qa = { engine, owner, enemy, hits, summon: null, summonMesh: null, casts: 0 };
        addButton('Summon fallback ally', () => {
            owner.useAbility(owner.position, engine, 'Avenging Seraph');
            qa.summon = [...(owner.offlineSeraphs || [])][0]; qa.casts++;
        });
        addButton('Move owner', () => owner.move(new THREE.Vector3(0, 0, 8)));
        addButton('Leave fixture instance', () => { engine.currentInstanceId = ''; });
        document.body.appendChild(controls);
        render.setCameraTarget(new THREE.Vector3(4, 0, 0)); render.setZoom(15);
        let previous = performance.now();
        function frame(now) {
            const dt = Math.min(.05, (now-previous)/1000); previous = now;
            engine.chunkManager.update(owner, dt, engine.collisionManager, engine.floatingTextManager, engine);
            for (const entity of engine.chunkManager.getActiveEntities()) entity.render(1);
            for (const effect of engine.effects) effect.update(dt);
            engine.effects = engine.effects.filter(effect => effect.isActive);
            if (qa.summon?.mesh) qa.summonMesh = qa.summon.mesh;
            engine.floatingTextManager.update(dt); render.render();
            qa.frame = requestAnimationFrame(frame);
        }
        window.__offlineSeraph = qa; qa.frame = requestAnimationFrame(frame);
    }, mode);
}

test('offline summon renders actual smites and expires through normal chunk updates', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await scene(page, 'combat');
    await page.getByRole('button', { name: 'Summon fallback ally' }).click();
    await expect.poll(() => page.evaluate(() => window.__offlineSeraph.hits.length)).toBeGreaterThan(1);
    expect(await page.evaluate(() => window.__offlineSeraph.hits.every(hit => hit.amount === 84 && hit.owner))).toBe(true);
    expect(await page.evaluate(() => window.__offlineSeraph.owner.stats.mana)).toBe(940);
    await expect.poll(() => page.evaluate(() => {
        const q = window.__offlineSeraph;
        return Boolean(q.summon?.mesh?.visible && q.summon.mesh.parent === q.engine.renderSystem.entityGroup);
    })).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('offline-seraph-smite.png') });
    await expect.poll(() => page.evaluate(() => window.__offlineSeraph.summon.isActive), { timeout: 22_000 }).toBe(false);
    expect(await page.evaluate(() => {
        const q = window.__offlineSeraph;
        return { owned: q.owner.offlineSeraphs.size, chunk: q.engine.chunkManager.getActiveEntities().includes(q.summon), attached: Boolean(q.summonMesh.parent) };
    })).toEqual({ owned: 0, chunk: false, attached: false });
    expect(failures, failures.join('\n')).toEqual([]);
});

test('offline summon cannot smite across disconnected dungeon floor', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await scene(page, 'wall');
    await page.getByRole('button', { name: 'Summon fallback ally' }).click();
    await expect.poll(() => page.evaluate(() => Boolean(window.__offlineSeraph.summon?.mesh?.parent))).toBe(true);
    await page.waitForTimeout(2200);
    expect(await page.evaluate(() => window.__offlineSeraph.hits.length)).toBe(0);
    expect(await page.evaluate(() => window.__offlineSeraph.enemy.stats.hp)).toBe(10000);
    await page.screenshot({ path: testInfo.outputPath('offline-seraph-wall.png') });
    expect(failures, failures.join('\n')).toEqual([]);
});

test('offline summon follows through actor collision and detaches on instance departure', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await scene(page, 'follow');
    await page.getByRole('button', { name: 'Summon fallback ally' }).click();
    await expect.poll(() => page.evaluate(() => Boolean(window.__offlineSeraph.summon?.mesh?.parent))).toBe(true);
    await page.getByRole('button', { name: 'Move owner', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__offlineSeraph.owner.position.z)).toBeGreaterThan(7.5);
    await expect.poll(() => page.evaluate(() => window.__offlineSeraph.summon.position.z)).toBeGreaterThan(4.5);
    const distance = await page.evaluate(() => window.__offlineSeraph.summon.position.distanceTo(window.__offlineSeraph.owner.position));
    expect(distance).toBeLessThan(3.5); expect(distance).toBeGreaterThan(2.5);
    await page.screenshot({ path: testInfo.outputPath('offline-seraph-follow.png') });
    await page.getByRole('button', { name: 'Leave fixture instance' }).click();
    await expect.poll(() => page.evaluate(() => window.__offlineSeraph.owner.offlineSeraphs.size)).toBe(0);
    expect(await page.evaluate(() => Boolean(window.__offlineSeraph.summonMesh.parent))).toBe(false);
    expect(failures, failures.join('\n')).toEqual([]);
});
