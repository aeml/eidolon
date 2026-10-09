import { expect, test } from '@playwright/test';
import { existsSync } from 'node:fs';
import { acquireLootPointer, acquireCombatLootPointer, clickLootPointer, projectEntity, settlePointerRaycast } from './helpers.js';
import { aimDungeonCombatTarget } from '../dungeonTargetInput.js';
import { armManualLootClickObservation } from './loot-pointer-observation.js';

// Input/geometry only: no rendered game or GPU contention with live QA.
test.use({ launchOptions: {
    executablePath: process.env.EIDOLON_E2E_BROWSER_PATH || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined),
    args: ['--disable-gpu', '--disable-webgl', '--disable-software-rasterizer']
} });

test.beforeEach(async ({ page }) => {
    await page.route('**/src/main.js', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
        const THREE = await import('three');
        const { InputManager } = await import('/src/core/InputManager.js');
        const { GameEngine } = await import('/src/core/GameEngine.js');
        const { LootDrop } = await import('/src/entities/LootDrop.js');
        const canvas = document.createElement('canvas');
        canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:99999;background:#14202b';
        document.body.appendChild(canvas);
        const camera = new THREE.OrthographicCamera(-8, 8, 5, -5, .1, 100);
        camera.position.set(0, 20, .001); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
        const loot = new LootDrop({ id: 'sword-item', name: 'Sword', slot: 'mainHand', rarity: 'Common' }, 0, 0, 'loot');
        const hostile = { id: 'hostile', isActive: true, state: 'ATTACKING',
            mesh: new THREE.Mesh(new THREE.BoxGeometry(1, 3, 1), new THREE.MeshBasicMaterial()) };
        hostile.mesh.position.y = 2; hostile.mesh.userData.entityId = hostile.id;
        hostile.mesh.updateMatrixWorld(true); loot.mesh.updateMatrixWorld(true);
        // Geometry/input component fixture: a narrow hostile interaction proxy
        // occludes the real LootDrop hitbox's center, not its exposed sides.
        const game = Object.create(GameEngine.prototype);
        Object.assign(game, { player: { id: 'owner' }, needsRaycast: false, activeEntitiesCache: [loot, hostile],
            remotePlayers: new Map([['loot', loot]]), renderSystem: { camera, environmentGroup: new THREE.Group() },
            inputManager: new InputManager(camera, new THREE.Scene(), canvas),
            isHostileActorTarget: entity => entity === hostile, isInteractableEntity: () => false,
            refreshDungeonEntranceHint: () => {}, refreshCombatIntentState: () => {} });
        game.inputManager.subscribe('onMouseMove', () => game.performRaycast());
        window.game = game;
    });
});

test('ordinary pointer input acquires a golem corner hidden from the six axial samples', async ({ page }) => {
    await page.evaluate(async () => {
        const { MagmaGolem } = await import('/src/entities/MagmaGolem.js');
        const { createProceduralMagmaGolem } = await import('/src/art/ProceduralOverworldEnemies.js');
        const g = window.game;
        const positions = [[99999.7265625, 19594.291015625], [99997.203125, 19592.751953125]];
        const actors = positions.map(([x, z], i) => {
            const actor = new MagmaGolem(i ? 'target' : 'foreground');
            actor.setMesh(createProceduralMagmaGolem());
            actor.position.set(x, 0, z);
            actor.mesh.position.copy(actor.position);
            actor.mesh.updateMatrixWorld(true);
            return actor;
        });
        g.activeEntitiesCache = actors;
        g.remotePlayers = new Map(actors.map(actor => [actor.id, actor]));
        g.isHostileActorTarget = entity => actors.includes(entity);
        const camera = g.renderSystem.camera;
        Object.assign(camera, { left: -30, right: 30, top: 20, bottom: -20, far: 2000 });
        camera.position.set(100093.999, 100, 19691.154);
        camera.lookAt(99993.999, 0, 19591.154);
        camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
        if (document.createElement('canvas').getContext('webgl')) throw new Error('Geometry fixture must not use WebGL');
    });
    const observed = [];
    const point = await aimDungeonCombatTarget({
        project: (id, sample) => projectEntity(page, id, sample),
        move: (x, y) => page.mouse.move(x, y),
        settle: () => settlePointerRaycast(page),
        hoveredId: async () => {
            const id = await page.evaluate(() => window.game.hoveredEntity?.id);
            observed.push(id);
            return id;
        }
    }, 'target', true);
    expect(observed.slice(0, 6)).toEqual(Array(6).fill('foreground'));
    expect(point?.visible).toBe(true);
    expect(observed.at(-1)).toBe('target');
    expect(observed.length).toBeLessThanOrEqual(10);
});

test('a covered loot center keeps enemy priority while exposed loot edges remain selectable', async ({ page }) => {
    await page.mouse.move(640, 360);
    await expect.poll(() => page.evaluate(() => window.game.hoveredEntity?.id)).toBe('hostile');
    const point = await acquireLootPointer(page, 'loot', 2000);
    expect(point.visible).toBe(true);
    expect(await page.evaluate(() => window.game.hoveredEntity?.id)).toBe('loot');
});

test('manual pickup re-aims after camera movement instead of clicking an old hover position', async ({ page }) => {
    await page.evaluate(() => {
        const game = window.game;
        game.activeEntitiesCache = [game.remotePlayers.get('loot')];
        window.__lootPointerClicks = [];
        game.inputManager.subscribe('onClick', () => {
            game.performRaycast();
            window.__lootPointerClicks.push(game.hoveredEntity?.id ?? null);
        });
    });
    const oldPoint = await acquireLootPointer(page, 'loot', 2000);
    await page.evaluate(() => {
        // Geometry-only fixture: simulate camera follow changing during the
        // inventory reads between hover acquisition and a real mouse click.
        const camera = window.game.renderSystem.camera;
        camera.position.x += 6;
        camera.lookAt(6, 0, 0);
        camera.updateMatrixWorld(true);
    });
    await page.mouse.click(oldPoint.x, oldPoint.y);
    expect(await page.evaluate(() => window.__lootPointerClicks)).toEqual([null]);
    await clickLootPointer(page, 'loot', 2000);
    expect(await page.evaluate(() => window.__lootPointerClicks)).toEqual([null, 'loot']);
    expect(await page.evaluate(() => window.game.remotePlayers.get('loot').isActive)).toBe(true);
});

test('manual pickup projects again when camera follow changes after hover confirmation', async ({ page }) => {
    await page.evaluate(() => {
        const game = window.game;
        game.activeEntitiesCache = [game.remotePlayers.get('loot')];
        window.__lootPointerClicks = [];
        game.inputManager.subscribe('onClick', () => {
            game.performRaycast();
            window.__lootPointerClicks.push(game.hoveredEntity?.id ?? null);
        });
    });
    // Geometry fixture only: model one camera-follow reconciliation immediately
    // after observing the successful hover, before native mousedown dispatch.
    // Keep the entity, pointer priority and actual click raycast untouched.
    const evaluate = page.evaluate.bind(page);
    let followed = false;
    page.evaluate = async (fn, argument) => {
        const result = await evaluate(fn, argument);
        if (!followed && argument?.id === 'loot' && Object.hasOwn(argument, 'allowOverlappingLoot') && result === 'loot') {
            followed = true;
            await evaluate(() => {
                const camera = window.game.renderSystem.camera;
                camera.position.x += 6; camera.lookAt(6, 0, 0); camera.updateMatrixWorld(true);
            });
        }
        return result;
    };
    try {
        await clickLootPointer(page, 'loot', 2000);
    } finally { page.evaluate = evaluate; }
    expect(followed).toBe(true);
    expect(await page.evaluate(() => window.__lootPointerClicks)).toEqual(['loot']);
    expect(await page.evaluate(() => window.game.remotePlayers.get('loot').isActive)).toBe(true);
});

test('combat loot recovery clicks a fully covering hostile before reacquiring the earned drop', async ({page}) => {
    // Component fixture only: model an authoritative death response to one real
    // hostile click. The disposable gameplay smoke separately proves combat and
    // item persistence; this deterministically covers the rare overlap branch.
    await page.evaluate(() => {
        const game = window.game, hostile = game.activeEntitiesCache.find(entity => entity.id === 'hostile');
        hostile.health = 30; hostile.mesh.scale.set(8, 1, 8); hostile.mesh.updateMatrixWorld(true);
        window.__blockerClicks = 0;
        game.inputManager.subscribe('onClick', () => {
            game.performRaycast();
            if (game.hoveredEntity !== hostile) throw new Error('Recovery did not click the blocking hostile');
            window.__blockerClicks++;
            hostile.health = 0; hostile.state = 'DEAD'; hostile.isActive = false; hostile.mesh.visible = false;
        });
    });
    const point = await acquireCombatLootPointer(page, 'loot', 500);
    expect(point.lootId).toBe('loot');
    expect(await page.evaluate(() => window.__blockerClicks)).toBe(1);
    expect(await page.evaluate(() => window.game.remotePlayers.get('loot').isActive)).toBe(true);
});

test('a coincident loot pile exposes its real front item without changing target priority', async ({ page }) => {
    await page.evaluate(async () => {
        const { LootDrop } = await import('/src/entities/LootDrop.js');
        const game = window.game;
        const back = game.remotePlayers.get('loot');
        const front = new LootDrop({ id: 'front-item', name: 'Front sword', slot: 'mainHand', rarity: 'Common' }, 0, 0, 'front');
        front.mesh.updateMatrixWorld(true);
        game.activeEntitiesCache = [front, back];
        game.remotePlayers.set('front', front);
    });
    const point = await acquireLootPointer(page, 'loot', 2000, { allowOverlappingLoot: true });
    expect(point.visible).toBe(true);
    expect(point.lootId).toBe('front');
    expect(await page.evaluate(() => ({ hovered: window.game.hoveredEntity.id,
        intendedStillPresent: window.game.remotePlayers.get('loot').isActive,
        stack: window.game.raycastHitEntities.map(entity => entity.id) })))
        .toEqual({ hovered: 'front', intendedStillPresent: true, stack: ['front', 'loot'] });
});

test('a fresh native click records the front pile item even when the previous hover order changes', async ({ page }) => {
    await page.evaluate(async () => {
        const { LootDrop } = await import('/src/entities/LootDrop.js');
        const game = window.game, back = game.remotePlayers.get('loot');
        const front = new LootDrop({ id: 'front-item', name: 'Front sword', slot: 'mainHand', rarity: 'Common' }, 0, 0, 'front');
        front.mesh.updateMatrixWorld(true);
        game.remotePlayers.set(front.id, front);
        game.activeEntitiesCache = [back, front];
        // Component fixture models the next input's refreshed hit stack. No
        // pickup or actor deletion is performed; gameplay QA proves recovery.
        game.inputManager.subscribe('onClick', () => {
            game.activeEntitiesCache = [front, back];
            game.performRaycast(); game.pendingInteraction = game.hoveredEntity;
        });
    });
    await armManualLootClickObservation(page, 'loot');
    await clickLootPointer(page, 'loot', 2000);
    expect(await page.evaluate(() => window.__qaManualLootClick)).toMatchObject({
        aimedId: 'loot', selectedId: 'front', selectedItem: { id: 'front-item' },
        sameLootPile: true, selectedPending: true
    });
    expect(await page.evaluate(() => window.game.remotePlayers.get('loot').isActive)).toBe(true);
});
