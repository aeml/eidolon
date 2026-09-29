import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

for (const [width, mobile] of [[1280, false], [390, true]]) {
    test(`combat health bars follow rendered enemies and the camera ${width}px`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height: 844 });
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async mobile => {
            const THREE = await import('three');
            const { RenderSystem } = await import('/src/core/RenderSystem.js');
            const { GameEngine } = await import('/src/core/GameEngine.js');
            const { UIManager } = await import('/src/ui/UIManager.js');
            const { Fighter } = await import('/src/entities/Fighter.js');
            const { Skeleton } = await import('/src/entities/Skeleton.js');
            const { Construct } = await import('/src/entities/Construct.js');
            const { QuestNPC } = await import('/src/entities/QuestNPC.js');
            const { WorldGenerator } = await import('/src/world/WorldGenerator.js');
            const { CollisionManager } = await import('/src/core/CollisionManager.js');
            const { createEarthPathNetwork } = await import('/src/art/ProceduralWorldPaths.js');
            const { InputManager } = await import('/src/core/InputManager.js');
            document.getElementById('start-screen').style.display = 'none';
            document.body.classList.toggle('mobile-mode', mobile);
            const render = new RenderSystem(mobile), ui = new UIManager(mobile);
            render.setGraphicsQuality(mobile ? 'low' : 'high'); await render.preloadEnvironment();
            const world = new WorldGenerator(render.instanceEnvironmentGroup, new CollisionManager(), { graphicsQuality: mobile ? 'low' : 'high' });
            await world.loadTrees(0, 200); render.instanceEnvironmentGroup.add(createEarthPathNetwork());
            const player = new Fighter('player-health-review'), target = new Skeleton('enemy-selected');
            const giant = new Construct('enemy-large'), idle = new Skeleton('enemy-idle'), npc = new QuestNPC('quest-review');
            const actors = [player, target, giant, idle, npc];
            const positions = [[0, 362], [-3, 358], [3, 355], [-5, 352], [7, 362]];
            for (const [i, actor] of actors.entries()) {
                actor.position.set(positions[i][0], 0, positions[i][1]);
                await actor.ensureMesh(); render.entityGroup.add(actor.mesh);
            }
            giant.stats.hp = Math.floor(giant.stats.maxHp * .7);
            const input = new InputManager(render.camera, render.scene, render.renderer.domElement);
            if (mobile) input.setupMobileControls();
            const engine = Object.assign(Object.create(GameEngine.prototype), {
                player, isMobile: mobile, frameCount: 1, renderSystem: render, uiManager: ui,
                inputManager: input, hoveredEntity: null, mobileCombatTarget: mobile ? target : null,
                combatIntent: { entity: target }, chunkManager: { getActiveEntities: () => actors },
                minimap: { update() {} }, worldMap: { isVisible: () => false },
                applyPlayerJumpVisuals() {}, applyPlayerCorrectionVisuals() {}, applyEntityJumpVisuals() {}
            });
            let reconciles = 0;
            const reconcile = ui.updateEnemyBars.bind(ui);
            ui.updateEnemyBars = (...args) => { reconciles++; return reconcile(...args); };
            ui.showHUD(); ui.toggleChat(true);
            render.onWindowResize(); render.setCameraTarget(player.position);
            render.applyLightingPreset('earth', true); render.updateEnvironmentLighting(player.position, 0);
            engine.render(1);
            const alignment = () => [...ui.floatingBars].map(([id, bar]) => {
                const actor = actors.find(actor => actor.id === id), point = new THREE.Vector3(0, actor.mesh.userData.bounds.height + .18, 0);
                actor.mesh.localToWorld(point); point.project(render.camera);
                const rect = bar.getBoundingClientRect();
                return { id, dx: Math.abs(rect.x + rect.width / 2 - (point.x + 1) * innerWidth / 2),
                    dy: Math.abs(rect.y + rect.height / 2 - (1 - point.y) * innerHeight / 2) };
            });
            window.__healthReview = { engine, ui, target, render, actors, alignment, reconciles: () => reconciles };
        }, mobile);
        const selected = page.locator('.floating-bar[data-entity-id="enemy-selected"]');
        await expect(selected).toBeVisible();
        await expect(page.locator('.floating-bar:visible')).toHaveCount(2);
        const before = await selected.boundingBox();
        const moved = await page.evaluate(() => {
            const { engine, target, render, alignment, reconciles } = window.__healthReview;
            target.position.x += 1.5; engine.render(1);
            render.setCameraTarget(engine.player.position.clone().addScalar(1)); engine.render(1);
            return { alignment: alignment(), reconciles: reconciles() };
        });
        expect(moved.reconciles).toBe(1);
        for (const row of moved.alignment) { expect(row.dx).toBeLessThan(.1); expect(row.dy).toBeLessThan(.1); }
        expect((await selected.boundingBox()).x).not.toBe(before.x);
        await page.evaluate(() => {
            const { target, engine } = window.__healthReview;
            target.stats.hp = Math.floor(target.stats.maxHp * .4); engine.render(1);
            engine.combatIntent = null; engine.mobileCombatTarget = null; engine.render(1);
        });
        await expect(selected).toBeVisible();
        await expect(selected).not.toHaveClass(/selected/);
        await page.screenshot({ path: testInfo.outputPath('earth-combat-health.png'), style: '#perf-overlay { visibility: hidden !important; }' });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const reduced = await page.evaluate(() => {
            const { target, engine, ui } = window.__healthReview;
            target.stats.hp = 1; engine.render(1);
            const bar = ui.floatingBars.get(target.id);
            return { fill: bar._fill.style.transform, trail: bar._trail.style.transform };
        });
        expect(reduced.trail).toBe(reduced.fill);
        await page.evaluate(() => { window.__healthReview.engine.inputManager.keys.alt = true; window.__healthReview.engine.render(1); });
        await expect(page.locator('.floating-bar[data-entity-id="quest-review"]')).toHaveCount(0);
        await page.evaluate(() => {
            const { target, engine } = window.__healthReview;
            target.stats.hp = 0; target.state = 'DEAD'; engine.render(1);
        });
        await expect(selected).toBeHidden();
        expect(await page.evaluate(() => window.__healthReview.ui.floatingBars.has('enemy-selected'))).toBe(false);
        const fading = await page.evaluate(() => {
            const { target, engine } = window.__healthReview;
            // Exercise the production corpse updater and actual death clip;
            // authoritative death is prepared, not an earned network kill.
            target.state = 'IDLE'; target.isRemote = true; target.die();
            target.serverEntityType = 'Enemy'; engine.remotePlayers = new Map([[target.id, target]]);
            engine.updateRemoteCorpsePresentation(.01);
            const effect = target.corpsePresentation;
            target.updateAnimationMixer(effect.hold + .2);
            engine.updateRemoteCorpsePresentation(effect.hold + .2); engine.render(1);
            return { visible: target.mesh.visible, materials: effect.materials.size,
                fading: [...effect.materials].every(([source, copy]) => copy.opacity > 0 && copy.opacity < source.opacity) };
        });
        expect(fading.visible).toBe(true); expect(fading.materials).toBeGreaterThan(0); expect(fading.fading).toBe(true);
        await page.screenshot({ path: testInfo.outputPath('enemy-corpse-fade.png'), style: '#perf-overlay { visibility: hidden !important; }' });
        expect(await page.evaluate(() => {
            const { target, engine } = window.__healthReview;
            engine.updateRemoteCorpsePresentation(.5); engine.render(1);
            return !target.mesh.visible && target.corpsePresentation.materials.size === 0;
        })).toBe(true);
        await page.evaluate(() => window.__healthReview.ui.clearEnemyBars());
        await expect(page.locator('.floating-bar')).toHaveCount(0);
        expect(failures).toEqual([]);
    });
}
