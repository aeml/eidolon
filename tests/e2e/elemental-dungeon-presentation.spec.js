import fs from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

const fixtures = JSON.parse(fs.readFileSync('tests/fixtures/production-dungeon-layouts.json', 'utf8'));
const methods = { molten_core: 'createMoltenCore', tempest_spire: 'createTempestSpire',
    abyssal_well: 'createAbyssalWell', umbral_nexus: 'createUmbralNexus' };

for (const [width, height, mobile] of [[1280, 900, false], [390, 844, true]]) {
    test(`equipped elemental dungeon rooms at ${width}px`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'networkidle' });
        const actor = await page.evaluate(async mobile => {
            const { RenderSystem } = await import('/src/core/RenderSystem.js');
            const { UIManager } = await import('/src/ui/UIManager.js');
            const { InputManager } = await import('/src/core/InputManager.js');
            const { Fighter } = await import('/src/entities/Fighter.js');
            const { BASE_ITEMS } = await import('/src/core/ItemSystem.js');
            document.getElementById('start-screen').style.display = 'none';
            document.body.classList.toggle('mobile-mode', mobile);
            const render = new RenderSystem(mobile), ui = new UIManager(mobile);
            render.setGraphicsQuality(mobile ? 'low' : 'high');
            await render.preloadEnvironment();
            const input = new InputManager(render.camera, render.scene, render.renderer.domElement);
            if (mobile) input.setupMobileControls();
            ui.showHUD(); ui.toggleChat(true);
            const hero = new Fighter('dungeon-art-review');
            await hero.ensureMesh();
            const loadout = { head: 'Iron Helm', shoulders: 'Steel Pauldrons', chest: 'Plate Mail',
                gloves: 'Iron Gauntlets', belt: 'Plated Girdle', legs: 'Plate Greaves', feet: 'Iron Boots',
                neck: 'Pendant', ring1: 'Ruby Ring', ring2: 'Gold Ring', trinket1: 'Amulet of Power',
                trinket2: 'Talisman of Speed', mainHand: 'Iron Sword', offHand: 'Wooden Shield' };
            hero.syncEquipmentVisuals(Object.fromEntries(Object.entries(loadout).map(([slot, name]) => {
                const base = BASE_ITEMS.find(item => item.name === name);
                if (!base) throw new Error(`Missing dungeon review gear: ${name}`);
                return [slot, { ...base, id: `dungeon-review-${slot}`, baseName: name, name, level: 70,
                    rarity: slot === 'mainHand' ? 'Rare' : 'Uncommon', stats: {}, potency: 0,
                    sockets: 0, gems: [], setId: '', uniqueEffect: '' }];
            })), { force: true });
            await hero.mesh.userData.equipmentReady;
            render.entityGroup.add(hero.mesh); ui.updatePlayerStats(hero);
            render.onWindowResize();
            window.__dungeonArtReview = { render, hero, input };
            return { authoredClass: hero.mesh.userData.authoredClass, items: hero.mesh.userData.equipmentVisualItemCount };
        }, mobile);
        expect(actor).toEqual({ authoredClass: 'Fighter', items: 14 });
        const samples = [];
        for (const [type, method] of Object.entries(methods)) {
            const { layout } = fixtures.find(fixture => fixture.dungeonType === type);
            for (const view of ['center', 'wall']) {
                const sample = await page.evaluate(async ({ type, method, layout, view }) => {
                    const { WorldGenerator } = await import('/src/world/WorldGenerator.js');
                    const { CollisionManager } = await import('/src/core/CollisionManager.js');
                    const { render, hero } = window.__dungeonArtReview;
                    if (view === 'center') {
                        render.disposeObjectResources(render.instanceEnvironmentGroup);
                        render.instanceEnvironmentGroup.clear();
                        const collision = new CollisionManager(); collision.setDungeonWalkableGeometry(layout.walkRects);
                        const world = new WorldGenerator(render.instanceEnvironmentGroup, collision,
                            { graphicsQuality: render.graphicsQuality });
                        await world[method](0, 0, layout);
                    }
                    const room = layout.rooms[0];
                    hero.position.set(room.x - (view === 'wall' ? room.width / 2 - 8 : 0), .1, room.z - (view === 'wall' ? 10 : 0));
                    hero.mesh.position.copy(hero.position);
                    render.setEnvironmentContext(type, hero.position, true);
                    render.setCameraTarget(hero.position); render.updateEnvironmentLighting(hero.position, 0);
                    render.render(); render.render();
                    const floor = render.instanceEnvironmentGroup.getObjectByName('DungeonUnionFloor');
                    const walls = render.instanceEnvironmentGroup.children.filter(part => part.name === 'ProceduralDungeonWall');
                    const detailed = walls.filter(part => part.geometry.userData.elementalWall === type);
                    return { type, view, zoom: render.currentZoom,
                        floorSize: floor.material.map.image.width,
                        detailedWalls: detailed.length,
                        maxWallTriangles: Math.max(...detailed.map(part => part.geometry.attributes.position.count / 3)),
                        layeredCutaways: walls.filter(part => part.material.transparent && part.geometry.type !== 'BoxGeometry').length,
                        calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles };
                }, { type, method, layout, view });
                expect(sample.zoom).toBe(15); expect(sample.floorSize).toBe(mobile ? 64 : 256);
                expect(sample.calls).toBeGreaterThan(1); expect(sample.triangles).toBeGreaterThan(100);
                expect(sample.detailedWalls).toBeGreaterThan(0); expect(sample.maxWallTriangles).toBeLessThanOrEqual(3000);
                expect(sample.layeredCutaways).toBe(0);
                samples.push(sample);
                await page.screenshot({ path: testInfo.outputPath(`${type}-${view}.png`),
                    style: '#perf-overlay { visibility: hidden !important; }' });
            }
        }
        await writeFile(testInfo.outputPath('render-scopes.json'), JSON.stringify(samples, null, 2));
        await page.evaluate(() => window.__dungeonArtReview.input.dispose());
        expect(failures).toEqual([]);
    });
}
