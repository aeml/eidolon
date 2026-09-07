import { expect, test } from '@playwright/test';
import { acquireLootPointer } from './helpers.js';

test('a covered loot center keeps enemy priority while exposed loot edges remain selectable', async ({ page }) => {
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
        Object.assign(game, { player: { id: 'owner' }, activeEntitiesCache: [loot, hostile],
            remotePlayers: new Map([['loot', loot]]), renderSystem: { camera, environmentGroup: new THREE.Group() },
            inputManager: new InputManager(camera, new THREE.Scene(), canvas),
            isHostileActorTarget: entity => entity === hostile, isInteractableEntity: () => false,
            refreshDungeonEntranceHint: () => {}, refreshCombatIntentState: () => {} });
        game.inputManager.subscribe('onMouseMove', () => game.performRaycast());
        window.game = game;
    });
    await page.mouse.move(640, 360);
    await expect.poll(() => page.evaluate(() => window.game.hoveredEntity?.id)).toBe('hostile');
    const point = await acquireLootPointer(page, 'loot', 2000);
    expect(point.visible).toBe(true);
    expect(await page.evaluate(() => window.game.hoveredEntity?.id)).toBe('loot');
});
