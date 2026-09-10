import { expect } from '@playwright/test';
import { EARNED_BAG_MIN_FREE, EARNED_BAG_TARGET_FREE, earnedBagFreeSlots, planEarnedBagSales,
    planEarnedBagStorage } from '../earnedInventoryPolicy.js';
import { equipEarnedEmptySlots } from './earned-equipment.js';
import { upgradeEarnedEquipment } from './earned-equipment-upgrades.js';
import { ensureEarnedMerchantWindow } from './earned-merchant-window.js';
import { approachEarnedMerchant } from '../earnedMerchantApproach.js';
import { storeEarnedSpareEquipment } from './earned-stash-storage.js';
import { moveByGroundClick, projectEntity, readPlayerState, returnToTown, setAutoLootThroughSettings } from './helpers.js';

const snapshot = page => page.evaluate(() => {
    const p = window.game.player;
    return { level: p.level, gold: p.gold, inventory: p.inventory, stash: p.stash || [], equipment: p.equipment,
        quests: p.quests.filter(q => q.accepted).map(q => ({ id: q.id, count: q.count, completed: q.completed })) };
});

export async function readEarnedMerchantApproach(page) {
    return page.evaluate(() => {
        const game = window.game, p = game.player;
        const merchant = game.remotePlayers.get('merchant-1');
        return { position: p.position.toArray(), state: p.state,
            target: p.targetPosition?.toArray() || null,
            camera: game.renderSystem.cameraTarget.toArray(),
            blockedStops: p.movementMetrics?.blockedStops || 0,
            merchant: merchant?.position.toArray() || null };
    });
}

export async function openEarnedMerchant(page) {
    const approach = [];
    try {
        await approachEarnedMerchant({
            read: () => readEarnedMerchantApproach(page),
            settle: deadline => expect.poll(() => page.evaluate(() => {
                const game = window.game;
                return game.player.state === 'IDLE' && !game.player.targetPosition &&
                    Math.hypot(game.renderSystem.cameraTarget.x - game.player.position.x,
                        game.renderSystem.cameraTarget.z - game.player.position.z) < .05;
            }), { timeout: Math.max(1, Math.min(15_000, deadline - Date.now())) }).toBe(true),
            move: async (x, z) => {
                const before = await readEarnedMerchantApproach(page);
                await moveByGroundClick(page, x, z, { moveOnly: true, allowJumpFallback: false });
                approach.push({ before, delta: [x, z], after: await readEarnedMerchantApproach(page) });
            }
        });
    } catch (cause) {
        const final = await readEarnedMerchantApproach(page).catch(() => null);
        throw new Error(`Merchant approach did not settle: ${JSON.stringify({ approach, final })}; ${cause.message}`, { cause });
    }
    const opened = await ensureEarnedMerchantWindow(page, async () => {
        let point;
        await expect.poll(async () => {
            point = await projectEntity(page, 'merchant-1');
            if (!point?.visible) return false;
            await page.mouse.move(point.x, point.y);
            return page.evaluate(() => window.game.hoveredEntity?.id === 'merchant-1');
        }).toBe(true);
        await page.mouse.click(point.x, point.y);
    });
    console.log('[earned-merchant-window]', JSON.stringify({ opened, position: await readPlayerState(page) }));
}

// Call only between encounters, before starting the existing combat watchdog.
// All item changes are ordinary inventory/merchant/stash clicks on this QA account.
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
    const upgrades = await upgradeEarnedEquipment(page);
    const prepared = await snapshot(page);
    const sales = planEarnedBagSales(prepared);
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
    const afterSales = await snapshot(page);
    const storage = planEarnedBagStorage(afterSales);
    const requiredStorage = Math.max(0, EARNED_BAG_TARGET_FREE - earnedBagFreeSlots(afterSales.inventory));
    expect(storage.length, 'Spare gear must cover the remaining space without moving quest items or discarding valuables').toBe(requiredStorage);
    const stored = await storeEarnedSpareEquipment(page, storage, snapshot);
    if (await page.locator('#inventory-screen').isVisible()) await page.locator('#btn-close-inventory').click();
    const after = await snapshot(page);
    expect(after.level).toBe(before.level);
    expect(after.quests).toEqual(before.quests);
    expect(after.equipment).toEqual(prepared.equipment);
    expect(after.gold).toBe(before.gold + sales.reduce((sum, sale) => sum + sale.value, 0));
    expect(after.inventory.filter(item => item?.id)).toEqual(prepared.inventory.filter(item => item?.id &&
        !sales.some(sale => sale.id === item.id) && !stored.some(deposit => deposit.id === item.id)));
    expect(after.stash.filter(item => item?.id)).toEqual([...prepared.stash.filter(item => item?.id), ...stored]);
    expect(earnedBagFreeSlots(after.inventory)).toBeGreaterThanOrEqual(EARNED_BAG_TARGET_FREE);
    await setAutoLootThroughSettings(page, autoLoot);
    await leaveTown();
    console.log('[earned-bag-management]', JSON.stringify({ equipped, upgrades, sales, stored: stored.map(({ id, name }) => ({ id, name })),
        before: { level: before.level, gold: before.gold, freeSlots: earnedBagFreeSlots(before.inventory) },
        after: { level: after.level, gold: after.gold, freeSlots: earnedBagFreeSlots(after.inventory) },
        seconds: (Date.now() - started) / 1000, note: stored.length
            ? 'Verified preserved whole-item stash deposits and any individual merchant proceeds.' : sales.length
            ? 'Verified merchant proceeds, not vendor estimates or granted gold.'
            : 'Equipped earned items to free space; no merchant sale was needed or verified.' }));
    return true;
}
