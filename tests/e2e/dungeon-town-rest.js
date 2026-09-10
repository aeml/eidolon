import { expect } from '@playwright/test';
import { dungeonRestReason } from '../dungeonRestPolicy.js';
import { enterDungeon, returnToTown } from './helpers.js';
import { readEarnedRestResources } from './earned-town-rest.js';

const snapshot = page => page.evaluate(async () => {
    const { dungeonRestSnapshot } = await import('/tests/dungeonRestSnapshot.js');
    return dungeonRestSnapshot(window.game);
});

export async function recoverBetweenDungeonRooms(page, { playthrough, roomIndex, nearbyHostiles }) {
    const progress = await snapshot(page);
    const before = await readEarnedRestResources(page);
    const reason = dungeonRestReason(before, {
        cleared: progress.rooms.find(room => room.index === roomIndex)?.cleared === true, nearbyHostiles
    });
    if (!reason) return false;
    // Death is always failure, including during the actual Recall transition.
    await returnToTown(page, { allowRespawn: false });
    const arrived = await readEarnedRestResources(page);
    expect(arrived.zone).toBe('lanternhold');
    await expect.poll(async () => {
        const p = await readEarnedRestResources(page);
        return !p.dead && p.hp === p.maxHP && p.mana === p.maxMana;
    }, { timeout: 15_000, message: 'ordinary town time must restore dungeon expedition pools' }).toBe(true);
    const recovered = await readEarnedRestResources(page);
    expect(recovered.level).toBe(before.level);
    expect(recovered.bank).toBeGreaterThanOrEqual(arrived.bank);
    await enterDungeon(page, { ...playthrough, useTownGuide: true, resetRun: false });
    expect(await snapshot(page)).toEqual(progress);
    expect((await readEarnedRestResources(page)).dead).toBe(false);
    console.log('[dungeon-town-rest]', JSON.stringify({ reason, roomIndex, before, arrived, recovered,
        seed: progress.seed, generator: progress.generator, rooms: progress.rooms,
        note: 'Ordinary Recall/rest/guide re-entry; traversal resumes from the real entrance.' }));
    return true;
}
