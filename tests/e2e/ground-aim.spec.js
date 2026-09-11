import { expect, test } from '@playwright/test';
import { aimAtGroundPoint } from './ground-aim.js';

// Browser-input/engine-intent fixture, not collision, combat or server proof.
// Real keyboard/mouse events feed production InputManager and GameEngine.update;
// the fixed hovered actor and player destination recorder isolate ownership.
async function prepareHeldMovement(page, distance) {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async distance => {
        const THREE = await import('three');
        const { InputManager } = await import('/src/core/InputManager.js');
        const { GameEngine } = await import('/src/core/GameEngine.js');
        const { Actor } = await import('/src/entities/Actor.js');
        const noop = () => {};
        const canvas = document.createElement('canvas');
        canvas.dataset.testid = 'move-only-canvas';
        canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:99999;background:#14202b';
        document.body.append(canvas);
        const chat = document.createElement('input');
        chat.id = 'move-only-chat';
        chat.style.cssText = 'position:fixed;left:10px;top:10px;z-index:100000';
        document.body.append(chat);
        const camera = new THREE.OrthographicCamera(-30, 30, 20, -20, .1, 200);
        camera.position.set(0, 50, .001); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
        const game = Object.create(GameEngine.prototype);
        const calls = { moves: 0, attacks: 0, interactions: 0 };
        Object.assign(game, {
            frameCount: 0, gameTime: 0, raycastTimer: 0, needsRaycast: false,
            isMobile: false, isMultiplayer: true, pendingInteraction: null,
            activeEntitiesCache: [], entityCreationQueue: [], pendingEntityIds: new Set(),
            remotePlayers: new Map(), recentlyPickedUpLoot: new Set(), playerJumpState: null,
            playerJumpVisualHeight: 0, effects: [], hazards: new Map(), lastPickupTime: 0,
            network: { messageQueue: [], latestServerTime: null, drainMessages: () => [], send: noop },
            performRaycast: noop, updatePlayerJump: noop, updateLootVisualFeedback: noop,
            processAutoLoot: noop, refreshCombatIntentState: noop, refreshDungeonEntranceHint: noop,
            clearCombatIntentState: noop, applyPlayerJumpVisuals: noop, isPlayerDead: () => false,
            chunkManager: { getActiveEntities: () => [game.player], update: noop, updateEntityChunk: noop },
            renderSystem: { camera, scene: new THREE.Scene(), render: noop, setCameraTarget: noop,
                updateEnvironmentLighting: noop, cameraTarget: new THREE.Vector3() },
            uiManager: { isEscMenuOpen: false, isPatchNotesOpen: false, isShopOpen: false,
                reportScreen: { style: { display: 'none' } }, showDeathScreen: noop, hideDeathScreen: noop,
                updatePlayerStats: noop, updateXP: noop, updateHotbarCooldowns: noop,
                updateEnemyBars: noop, updateInventory: noop },
            minimap: { update: noop }, worldMap: { update: noop }, floatingTextManager: { update: noop },
            abilityController: { processInputBuffer: noop, performAbility: noop,
                pendingAbilityTarget: null, pendingAbilitySkill: null, updatePendingTarget: noop,
                performAttack: () => calls.attacks++ },
            collisionManager: { checkCollision: () => null, constrainToDungeonWalkableArea: () => false },
            getBasicAttackRangeForEntity: () => 20, showReadabilityFeedback: noop,
            moveToAndInteract: () => calls.interactions++
        });
        game.player = { id: 'component-player', position: new THREE.Vector3(), rotation: new THREE.Quaternion(),
            state: 'IDLE', targetPosition: null, radius: 1.25, lastAttackTime: 0,
            stats: { attackSpeed: 1, hp: 100, maxHp: 100, mana: 100, maxMana: 100, speed: 5, damage: 10 },
            mesh: { lookAt: noop, quaternion: new THREE.Quaternion(), position: new THREE.Vector3() },
            playAnimation: noop, getAttackHitDelay: () => 0, render: noop,
            move: target => { calls.moves++; game.player.targetPosition = target.clone(); game.player.state = 'MOVING'; } };
        game.hoveredEntity = Object.assign(Object.create(Actor.prototype), {
            id: 'component-hostile', type: 'Skeleton', state: 'MOVING', isActive: true,
            position: new THREE.Vector3(distance, 0, 0)
        });
        game.inputManager = new InputManager(camera, game.renderSystem.scene, canvas);
        game.inputManager.subscribe('onClick', event => game.handlePrimaryClick(event));
        window.game = game;
        window.__moveOnlyCalls = calls;
    }, distance);
}

for (const { name, distance, fromChat } of [
    { name: 'near enemy', distance: 2, fromChat: false },
    { name: 'distant enemy', distance: 30, fromChat: false },
    { name: 'Shift begun in chat', distance: 2, fromChat: true }
]) {
    test(`native Shift click retains ground intent through held engine frames: ${name}`, async ({ page }) => {
        await prepareHeldMovement(page, distance);
        if (fromChat) await page.locator('#move-only-chat').focus();
        await page.keyboard.down('Shift');
        if (fromChat) expect(await page.evaluate(() => window.game.inputManager.keys.shift)).toBe(false);
        const viewport = page.viewportSize();
        await page.mouse.move(viewport.width * .7, viewport.height * .6);
        await page.mouse.down();
        try {
            const state = await page.evaluate(async () => {
                const game = window.game;
                const expected = game.inputManager.getGroundIntersection().clone();
                for (let i = 0; i < 5; i++) {
                    await new Promise(requestAnimationFrame);
                    game.update(1 / 60);
                }
                return { calls: window.__moveOnlyCalls, held: game.inputManager.keys.shift,
                    mouseDown: game.inputManager.isMouseDown,
                    target: game.player.targetPosition?.toArray(), expected: expected.toArray() };
            });
            expect(state.held).toBe(true);
            expect(state.mouseDown).toBe(true);
            expect(state.target).toEqual(state.expected);
            expect(state.calls.moves).toBeGreaterThanOrEqual(6);
            expect(state.calls.attacks).toBe(0);
            expect(state.calls.interactions).toBe(0);
        } finally {
            await page.mouse.up();
            await page.keyboard.up('Shift');
        }
        expect(await page.evaluate(() => window.game.inputManager.keys.shift)).toBe(false);
        await page.mouse.click(viewport.width * .7, viewport.height * .6);
        expect(await page.evaluate(() => window.__moveOnlyCalls.interactions)).toBe(1);
        await page.evaluate(() => window.game.inputManager.dispose());
    });
}

test('exact cast aiming tolerates browser pixel quantization without shortening the destination', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const destination = await page.evaluate(async () => {
        const THREE = await import('three');
        const { InputManager } = await import('/src/core/InputManager.js');
        const canvas = document.createElement('canvas');
        canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:99999;background:#14202b';
        document.body.appendChild(canvas);
        const aspect = innerWidth / innerHeight;
        const camera = new THREE.OrthographicCamera(-30 * aspect, 30 * aspect, 30, -30, .1, 2000);
        camera.position.set(20100, 100.5, 20100);
        camera.lookAt(20000, .5, 20000); camera.updateMatrixWorld(true);
        window.game = { player: { position: new THREE.Vector3(20000, .5, 20000) },
            renderSystem: { camera }, inputManager: new InputManager(camera, new THREE.Scene(), canvas) };
        // A fractional pixel near its upper boundary exposes MouseEvent's
        // integer coordinates. Select it by geometry, not a private game action.
        const ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2(641.99 / innerWidth * 2 - 1,
            1 - 361.99 / innerHeight * 2), camera);
        const target = ray.ray.intersectPlane(window.game.inputManager.groundPlane, new THREE.Vector3());
        return { x: target.x, z: target.z };
    });
    await aimAtGroundPoint(page, destination);
    const distance = await page.evaluate(({ x, z }) => {
        const actual = window.game.inputManager.getGroundIntersection();
        return Math.hypot(actual.x - x, actual.z - z);
    }, destination);
    expect(distance).toBeLessThan(.15);
});
