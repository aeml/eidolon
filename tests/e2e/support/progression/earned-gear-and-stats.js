import { expect } from '@playwright/test';

// Shared ordinary inventory inputs, used before and after specialization level.
// Equip only collected eligible items into empty slots; never replace old gear.
export async function equipEarnedGearAndStats(page, { stat, statAllocations }) {
    await page.keyboard.press('i');
    await expect(page.locator('#inventory-screen')).toBeVisible();
    const candidates = await page.evaluate(() => {
        const slots = new Set(['head', 'chest', 'legs', 'feet', 'gloves', 'shoulders', 'belt',
            'neck', 'mainHand', 'offHand', 'ring', 'ring1', 'ring2', 'trinket', 'trinket1', 'trinket2']);
        return window.game.player.inventory.filter(item => item?.id &&
            item.level <= window.game.player.level && slots.has(item.slot) &&
            !['MATERIAL', 'RELIC', 'GEM'].includes(item.type))
            .map(item => ({ id: item.id, slot: item.slot, name: item.name }));
    });
    let equipped = 0;
    for (const candidate of candidates) {
        const index = await page.evaluate(({ id, slot }) => {
            const p = window.game.player;
            const possible = slot === 'ring' ? ['ring1', 'ring2'] :
                slot === 'trinket' ? ['trinket1', 'trinket2'] : [slot];
            return possible.every(key => p.equipment[key]?.id) ? -1 :
                p.inventory.findIndex(item => item?.id === id);
        }, candidate);
        if (index < 0) continue;
        await page.locator('#inventory-grid .inv-slot').nth(index).click();
        await expect.poll(() => page.evaluate(id => Object.values(window.game.player.equipment)
            .some(item => item?.id === id), candidate.id)).toBe(true);
        equipped++;
    }
    const available = await page.evaluate(() => window.game.player.statPoints);
    const allocated = Math.min(statAllocations, available);
    for (let i = 0; i < allocated; i++) {
        await page.getByRole('button', { name: `Increase ${stat}`, exact: true }).click();
        await expect.poll(() => page.evaluate(() => window.game.player.statPoints)).toBe(available - i - 1);
    }
    await page.locator('#btn-close-inventory').click();
    if (await page.locator('#character-sheet').isVisible()) await page.locator('#btn-close-character').click();
    return { equipped, allocated };
}
