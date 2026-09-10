import { expect } from '@playwright/test';
import { earnedStashFreeSlots } from '../earnedInventoryPolicy.js';
import { moveByGroundClick, projectEntity, readPlayerState } from './helpers.js';

export async function openEarnedStash(page) {
    // A right-click must mean deposit, never a sale through a leftover shop.
    await expect(page.locator('#shop-screen')).toBeHidden();
    if (!await page.locator('#stash-screen').isVisible()) {
        // Player readiness can precede nearby NPC replication after login.
        // Wait for the real actor; never synthesize it or renew a travel budget.
        await expect.poll(() => page.evaluate(() => window.game.remotePlayers.has('stash-1')),
            { timeout: 10_000, message: 'Town stash must arrive in the ordinary world stream' }).toBe(true);
        for (let step = 0; step < 16; step++) {
            const offset = await page.evaluate(() => {
                const game = window.game, stash = game.remotePlayers.get('stash-1');
                return stash ? { x: stash.position.x - game.player.position.x,
                    z: stash.position.z - game.player.position.z } : null;
            });
            expect(offset, 'The real town stash must be replicated').not.toBeNull();
            const distance = Math.hypot(offset.x, offset.z);
            if (distance < 4.5) break;
            const scale = Math.min(12, distance - 3) / distance;
            await moveByGroundClick(page, offset.x * scale, offset.z * scale,
                { moveOnly: true, allowJumpFallback: false });
        }
        await expect.poll(() => page.evaluate(() => {
            const game = window.game;
            return game.player.state === 'IDLE' && !game.player.targetPosition &&
                Math.hypot(game.renderSystem.cameraTarget.x - game.player.position.x,
                    game.renderSystem.cameraTarget.z - game.player.position.z) < .05;
        })).toBe(true);
        let point;
        await expect.poll(async () => {
            point = await projectEntity(page, 'stash-1');
            if (!point?.visible) return false;
            await page.mouse.move(point.x, point.y);
            return page.evaluate(() => window.game.hoveredEntity?.id === 'stash-1');
        }).toBe(true);
        await page.mouse.click(point.x, point.y);
    }
    await expect(page.locator('#stash-screen')).toBeVisible();
    await expect(page.locator('#inventory-screen')).toBeVisible();
    await expect(page.locator('#shop-screen')).toBeHidden();
    console.log('[earned-stash-window]', JSON.stringify({ position: await readPlayerState(page) }));
}

export async function storeEarnedSpareEquipment(page, planned, readState) {
    if (!planned.length) return [];
    await openEarnedStash(page);
    const initial = await readState(page);
    const capacity = await page.locator('#stash-grid .inv-slot').count();
    const freeSlots = earnedStashFreeSlots(initial.stash, capacity);
    expect(freeSlots, 'Real stash capacity must cover the complete deposits').toBeGreaterThanOrEqual(planned.length);
    console.log('[earned-stash-capacity]', JSON.stringify({ capacity, freeSlots, planned: planned.length }));
    const stored = [];
    for (const deposit of planned) {
        const before = await readState(page);
        const index = before.inventory.findIndex(item => item?.id === deposit.id);
        expect(index).toBeGreaterThanOrEqual(0);
        const item = before.inventory[index];
        await expect(page.locator('#shop-screen')).toBeHidden();
        await page.locator('#inventory-grid .inv-slot').nth(index).click({ button: 'right' });
        await expect.poll(async () => (await readState(page)).inventory.some(entry => entry?.id === item.id)).toBe(false);
        await expect.poll(async () => (await readState(page)).stash.find(entry => entry?.id === item.id)).toEqual(item);
        const after = await readState(page);
        expect(after.gold).toBe(before.gold);
        expect(after.equipment).toEqual(before.equipment);
        expect(after.quests).toEqual(before.quests);
        expect(after.inventory.filter(entry => entry?.id)).toEqual(before.inventory.filter(entry => entry?.id && entry.id !== item.id));
        expect(after.stash.filter(entry => entry?.id)).toEqual([...before.stash.filter(entry => entry?.id), item]);
        stored.push(item);
    }
    await page.locator('#btn-close-stash').click();
    return stored;
}
