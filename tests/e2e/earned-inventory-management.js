import { expect } from '@playwright/test';
import { EARNED_BAG_MIN_FREE, EARNED_BAG_TARGET_FREE, earnedBagFreeSlots, planEarnedBagSales } from '../earnedInventoryPolicy.js';
import { equipEarnedEmptySlots } from './earned-equipment.js';
import { moveByGroundClick, projectEntity, readPlayerState, returnToTown, setAutoLootThroughSettings } from './helpers.js';

const snapshot = page => page.evaluate(() => {
    const p = window.game.player;
    return { level: p.level, gold: p.gold, inventory: p.inventory, equipment: p.equipment,
        quests: p.quests.filter(q => q.accepted).map(q => ({ id: q.id, count: q.count, completed: q.completed })) };
});

async function openEarnedMerchant(page) {
    for (let step = 0; step < 8; step++) {
        const offset = await page.evaluate(() => {
            const game = window.game, merchant = game.remotePlayers.get('merchant-1');
            if (!merchant) return null;
            return { x: merchant.position.x - game.player.position.x, z: merchant.position.z - game.player.position.z };
        });
        expect(offset, 'The actual town merchant must be replicated').not.toBeNull();
        const distance = Math.hypot(offset.x, offset.z);
        if (distance < 4.5) break;
        const scale = Math.min(12, distance - 3) / distance;
        await moveByGroundClick(page, offset.x * scale, offset.z * scale, { allowJumpFallback: false });
    }
    await expect.poll(() => page.evaluate(() => {
        const game = window.game;
        return game.player.state === 'IDLE' && !game.player.targetPosition &&
            Math.hypot(game.renderSystem.cameraTarget.x - game.player.position.x,
                game.renderSystem.cameraTarget.z - game.player.position.z) < .05;
    })).toBe(true);
    let point;
    await expect.poll(async () => {
        point = await projectEntity(page, 'merchant-1');
        if (!point?.visible) return false;
        await page.mouse.move(point.x, point.y);
        return page.evaluate(() => window.game.hoveredEntity?.id === 'merchant-1');
    }).toBe(true);
    await page.mouse.click(point.x, point.y);
    await expect(page.locator('#shop-screen')).toBeVisible();
    await expect(page.locator('#inventory-screen')).toBeVisible();
}

// Call only between encounters, before starting the existing combat watchdog.
// All item changes are ordinary inventory/merchant clicks on this QA account.
export async function maintainEarnedInventory(page, { leaveTown }) {
    if (earnedBagFreeSlots((await snapshot(page)).inventory) >= EARNED_BAG_MIN_FREE) return false;
    expect(typeof leaveTown, 'Bag management must resume through ordinary travel').toBe('function');
    const started = Date.now();
    const autoLoot = await page.evaluate(() => window.game.autoLootEnabled);
    await setAutoLootThroughSettings(page, false);
    await expect.poll(() => page.evaluate(() => window.game.pendingLootPickups.size)).toBe(0);
    await returnToTown(page);
    expect((await readPlayerState(page)).state).not.toBe('DEAD');
    const before = await snapshot(page);
    const equipped = await equipEarnedEmptySlots(page);
    const prepared = await snapshot(page);
    const sales = planEarnedBagSales(prepared);
    const required = Math.max(0, EARNED_BAG_TARGET_FREE - earnedBagFreeSlots(prepared.inventory));
    expect(sales.length, 'Conservative bag policy needs enough spare low-rarity gear; never sell protected items to force progress').toBe(required);
    if (sales.length) {
        await openEarnedMerchant(page);
        for (const sale of sales) {
            // Selling compacts the server bag; resolve the item ID each time.
            const current = await snapshot(page);
            const index = current.inventory.findIndex(item => item?.id === sale.id);
            expect(index).toBeGreaterThanOrEqual(0);
            await page.locator('#inventory-grid .inv-slot').nth(index).click({ button: 'right' });
            await expect.poll(async () => (await snapshot(page)).inventory.some(item => item?.id === sale.id)).toBe(false);
            await expect.poll(async () => (await snapshot(page)).gold).toBe(current.gold + sale.value);
        }
        await page.locator('#btn-close-shop-header').click();
    }
    if (await page.locator('#inventory-screen').isVisible()) await page.locator('#btn-close-inventory').click();
    if (await page.locator('#character-sheet').isVisible()) await page.locator('#btn-close-character').click();
    const after = await snapshot(page);
    expect(after.level).toBe(before.level);
    expect(after.quests).toEqual(before.quests);
    expect(after.equipment).toEqual(prepared.equipment);
    expect(after.gold).toBe(before.gold + sales.reduce((sum, sale) => sum + sale.value, 0));
    expect(after.inventory.filter(item => item?.id)).toEqual(prepared.inventory.filter(item => item?.id && !sales.some(sale => sale.id === item.id)));
    expect(earnedBagFreeSlots(after.inventory)).toBeGreaterThanOrEqual(EARNED_BAG_TARGET_FREE);
    await setAutoLootThroughSettings(page, autoLoot);
    await leaveTown();
    console.log('[earned-bag-management]', JSON.stringify({ equipped, sales,
        before: { level: before.level, gold: before.gold, freeSlots: earnedBagFreeSlots(before.inventory) },
        after: { level: after.level, gold: after.gold, freeSlots: earnedBagFreeSlots(after.inventory) },
        seconds: (Date.now() - started) / 1000, note: 'Verified merchant proceeds, not vendor estimates or granted gold.' }));
    return true;
}
