import { expect } from '@playwright/test';
import { moveByGroundClick, projectEntity, readPlayerState, zoomOutForPortal } from './helpers.js';

export async function openDungeonGuide(page) {
    await page.evaluate(() => {
        const game = window.game;
        window.__guideClickProbe = { click: null, requested: 0, received: 0, updates: 0 };
        if (window.__guideProbeInstalled) return;
        window.__guideProbeInstalled = true;
        const describe = entity => entity ? { type: entity.constructor.name,
            position: entity.position?.clone(), active: entity.isActive, state: entity.state } : null;
        const click = game.handlePrimaryClick;
        game.handlePrimaryClick = function (event) {
            const probe = window.__guideClickProbe;
            const before = describe(game.hoveredEntity);
            const result = click.call(game, event);
            probe.click = { before, after: describe(game.hoveredEntity), pending: describe(game.pendingInteraction),
                target: game.player.targetPosition?.clone(), player: game.player.position.clone(),
                dom: event?.target?.tagName, zoom: game.renderSystem.currentZoom };
            return result;
        };
        const request = game.requestDungeonStatus;
        game.requestDungeonStatus = function (...args) {
            window.__guideClickProbe.requested++;
            return request.apply(game, args);
        };
        const message = game.handleServerMessage;
        game.handleServerMessage = function (value) {
            if (value.type === 'get_dungeon_status') window.__guideClickProbe.received++;
            if (value.type === 'state' || value.type === 'delta') window.__guideClickProbe.updates++;
            return message.call(game, value);
        };
    });
    await zoomOutForPortal(page);
    let guide;
    for (let step = 0; step < 4; step++) {
        guide = await projectEntity(page, 'dungeon-npc-1');
        if (guide?.visible) break;
        const player = await readPlayerState(page);
        const dx = -player.x;
        const dz = 240 - player.z;
        const scale = Math.min(1, 16 / Math.hypot(dx, dz));
        await moveByGroundClick(page, dx * scale, dz * scale, { allowJumpFallback: false });
    }
    await expect.poll(async () => {
        guide = await projectEntity(page, 'dungeon-npc-1');
        return Boolean(guide?.visible);
    }, { timeout: 20_000 }).toBe(true);
    // Ground-click navigation proves movement, not arrival. A projection made
    // during that approach can hover the guide then miss on the next click's
    // fresh raycast as the rendered actor/camera advances underneath the cursor.
    await expect.poll(() => page.evaluate(() => {
        const game = window.game;
        const player = game.player;
        const camera = game.renderSystem;
        return player.state === 'IDLE' && !player.targetPosition && !camera.cameraPunch &&
            Math.hypot(player.mesh.position.x - player.position.x, player.mesh.position.z - player.position.z) < 0.05 &&
            Math.hypot(camera.cameraTarget.x - player.position.x, camera.cameraTarget.z - player.position.z) < 0.05;
    }), { timeout: 20_000, message: 'finish the ground approach and rendered camera follow before clicking the guide' }).toBe(true);
    // Reproject the guide's animated model before checking the actual hover.
    await expect.poll(async () => {
        guide = await projectEntity(page, 'dungeon-npc-1');
        if (!guide?.visible) return null;
        await page.mouse.move(guide.x, guide.y);
        return page.evaluate(() => window.game?.hoveredEntity?.id);
    }, { timeout: 10_000 }).toBe('dungeon-npc-1');
    await page.mouse.click(guide.x, guide.y);
    try {
        await expect(page.locator('#dungeon-menu')).toBeVisible({ timeout: 30_000 });
    } catch (error) {
        const diagnostic = await page.evaluate(() => {
            const game = window.game;
            const pending = game?.pendingInteraction;
            return {
                instance: game?.currentInstanceType,
                player: game?.player?.position,
                state: game?.player?.state,
                target: game?.player?.targetPosition,
                pending: pending ? { type: pending.constructor.name, active: pending.isActive,
                    position: pending.position, range: game.getInteractionRangeForEntity(pending) } : null,
                socket: game?.network?.socket?.readyState,
                focusedElement: document.activeElement?.tagName,
                probe: window.__guideClickProbe
            };
        });
        console.log(`[dungeon-guide] menu did not open: ${JSON.stringify(diagnostic)}`);
        throw error;
    }
}
