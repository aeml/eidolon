import { expect, test } from '@playwright/test';
import { existsSync } from 'node:fs';
import { acquireLootPointer, projectEntity, settlePointerRaycast } from './helpers.js';
import { aimDungeonCombatTarget } from '../dungeonTargetInput.js';

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
