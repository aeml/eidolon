import { expect } from '@playwright/test';
import { planEarnedStashUpgrade } from '../earnedStashUpgrades.js';
import { readEarnedGear, upgradeEarnedEquipment } from './earned-equipment-upgrades.js';
import { openEarnedStash } from './earned-stash-storage.js';

const owned = p => [...p.inventory, ...p.stash, ...Object.values(p.equipment)]
    .filter(item => item?.id).sort((a, b) => a.id.localeCompare(b.id));
const unchanged = (before, after) => {
    expect(owned(after), 'Stash preparation must conserve every full item').toEqual(owned(before));
    for (const key of ['className', 'level', 'gold', 'xp']) expect(after[key]).toEqual(before[key]);
};
const close = async page => {
    await page.locator('#btn-close-stash').click();
    if (await page.locator('#inventory-screen').isVisible()) await page.locator('#btn-close-inventory').click();
};

// Caller has already equipped carried upgrades and is in town. No grant,
// direct protocol command, item fabrication, sale or disposal occurs here.
export async function upgradeEarnedStoredEquipment(page) {
    await openEarnedStash(page);
    let state = await readEarnedGear(page);
    expect(Array.isArray(state.stash), 'Read actual opened storage before preparation').toBe(true);
    console.log('[earned-stash-inspection]', JSON.stringify({ level: state.level, stash: state.stash }));
    const limit = state.stash.filter(item => item?.id).length;
    const withdrawn = [], upgrades = [];
    for (let attempt = 0; attempt < limit; attempt++) {
        const action = planEarnedStashUpgrade(state);
        if (!action) break;
        if (action.blockedByFullBag) throw new Error('Stored upgrade requires one free bag slot before withdrawal');
        const index = state.stash.findIndex(item => item?.id === action.id);
        await page.locator('#stash-grid .inv-slot').nth(index).click({ button: 'right' });
        await expect.poll(async () => {
            const p = await readEarnedGear(page);
            return p.inventory.some(item => item?.id === action.id) && !p.stash.some(item => item?.id === action.id);
        }).toBe(true);
        const transferred = await readEarnedGear(page);
        unchanged(state, transferred);
        expect(transferred.equipment).toEqual(state.equipment);
        await close(page);
        const applied = await upgradeEarnedEquipment(page);
        expect(applied.some(item => item.id === action.id), 'Withdrawn upgrade must actually become equipped').toBe(true);
        const equipped = await readEarnedGear(page);
        unchanged(state, equipped);
        withdrawn.push(action);
        upgrades.push(...applied);
        await openEarnedStash(page);
        state = await readEarnedGear(page);
    }
    expect(planEarnedStashUpgrade(state), 'Bounded storage preparation must finish before dungeon entry').toBeNull();
    await close(page);
    console.log('[earned-stash-upgrades]', JSON.stringify({ withdrawn, upgrades, stash: state.stash }));
    return { withdrawn, upgrades };
}
