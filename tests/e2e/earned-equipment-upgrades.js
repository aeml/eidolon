import { expect } from '@playwright/test';
import { canonicalEarnedItem, planEarnedEquipmentUpgrade } from '../earnedEquipmentUpgrades.js';

export const readEarnedGear = async page => {
    const state = await page.evaluate(() => {
    const p = window.game.player;
    return { className: p.constructor.name, level: p.level, gold: p.gold, xp: p.xp,
        inventory: p.inventory, equipment: p.equipment };
    });
    return { ...state, inventory: state.inventory.map(canonicalEarnedItem),
        equipment: Object.fromEntries(Object.entries(state.equipment).map(([slot, item]) => [slot, canonicalEarnedItem(item)])) };
};

const owned = state => [...state.inventory, ...Object.values(state.equipment)]
    .filter(item => item?.id).sort((a, b) => a.id.localeCompare(b.id));

// No player mutations or direct protocol requests. Drag actual bag items onto
// actual equipment slots, then wait for server-driven equipment/inventory state.
export async function upgradeEarnedEquipment(page) {
    let state = await readEarnedGear(page);
    const receipts = [];
    if (!planEarnedEquipmentUpgrade(state)) return receipts;
    await page.keyboard.press('i');
    await expect(page.locator('#inventory-screen')).toBeVisible();
    if (!await page.locator('#character-sheet').isVisible()) await page.keyboard.press('c');
    await expect(page.locator('#character-sheet')).toBeVisible();
    // Fixed bound: each replacement strictly increases total equipped utility.
    // Never renew this budget on a rejected, stale or oscillating swap.
    const limit = state.inventory.length * Object.keys(state.equipment).length;
    for (let attempt = 0; attempt < limit; attempt++) {
        const action = planEarnedEquipmentUpgrade(state);
        if (!action) break;
        const index = state.inventory.findIndex(item => item?.id === action.id);
        expect(index).toBeGreaterThanOrEqual(0);
        await page.locator('#inventory-grid .inv-slot').nth(index)
            .dragTo(page.locator(`#slot-${action.slot.toLowerCase()}`));
        await expect.poll(async () => {
            const next = await readEarnedGear(page);
            return next.equipment[action.slot]?.id === action.id &&
                next.inventory.some(item => item?.id === action.previousId) &&
                !next.inventory.some(item => item?.id === action.id);
        }).toBe(true);
        const after = await readEarnedGear(page);
        expect(owned(after), 'An upgrade must preserve every owned item and its contents').toEqual(owned(state));
        for (const key of ['level', 'gold', 'xp', 'className']) expect(after[key]).toEqual(state[key]);
        for (const [slot, item] of Object.entries(state.equipment)) {
            if (slot !== action.slot) expect(after.equipment[slot]).toEqual(item);
        }
        receipts.push(action);
        state = after;
    }
    expect(planEarnedEquipmentUpgrade(state), 'Bounded gear preparation must reach a stable loadout').toBeNull();
    await page.locator('#btn-close-inventory').click();
    if (await page.locator('#character-sheet').isVisible()) await page.locator('#btn-close-character').click();
    console.log('[earned-gear-upgrades]', JSON.stringify({ className: state.className, receipts,
        equipment: state.equipment }));
    return receipts;
}
