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
            const world = new WorldGenerator(render.instanceEnvironmentGroup, collision);
            await world.loadBuildings(0, 200);
            render.onWindowResize(); render.setCameraTarget(hero.position);
            render.applyLightingPreset('town', true); render.render(); render.render();
            window.__courtReview = { render, hero };
            return { zoom: render.currentZoom, opaque: !render.groundTown.material.transparent,
                courtSize: render.groundTown.material.userData.townGroundComposition.paving.color.image.width };
        }, mobile);
        await page.screenshot({ path: testInfo.outputPath('town-court.png'), style: '#perf-overlay { visibility: hidden !important; }' });
        for (const [label, x] of [['market', 22], ['smithy', -20]]) {
            await page.evaluate(x => {
                const { render, hero } = window.__courtReview;
                hero.position.set(x, 0, 200); hero.mesh.position.copy(hero.position);
                render.setCameraTarget(hero.position); render.render(); render.render();
            }, x);
            await page.screenshot({ path: testInfo.outputPath(`town-${label}.png`), style: '#perf-overlay { visibility: hidden !important; }' });
        }
        expect(result).toEqual({ zoom: 15, opaque: true, courtSize: mobile ? 256 : 512 });
        expect(failures).toEqual([]);
    });
}
