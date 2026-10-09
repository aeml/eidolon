import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';
import { compareFilmicLighting } from './lighting-comparison.js';

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
            const { BASE_ITEMS } = await import('/src/core/ItemSystem.js');
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
            // Ordinary authored equipment in the actual populated scene, not
            // an unequipped gallery body or an endgame balance fixture.
            const loadout = { head: 'Iron Helm', shoulders: 'Steel Pauldrons', chest: 'Plate Mail',
                gloves: 'Iron Gauntlets', belt: 'Plated Girdle', legs: 'Plate Greaves', feet: 'Iron Boots',
                neck: 'Pendant', ring1: 'Ruby Ring', ring2: 'Gold Ring', trinket1: 'Amulet of Power',
                trinket2: 'Talisman of Speed', mainHand: 'Iron Sword', offHand: 'Wooden Shield' };
            const equipment = Object.fromEntries(Object.entries(loadout).map(([slot, name]) => {
                const base = BASE_ITEMS.find(item => item.name === name);
                if (!base) throw new Error(`Missing town-review equipment: ${name}`);
                return [slot, { ...base, id: `town-review-${slot}`, baseName: name, name,
                    level: 30, rarity: slot === 'mainHand' ? 'Rare' : 'Uncommon', stats: {},
                    potency: 0, sockets: 0, gems: [], setId: '', uniqueEffect: '' }];
            }));
            hero.syncEquipmentVisuals(equipment, { force: true });
            await hero.mesh.userData.equipmentReady;
            hero.mesh.position.copy(hero.position); render.entityGroup.add(hero.mesh);
            ui.updatePlayerStats(hero);
            const collision = new CollisionManager();
            const world = new WorldGenerator(render.instanceEnvironmentGroup, collision, { graphicsQuality: mobile ? 'low' : 'high' });
            await world.loadBuildings(0, 200);
            // Services are replicated entities in production, not buildings
            // owned by loadBuildings. Include them before judging town density.
            for (const [type, x, z, yaw] of [['TradingHouse', -22, 185, Math.PI / 4],
                ['Forge', -28, 218, Math.PI / 2], ['Stash', -28, 210, Math.PI / 2],
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
                authoredClass: hero.mesh.userData.authoredClass,
                equipment: hero.mesh.userData.equipmentVisualItemCount,
                courtSize: render.groundTown.material.userData.townGroundComposition.paving.color.image.width,
                shadowFocused: render.shadowTarget.distanceTo(hero.position) < 1,
                streetBatches: streetMeshes.length,
                streetCells: streetMeshes.reduce((total, mesh) => total + mesh.userData.streetCells.length, 0),
                streetSolids: streets.userData.walkFootprints.length };
        }, mobile);
        await page.screenshot({ path: testInfo.outputPath('town-court.png'), style: '#perf-overlay { visibility: hidden !important; }' });
        await compareFilmicLighting(page, testInfo, '__courtReview', 'town');
        for (const [label, x, z] of [['market', 22, 200], ['smithy', -20, 200], ['casino', 0, 183], ['well', 55, 248]]) {
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
            authoredClass: 'Fighter', equipment: 14,
            streetBatches: 6, streetCells: 12, streetSolids: 4 });
        const camp = await page.evaluate(async () => {
            const { createLanternholdCampPlacements } = await import('/src/art/ProceduralLanternholdArchitecture.js');
            const { render, hero } = window.__courtReview;
            const placement = createLanternholdCampPlacements(0, 200)[0];
            hero.position.set(placement.x + 4, 0, placement.z + 4); hero.mesh.position.copy(hero.position);
            render.setCameraTarget(hero.position); render.updateEnvironmentLighting(hero.position, 0);
            render.render(); render.render();
            const field = render.instanceEnvironmentGroup.getObjectByName('Lanternhold:Pilgrim Vigil Field');
            return { camps: field.userData.instanceCount, batches: field.children.length };
        });
        expect(camp).toEqual({ camps: 15, batches: 9 });
        await page.screenshot({ path: testInfo.outputPath('town-pilgrim-camp.png'), style: '#perf-overlay { visibility: hidden !important; }' });
        expect(failures).toEqual([]);
    });
}
