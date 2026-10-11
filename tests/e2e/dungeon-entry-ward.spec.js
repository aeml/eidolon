import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';
import { DUNGEON_INTERIOR_IDS } from '../../src/art/ProceduralDungeonInteriors.js';

const fixtures = JSON.parse(await readFile('tests/fixtures/production-dungeon-layouts.json', 'utf8'))
    .filter(fixture => DUNGEON_INTERIOR_IDS.includes(fixture.dungeonType));
const compareFloor = process.env.EIDOLON_E2E_DUNGEON_FLOOR_COMPARE === '1';
const comparePredecessor = process.env.EIDOLON_E2E_DUNGEON_WARD_COMPARE === '1' || compareFloor;
const referenceCommit = process.env.EIDOLON_E2E_DUNGEON_WARD_REFERENCE || '7f966b58';
for (const [quality, width] of [['high', 1280], ['low', 390]]) test(`${quality}: grounded entry wards retain dungeon state and walkable layout`, async ({ page, baseURL }, testInfo) => {
    test.setTimeout(180000);
    const failures = collectBrowserFailures(page, baseURL);
    if (comparePredecessor) {
        let previous = execFileSync('git', ['show', `${referenceCommit}:src/art/ProceduralDungeonInteriors.js`], { encoding: 'utf8' });
        if (compareFloor) {
            previous = previous.replace("'./VerdantMasonry.js'", "'./VerdantMasonryReference.js'");
            const masonry = execFileSync('git', ['show', `${referenceCommit}:src/art/VerdantMasonry.js`], { encoding: 'utf8' })
                .replace("'./DungeonFlagstone.js'", "'./DungeonFlagstoneReference.js'");
            const flagstone = execFileSync('git', ['show', `${referenceCommit}:src/art/DungeonFlagstone.js`], { encoding: 'utf8' });
            await page.route('**/src/art/VerdantMasonryReference.js', route => route.fulfill({ body: masonry, contentType: 'text/javascript' }));
            await page.route('**/src/art/DungeonFlagstoneReference.js', route => route.fulfill({ body: flagstone, contentType: 'text/javascript' }));
        }
        await page.route('**/src/art/DungeonInteriorsWardReference.js', route => route.fulfill({ body: previous, contentType: 'text/javascript' }));
    }
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async ({ quality, phone }) => {
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { UIManager } = await import('/src/ui/UIManager.js');
        const { InputManager } = await import('/src/core/InputManager.js');
        const { Fighter } = await import('/src/entities/Fighter.js');
        const { MeshFactory } = await import('/src/utils/MeshFactory.js');
        document.getElementById('start-screen').style.display = 'none';
        document.body.classList.toggle('mobile-mode', phone);
        const render = new RenderSystem(phone), ui = new UIManager(phone), hero = new Fighter('entry-ward-art-review');
        render.setGraphicsQuality(quality); await render.preloadEnvironment();
        hero.setMesh(await MeshFactory.createMeshForType('Fighter', { quality }));
        const slots = ['head', 'chest', 'legs', 'feet', 'gloves', 'shoulders', 'belt', 'mainHand', 'offHand', 'neck', 'ring1', 'ring2', 'trinket1', 'trinket2'];
        const names = ['Iron Helm', 'Plate Mail', 'Plate Greaves', 'Iron Boots', 'Iron Gauntlets', 'Steel Pauldrons', 'Plated Girdle', 'Iron Sword', 'Wooden Shield', 'Necklace', 'Ruby Ring', 'Silver Ring', 'Amulet of Power', 'Orb of Mana'];
        hero.syncEquipmentVisuals(Object.fromEntries(names.map((name, i) => [slots[i], {
            id: slots[i], name, baseName: name, slot: slots[i], rarity: 'Rare', type: name === 'Iron Sword' ? 'WEAPON' : 'ARMOR' }])));
        await hero.mesh.userData.equipmentReady; render.entityGroup.add(hero.mesh);
        const input = new InputManager(render.camera, render.scene, render.renderer.domElement);
        if (phone) input.setupMobileControls();
        ui.showHUD(); ui.updatePlayerStats(hero); ui.updateHotbar(hero); render.onWindowResize();
        window.__entryWardReview = { render, ui, hero, input };
    }, { quality, phone: width < 600 });
    const reports = [];
    for (const [fixtureIndex, { dungeonType: type, layout }] of fixtures.entries()) {
        const setup = await page.evaluate(async ({ type, layout, quality, comparePredecessor, compareFloor }) => {
            const THREE = await import('three');
            const { WorldGenerator } = await import('/src/world/WorldGenerator.js');
            const { CollisionManager } = await import('/src/core/CollisionManager.js');
            const reference = comparePredecessor ? await import('/src/art/DungeonInteriorsWardReference.js') : null;
            const { applyDungeonRoomStatePresentation, animateDungeonRoomStatePresentation } = await import('/src/art/ProceduralDungeonInteriors.js');
            const state = window.__entryWardReview, { render, ui, hero } = state;
            if (state.previous) render.disposeObjectResources(state.previous);
            if (state.referenceFloorOwner) render.disposeObjectResources(state.referenceFloorOwner);
            render.clearGroupChildren(render.instanceEnvironmentGroup);
            const collision = new CollisionManager(), generator = new WorldGenerator(render.instanceEnvironmentGroup, collision, { graphicsQuality: quality });
            const methods = { verdant_bastion_catacombs: 'createVerdantBastionCatacombs', molten_core: 'createMoltenCore',
                tempest_spire: 'createTempestSpire', abyssal_well: 'createAbyssalWell', umbral_nexus: 'createUmbralNexus' };
            await generator[methods[type]](0, 0, layout);
            const room = layout.rooms[0];
            collision.setDungeonWalkableGeometry(layout.walkRects);
            const current = render.instanceEnvironmentGroup.children.find(part => part.userData.proceduralDungeonInterior && part.userData.roomIndex === 0);
            const referenceKit = reference?.createProceduralDungeonInteriorKit(type, { quality });
            const previous = referenceKit?.createRoomDressing(room, 0);
            const floors = render.instanceEnvironmentGroup.children.filter(part => part.name === 'DungeonUnionFloor').map(mesh => [mesh, mesh.material]);
            const referenceFloor = compareFloor && type === 'verdant_bastion_catacombs' ? referenceKit.floorMaterial(24, 24) : null;
            state.referenceFloorOwner = referenceFloor ? new THREE.Mesh(new THREE.BufferGeometry(), referenceFloor) : null;
            const currentState = current.getObjectByName(`DungeonRoomState:${type}:0`);
            const summary = { currentRoomIndex: 0, objectiveRoomIndex: 0 };
            applyDungeonRoomStatePresentation(currentState, { cleared: false }, summary);
            reference?.applyDungeonRoomStatePresentation(previous.getObjectByName(`DungeonRoomState:${type}:0`), { cleared: false }, summary);
            hero.position.set(room.x + 1.5, .1, room.z + 1); hero.mesh.position.copy(hero.position);
            render.setEnvironmentContext(type, hero.position, true); render.setCameraTarget(hero.position); render.updateEnvironmentLighting(hero.position, 0);
            ui.quest.renderObjectivesPanel([{ id: 'ward', title: 'Explore the dungeon', progressLabel: 'Entry', hint: 'Prepared art review' }]);
            const colliders = JSON.stringify([collision.colliders, collision.orientedColliders, collision.circularColliders, collision.dungeonWalkableRects]);
            state.select = mode => {
                for (const [mesh, material] of floors) mesh.material = mode === 'reference' && referenceFloor ? referenceFloor : material;
                current.removeFromParent(); previous?.removeFromParent();
                render.instanceEnvironmentGroup.add(mode === 'reference' ? previous : current);
                if (mode !== 'reference') {
                    applyDungeonRoomStatePresentation(currentState, { cleared: mode === 'ready' }, { currentRoomIndex: 0, objectiveRoomIndex: mode === 'ready' ? -1 : 0 });
                    animateDungeonRoomStatePresentation(currentState, 2.5);
                }
                render.render(); render.render();
                return { mode, calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles };
            };
            Object.assign(state, { current, currentState, previous, collision });
            state.setReviewView = view => {
                const radius = Math.max(8, Math.min(24, Math.max(40, Number(room.width) || 80) * .2));
                const side = view === 'root-left' ? -1 : 1;
                hero.position.set(room.x + (view === 'entry' ? 1.5 : side * radius * .78), .1,
                    room.z + (view === 'entry' ? 1 : radius * .58 + 2));
                hero.mesh.position.copy(hero.position); render.setCameraTarget(hero.position);
                render.updateEnvironmentLighting(hero.position, 0); render.render(); render.render();
                return { view, calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles };
            };
            const rootBatches = current.children.filter(part => part.isMesh && part.material.vertexColors);
            // The entry remains a normal traversable room. Presentation swaps
            // cannot register geometry as a new walk blocker or interaction.
            let blocked = 0;
            for (let i = 0; i <= 80; i++) {
                const p = new THREE.Vector3(room.x, .1, room.z - 14 + i * .3);
                const corrected = collision.checkCollision(p, 1.25, p);
                if (corrected?.distanceTo(p) > .01) blocked++;
            }
            const gl = render.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
            return { blocked, colliders, floorReference: Boolean(referenceFloor), floorPatina: floors[0][1].userData.verdantFloorPatina === true, rootBatches: rootBatches.length,
                rootTriangles: rootBatches.reduce((sum, part) => sum + (part.geometry.index?.count || part.geometry.attributes.position.count) / 3, 0),
                equippedItems: hero.mesh.userData.equipmentVisualItemCount,
                missing: hero.mesh.userData.equipmentVisualMissing?.length || 0, fallback: hero.mesh.userData.equipmentVisualFallback?.length || 0,
                gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
        }, { type, layout, quality, comparePredecessor, compareFloor });
        const views = [];
        for (const mode of comparePredecessor ? ['reference', 'candidate', 'ready'] : ['candidate', 'ready']) {
            views.push(await page.evaluate(mode => window.__entryWardReview.select(mode), mode));
            await page.screenshot({ path: testInfo.outputPath(`${type}-${fixtureIndex}-${mode}.png`), style: '#perf-overlay { visibility: hidden !important; }' });
            if (type === 'verdant_bastion_catacombs') {
                for (const view of ['root-left', 'root-right']) {
                    views.push(await page.evaluate(view => window.__entryWardReview.setReviewView(view), view));
                    await page.screenshot({ path: testInfo.outputPath(`${type}-${fixtureIndex}-${mode}-${view}.png`), style: '#perf-overlay { visibility: hidden !important; }' });
                }
                await page.evaluate(() => window.__entryWardReview.setReviewView('entry'));
            }
        }
        const motion = await page.evaluate(async () => {
            const { animateDungeonRoomStatePresentation } = await import('/src/art/ProceduralDungeonInteriors.js');
            const { render, currentState, collision } = window.__entryWardReview;
            const veil = currentState.getObjectByName('DungeonExitPortal');
            const matrix = veil.matrixWorld.toArray(), target = render.cameraTarget.clone(); let stable = true;
            const sweep = currentState.userData.dungeonType === 'verdant_bastion_catacombs';
            for (let i = 0; i < 36; i++) {
                await new Promise(requestAnimationFrame);
                if (sweep) render.setCameraTarget(target.clone().add({ x: Math.sin(i / 35 * Math.PI * 2) * 4, y: 0, z: 0 }));
                animateDungeonRoomStatePresentation(currentState, 2.5 + i / 60); render.render();
                stable &&= veil.matrixWorld.elements.every((value, index) => value === matrix[index]);
            }
            render.setCameraTarget(target); render.render();
            return { frames: 36, cameraSweep: sweep, stable, colliders: JSON.stringify([collision.colliders, collision.orientedColliders, collision.circularColliders, collision.dungeonWalkableRects]),
                scope: 'Prepared actual production layout/materials/lighting/camera and14slot supplied Fighter with HUD. Regional ready/inactive views, Verdant root views and camera sweep, animated source renders; no server, normal-input walking, earned-clear, gameplay timing or physical-device certificate.' };
        });
        reports.push({ type, fixtureIndex, quality, referenceCommit: comparePredecessor ? referenceCommit : null, ...setup, views, motion });
        await writeFile(testInfo.outputPath('entry-ward-review.json'), JSON.stringify(reports, null, 2));
        expect(setup.gpu).not.toMatch(/swiftshader|llvmpipe|software/i);
        expect(setup.blocked).toBe(0); expect(setup.equippedItems).toBe(14); expect(setup.missing + setup.fallback).toBe(0);
        expect(setup.rootBatches).toBe(type === 'verdant_bastion_catacombs' ? 1 : 0);
        expect(setup.floorPatina).toBe(type === 'verdant_bastion_catacombs');
        expect(setup.rootTriangles).toBe(type === 'verdant_bastion_catacombs' ? (quality === 'high' ? 2880 : 864) : 0);
        expect(motion.stable).toBe(true); expect(motion.colliders).toBe(setup.colliders);
        for (const view of views) {
            expect(view.calls).toBeGreaterThan(0); expect(view.calls).toBeLessThanOrEqual(quality === 'high' ? 350 : 200);
            expect(view.triangles).toBeLessThanOrEqual(quality === 'high' ? 250000 : 85000);
        }
    }
    await page.evaluate(() => {
        const { render, hero, ui, previous, referenceFloorOwner, input } = window.__entryWardReview;
        if (referenceFloorOwner) render.disposeObjectResources(referenceFloorOwner);
        if (previous) render.disposeObjectResources(previous); hero.dispose(); input.dispose(); ui.destroy?.(); render.dispose(); delete window.__entryWardReview;
    });
    expect(failures, failures.join('\n')).toEqual([]);
});
