import { test, expect } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

for (const [width, height, mobile] of [[1280, 900, false], [390, 844, true]]) {
    test(`Moonfrost equipped gameplay presentation ${width}px`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'networkidle' });
        const equipment = await page.evaluate(async mobile => {
            const { RenderSystem } = await import('/src/core/RenderSystem.js');
            const { WorldGenerator } = await import('/src/world/WorldGenerator.js');
            const { CollisionManager } = await import('/src/core/CollisionManager.js');
            const { UIManager } = await import('/src/ui/UIManager.js');
            const { InputManager } = await import('/src/core/InputManager.js');
            const { Wizard } = await import('/src/entities/Wizard.js');
            const { BASE_ITEMS } = await import('/src/core/ItemSystem.js');
            document.getElementById('start-screen').style.display = 'none';
            document.body.classList.toggle('mobile-mode', mobile);
            const render = new RenderSystem(mobile), ui = new UIManager(mobile);
            render.setGraphicsQuality(mobile ? 'low' : 'high');
            await render.preloadEnvironment();
            const input = new InputManager(render.camera, render.scene, render.renderer.domElement);
            if (mobile) input.setupMobileControls();
            ui.showHUD(); ui.toggleChat(true);
            const hero = new Wizard('water-art-review');
            await hero.ensureMesh();
            const loadout = { head: 'Silk Hood', shoulders: 'Velvet Mantle', chest: 'Robes',
                gloves: 'Silk Gloves', belt: 'Silk Sash', legs: 'Silk Skirt', feet: 'Sandals',
                neck: 'Necklace', ring1: 'Silver Ring', ring2: 'Gold Ring', trinket1: 'Amulet of Power',
                trinket2: 'Talisman of Speed', mainHand: 'Wooden Staff', offHand: 'Spell Tome' };
            const gear = Object.fromEntries(Object.entries(loadout).map(([slot, name]) => {
                const base = BASE_ITEMS.find(item => item.name === name);
                if (!base) throw new Error(`Missing Water review equipment: ${name}`);
                return [slot, { ...base, id: `water-review-${slot}`, baseName: name, name, level: 60,
                    rarity: slot === 'mainHand' ? 'Rare' : 'Uncommon', stats: {}, potency: 0,
                    sockets: 0, gems: [], setId: '', uniqueEffect: '' }];
            }));
            hero.syncEquipmentVisuals(gear, { force: true });
            await hero.mesh.userData.equipmentReady;
            render.entityGroup.add(hero.mesh); ui.updatePlayerStats(hero);
            const world = new WorldGenerator(render.instanceEnvironmentGroup, new CollisionManager(),
                { graphicsQuality: mobile ? 'low' : 'high' });
            await world.loadBuildings(0, 200);
            await world.loadTrees(0, 200);
            render.onWindowResize(); render.applyLightingPreset('water', true);
            window.__waterArtReview = { render, hero, input };
            return { authoredClass: hero.mesh.userData.authoredClass,
                visualItems: hero.mesh.userData.equipmentVisualItemCount, zoom: render.currentZoom };
        }, mobile);
        expect(equipment).toEqual({ authoredClass: 'Wizard', visualItems: 14, zoom: 15 });
        for (const [label, x, z] of [['tide-rib', 0, -1160], ['flotilla', 230, -1770], ['refuge', -360, -969]]) {
            const result = await page.evaluate(({ x, z }) => {
                const { render, hero } = window.__waterArtReview;
                hero.position.set(x, 0, z); hero.mesh.position.copy(hero.position);
                render.setCameraTarget(hero.position); render.updateEnvironmentLighting(hero.position, 0);
                render.render(); render.render();
                const ground = render.groundSnow.material;
                return { terrainKey: ground.userData.terrainKey,
                    textureSize: ground.map.image.width, normalSize: ground.normalMap.image.width,
                    roughnessSize: ground.roughnessMap.image.width, emissiveIntensity: ground.emissiveIntensity,
                    calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles };
            }, { x, z });
            expect(result).toMatchObject({ terrainKey: 'water', textureSize: mobile ? 128 : 256,
                normalSize: mobile ? 128 : 256, roughnessSize: mobile ? 128 : 256, emissiveIntensity: 0 });
            expect(result.calls).toBeGreaterThan(1); expect(result.triangles).toBeGreaterThan(100);
            await testInfo.attach(`${label}-render-scope`, { body: JSON.stringify(result), contentType: 'application/json' });
            await page.screenshot({ path: testInfo.outputPath(`water-${label}.png`),
                style: '#perf-overlay { visibility: hidden !important; }' });
        }
        await page.evaluate(() => window.__waterArtReview.input.dispose());
        expect(failures).toEqual([]);
    });
}
