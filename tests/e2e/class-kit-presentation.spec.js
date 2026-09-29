import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

// Bounded prepared component scenes using real actors/casts/chunk updates and
// renderer. These inspect the changed effects, not earned or network gameplay.
const cases = [
    { className: 'Wizard', branch: 'B', skills: ['Spell Focus', 'Scorch Beam', 'Arcane Missiles'], kind: 'precision' },
    { className: 'Fighter', branch: 'B', skills: ['Juggernaut Charge'], kind: 'charge' },
    { className: 'Fighter', branch: 'C', skills: ['Berserker Edge', 'Last Stand Rampage'], kind: 'ward' },
    { className: 'Rogue', branch: 'C', skills: ['Poison Coating', 'Tripwire'], kind: 'trap' },
    { className: 'Cleric', branch: 'C', skills: ['Blessing of Zeal', 'Spirit Guardians'], kind: 'guardians' }
];

for (const entry of cases) {
    test(`${entry.className} ${entry.branch}: changed kit effects render at combat scale`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.setViewportSize({ width: 900, height: 600 });
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.goto('/', { waitUntil: 'networkidle' });
        const receipt = await page.evaluate(async entry => {
            const THREE = await import('three');
            const { RenderSystem } = await import('/src/core/RenderSystem.js');
            const { GameEngine } = await import('/src/core/GameEngine.js');
            const { ChunkManager } = await import('/src/core/ChunkManager.js');
            const { CollisionManager } = await import('/src/core/CollisionManager.js');
            const { FloatingTextManager } = await import('/src/ui/FloatingTextManager.js');
            const { CONSTANTS } = await import('/src/core/Constants.js');
            const { Actor } = await import('/src/entities/Actor.js');
            const module = await import(`/src/entities/${entry.className}.js`);
            document.getElementById('start-screen').style.display = 'none';
            const render = new RenderSystem(false);
            document.body.appendChild(render.renderer.domElement);
            const owner = new module[entry.className]('kit-preview');
            owner.name = `${entry.className} ${entry.branch}`;
            owner.level = 40; owner.recalculateStats();
            owner.stats.mana = owner.stats.maxMana = 1000;
            owner.stats.hpRegen = owner.stats.manaRegen = 0;
            const tree = CONSTANTS.SKILL_TREES[entry.className];
            owner.unlockedSkills = [tree.Tier1.name, ...[2, 3, 4, 5].map(t => tree[`Branch${entry.branch}`][`Tier${t}`].name)];
            const enemy = new Actor('preview-enemy', {});
            enemy.meshType = 'Skeleton'; enemy.name = 'Training target';
            enemy.position.set(entry.kind === 'trap' ? 10 : 6, 0, 0);
            enemy.stats.hp = enemy.stats.maxHp = 10000; enemy.stats.hpRegen = 0;
            const engine = { isMultiplayer: false, player: owner, renderSystem: render, effects: [],
                effectScene: render.effectGroup, scene: render.scene, collisionManager: new CollisionManager(),
                chunkManager: new ChunkManager(render.entityGroup), floatingTextManager: new FloatingTextManager(render.camera) };
            for (const method of ['addEntity', 'spawnTransientEffect', 'isHostileActorTarget', 'isInteractableEntity', 'isPlayerClassEntity']) {
                engine[method] = GameEngine.prototype[method].bind(engine);
            }
            const floor = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), new THREE.MeshStandardMaterial({ color: 0x343e3a, roughness: 1 }));
            floor.rotation.x = -Math.PI / 2; floor.position.y = -.03; render.environmentGroup.add(floor);
            await owner.ensureMesh(); await enemy.ensureMesh();
            engine.addEntity(owner); engine.addEntity(enemy);
            engine.chunkManager.update(owner, 0, engine.collisionManager, engine.floatingTextManager, engine);
            const aim = new THREE.Vector3(entry.kind === 'charge' ? 8 : 6, 0, 0);
            const mana = owner.stats.mana;
            // Admit a short bounded span of normal chunk updates. No actor or
            // effect is manually marked active to make the screenshot pass.
            const advance = steps => {
                for (let step = 0; step < steps; step++) {
                    engine.chunkManager.update(owner, .04, engine.collisionManager, engine.floatingTextManager, engine);
                    for (const entity of engine.chunkManager.getActiveEntities()) entity.render(1);
                    for (const effect of engine.effects) effect.update(.04);
                    engine.effects = engine.effects.filter(effect => effect.isActive);
                    engine.floatingTextManager.update(.04);
                }
            };
            for (const [index, skill] of entry.skills.entries()) {
                if (index) advance(20); // Do not stack every cast flash in one frame.
                owner.useAbility(aim.clone(), engine, skill);
            }
            advance(5);
            render.setCameraTarget(new THREE.Vector3(3, 0, 0)); render.setZoom(22); render.render();
            window.__kitPresentation = { owner, enemy, engine, render };
            return { spent: mana - owner.stats.mana, shield: owner.shieldHP || 0, x: owner.position.x,
                active: owner.isActive, traps: owner.traps?.map(t => ({ x: t.position.x, z: t.position.z })) || [],
                guardians: owner.spiritEffect?.guardians?.length || 0, boosted: Boolean(owner.spiritBoosted),
                radius: owner.spiritEffect?.effectRadius || 0, effects: engine.effects.length,
                cooldowns: Object.fromEntries(entry.skills.map(skill => [skill, owner.cooldowns[skill]])) };
        }, entry);
        expect(receipt.active).toBe(true);
        expect(Object.values(receipt.cooldowns).every(value => value > 0)).toBe(true);
        if (entry.kind !== 'ward') expect(receipt.spent).toBeGreaterThan(0);
        if (entry.kind === 'ward' || entry.kind === 'precision') expect(receipt.shield).toBeGreaterThan(0);
        if (entry.kind === 'charge') expect(receipt.x).toBeCloseTo(8);
        if (entry.kind === 'trap') expect(receipt.traps).toEqual([{ x: 6, z: 0 }]);
        if (entry.kind === 'guardians') {
            expect(receipt.boosted).toBe(true); expect(receipt.guardians).toBeGreaterThan(0); expect(receipt.radius).toBe(20);
        }
        await page.screenshot({ path: testInfo.outputPath(`${entry.kind}.png`) });
        await testInfo.attach('cast-receipt', { body: JSON.stringify(receipt), contentType: 'application/json' });
        await page.evaluate(() => {
            const { engine, owner, enemy } = window.__kitPresentation;
            for (const entity of engine.chunkManager.getActiveEntities()) entity.dispose?.();
            owner.dispose(); enemy.dispose(); engine.effects.forEach(effect => effect.dispose());
        });
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
