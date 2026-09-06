import { expect } from '@playwright/test';
import { moveByGroundClick, projectEntity, readPlayerState, zoomOutForPortal } from './helpers.js';

export async function openDungeonGuide(page) {
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
    // Keep reprojecting while the camera follows the approach.
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
                focusedElement: document.activeElement?.tagName
            };
        });
        console.log(`[dungeon-guide] menu did not open: ${JSON.stringify(diagnostic)}`);
        throw error;
    }
}
