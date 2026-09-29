import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

for (const [width, height, mobile] of [[1280, 900, false], [390, 844, true]]) {
    test(`town gathering court at gameplay scale ${width}px`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'networkidle' });
        const result = await page.evaluate(async mobile => {
            const { RenderSystem } = await import('/src/core/RenderSystem.js');
            const { WorldGenerator } = await import('/src/world/WorldGenerator.js');
            const { CollisionManager } = await import('/src/core/CollisionManager.js');
            const { UIManager } = await import('/src/ui/UIManager.js');
            const { InputManager } = await import('/src/core/InputManager.js');
            const { Fighter } = await import('/src/entities/Fighter.js');
            const { MeshFactory } = await import('/src/utils/MeshFactory.js');
            const { getLanternholdWalkCollider } = await import('/src/art/ProceduralLanternholdArchitecture.js');
            document.getElementById('start-screen').style.display = 'none';
            document.body.classList.toggle('mobile-mode', mobile);
            const render = new RenderSystem(mobile), ui = new UIManager(mobile);
            render.setGraphicsQuality(mobile ? 'low' : 'high');
            await render.preloadEnvironment();
            const input = new InputManager(render.camera, render.scene, render.renderer.domElement);
            if (mobile) input.setupMobileControls();
            ui.showHUD(); ui.toggleChat(true);
            const hero = new Fighter('town-review');
            await hero.ensureMesh(); hero.position.set(0, 0, 200);
            hero.mesh.position.copy(hero.position); render.entityGroup.add(hero.mesh);
            ui.updatePlayerStats(hero);
            const collision = new CollisionManager();
            const world = new WorldGenerator(render.instanceEnvironmentGroup, collision, { graphicsQuality: mobile ? 'low' : 'high' });
            await world.loadBuildings(0, 200);
            // Services are replicated entities in production, not buildings
            // owned by loadBuildings. Include them before judging town density.
            for (const [type, x, z, yaw] of [['TradingHouse', -22, 185, Math.PI / 4],
                ['Forge', -28, 218, Math.PI / 2], ['Stash', -16, 193, 0],
                ['QuestNPC', -20, 200, Math.PI / 2], ['DwarfSalesman', 22.5, 200, -Math.PI / 2],
                ['Wizard', 20, 215, -Math.PI / 2], ['RespecNPC', 0, 220, 0], ['DungeonNPC', 0, 240, Math.PI]]) {
                const mesh = await MeshFactory.createMeshForType(type);
                mesh.position.set(x, .5, z); mesh.rotation.y = yaw;
                render.entityGroup.add(mesh);
                const collider = getLanternholdWalkCollider(mesh);
                if (collider) collision.addOrientedCollider(collider);
            }
            render.onWindowResize(); render.setCameraTarget(hero.position);
            render.applyLightingPreset('town', true);
            render.updateEnvironmentLighting(hero.position, 0);
            render.render(); render.render();
            window.__courtReview = { render, hero, collision };
            const streets = render.instanceEnvironmentGroup.getObjectByName('Lanternhold planted street edges');
            const streetMeshes = []; streets.traverse(part => { if (part.isMesh) streetMeshes.push(part); });
            return { zoom: render.currentZoom, opaque: !render.groundTown.material.transparent,
                courtSize: render.groundTown.material.userData.townGroundComposition.paving.color.image.width,
                shadowFocused: render.shadowTarget.distanceTo(hero.position) < 1,
                streetBatches: streetMeshes.length,
                streetSolids: streets.userData.walkFootprints.length };
        }, mobile);
        await page.screenshot({ path: testInfo.outputPath('town-court.png'), style: '#perf-overlay { visibility: hidden !important; }' });
        for (const [label, x, z] of [['market', 22, 200], ['smithy', -20, 200], ['casino', 0, 183]]) {
            await page.evaluate(({ x, z }) => {
                const { render, hero } = window.__courtReview;
                hero.position.set(x, 0, z); hero.mesh.position.copy(hero.position);
                render.setCameraTarget(hero.position);
                render.updateEnvironmentLighting(hero.position, 0);
                render.render(); render.render();
            }, { x, z });
            await page.screenshot({ path: testInfo.outputPath(`town-${label}.png`), style: '#perf-overlay { visibility: hidden !important; }' });
        }
        expect(result).toEqual({ zoom: 15, opaque: true, courtSize: mobile ? 256 : 512, shadowFocused: true,
            streetBatches: 12, streetSolids: 4 });
        expect(failures).toEqual([]);
    });
}
