import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';
import { compareFilmicLighting } from './lighting-comparison.js';
import { reviewDungeonProps } from './dungeon-prop-review.js';

const fixture = JSON.parse(fs.readFileSync('tests/fixtures/production-dungeon-layouts.json', 'utf8'))
    .find(value => value.dungeonType === 'verdant_bastion_catacombs');

// Prepared presentation at production camera scale/HUD, not server gameplay.
for (const [width, height, mobile] of [[1280, 900, false], [390, 844, true]]) {
    test(`Verdant masonry with gameplay HUD at ${width}px`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'networkidle' });
        const result = await page.evaluate(async ({ layout, mobile }) => {
            const { RenderSystem } = await import('/src/core/RenderSystem.js');
            const { WorldGenerator } = await import('/src/world/WorldGenerator.js');
            const { CollisionManager } = await import('/src/core/CollisionManager.js');
            const { UIManager } = await import('/src/ui/UIManager.js');
            const { InputManager } = await import('/src/core/InputManager.js');
            const { Fighter } = await import('/src/entities/Fighter.js');
            const { applyDungeonRoomStatePresentation } = await import('/src/art/ProceduralDungeonInteriors.js');
            document.getElementById('start-screen').style.display = 'none';
            document.body.classList.toggle('mobile-mode', mobile);
            const render = new RenderSystem(mobile), ui = new UIManager(mobile);
            render.setGraphicsQuality(mobile ? 'low' : 'high');
            await render.preloadEnvironment();
            const input = new InputManager(render.camera, render.scene, render.renderer.domElement);
            if (mobile) input.setupMobileControls();
            ui.showHUD(); ui.toggleChat(true);
            const hero = new Fighter('masonry-review');
            await hero.ensureMesh();
            hero.position.set(layout.rooms[0].x, 0, layout.rooms[0].z);
            hero.mesh.position.copy(hero.position); render.entityGroup.add(hero.mesh);
            ui.updatePlayerStats(hero);
            ui.quest.renderObjectivesPanel([{ id: 'room', title: 'Explore the Thorncrypt', progressLabel: 'Entry', hint: 'Prepared art review' }]);
            const generator = new WorldGenerator(render.instanceEnvironmentGroup, new CollisionManager());
            await generator.createVerdantBastionCatacombs(0, 0, layout);
            render.instanceEnvironmentGroup.traverse(part => {
                if (part.userData.proceduralDungeonRoomState && part.userData.roomIndex === 0)
                    applyDungeonRoomStatePresentation(part, { cleared: false }, { currentRoomIndex: 0, objectiveRoomIndex: 0 });
            });
            render.setEnvironmentContext('verdant_bastion_catacombs', hero.position, true);
            render.onWindowResize(); render.setCameraTarget(hero.position);
            render.updateEnvironmentLighting(hero.position, 0); render.render(); render.render();
            window.__masonryReview = { render, hero, ui };
            const floor = render.instanceEnvironmentGroup.getObjectByName('DungeonUnionFloor');
            return { zoom: render.currentZoom, textureSize: floor.material.map.image.width,
                width: floor.material.map.repeat.x, height: floor.material.map.repeat.y };
        }, { layout: fixture.layout, mobile });
        await page.screenshot({ path: testInfo.outputPath('verdant-room.png'), style: '#perf-overlay { visibility: hidden !important; }' });
        await compareFilmicLighting(page, testInfo, '__masonryReview', 'verdant');
        const wallReview = await page.evaluate(room => {
            const { render, hero } = window.__masonryReview;
            hero.position.set(room.x - room.width / 2 + 8, 0, room.z - 10);
            hero.mesh.position.copy(hero.position);
            render.setCameraTarget(hero.position);
            render.updateEnvironmentLighting(hero.position, 0); render.render(); render.render();
            const walls = render.instanceEnvironmentGroup.children.filter(part => part.name === 'ProceduralDungeonWall');
            return { detailed: walls.filter(part => part.geometry.userData.cryptWall).length,
                cutaway: walls.filter(part => part.material.transparent && part.geometry.type === 'BoxGeometry').length };
        }, fixture.layout.rooms[0]);
        await page.screenshot({ path: testInfo.outputPath('verdant-wall.png'), style: '#perf-overlay { visibility: hidden !important; }' });
        expect(wallReview.detailed).toBeGreaterThan(0);
        expect(wallReview.cutaway).toBeGreaterThan(0);
        expect(result.zoom).toBe(15);
        expect(result.textureSize).toBe(256);
        await reviewDungeonProps(page, testInfo, '__masonryReview', 'verdant_bastion_catacombs', fixture.layout);
        expect(failures).toEqual([]);
    });
}
