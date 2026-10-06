import { expect } from '@playwright/test';
import { planPersistentQAStashSpare } from '../persistentQAStashPolicy.js';
import { returnToTown } from './helpers.js';
import { openEarnedStash } from './earned-stash-storage.js';

export async function storePersistentQALootSpare(page) {
    await returnToTown(page, { allowRespawn: false });
    for (const [screen, close] of [['#shop-screen', '#btn-close-shop'], ['#inventory-screen', '#btn-close-inventory']]) {
        if (await page.locator(screen).isVisible()) await page.locator(close).click();
    }
    await openEarnedStash(page);
    const read = () => page.evaluate(() => {
        const player = window.game.player;
        return { inventory: player.inventory, stash: player.stash,
            equipment: player.equipment, gold: player.gold };
    });
    const before = await read();
    const capacity = Number((await page.locator('#stash-browser-stash-title [role="status"]').textContent()).split('/')[1]);
    const planned = planPersistentQAStashSpare(before, capacity);
    expect(planned, 'Full QA bag needs one reversible gear deposit and real stash space; quest items remain carried').not.toBeNull();
    const { item, index } = planned;
    await page.locator(`.stash-browser-item[data-source="inventory"][data-slot-index="${index}"]`).click({ button: 'right' });
    await expect.poll(async () => (await read()).inventory.some(entry => entry?.id === item.id), {
        timeout: 15_000, message: 'Stored gear must leave the authoritative bag'
    }).toBe(false);
    await expect.poll(async () => (await read()).stash.filter(entry => entry?.id), {
        timeout: 15_000, message: 'Exact gear and all previous stash contents must be preserved'
    }).toEqual([...before.stash.filter(entry => entry?.id), item]);
    const after = await read();
    expect(after.gold).toBe(before.gold);
    expect(after.equipment).toEqual(before.equipment);
    // Already-earned pending loot may fill the freed slot, but never erase
    // another original item. The caller rechecks actual capacity each time.
    expect(after.inventory).toEqual(expect.arrayContaining(before.inventory.filter(entry => entry?.id && entry.id !== item.id)));
    await page.locator('#btn-close-stash').click();
    return item;
}
