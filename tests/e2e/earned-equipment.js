import { expect } from '@playwright/test';
import { earnedEquipmentCandidates } from '../earnedEquipmentCandidates.js';

// Only click items already earned and physically present in the bag. Do not
// replace occupied slots, buy equipment, change stats, Recall or reconnect.
export async function equipEarnedEmptySlots(page) {
    const state = await page.evaluate(() => ({ inventory: window.game.player.inventory,
        equipment: window.game.player.equipment, level: window.game.player.level }));
    const candidates = earnedEquipmentCandidates(state.inventory, state.equipment, state.level);
    if (!candidates.length) return 0;
    await page.keyboard.press('i');
    await expect(page.locator('#inventory-screen')).toBeVisible();
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
    await page.locator('#btn-close-inventory').click();
    if (await page.locator('#character-sheet').isVisible()) await page.locator('#btn-close-character').click();
    return equipped;
}
