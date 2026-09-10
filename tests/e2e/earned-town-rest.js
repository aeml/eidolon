import { expect } from '@playwright/test';
import { collectionRestReason } from '../collectionRestPolicy.js';
import { returnToTown } from './helpers.js';

export const readEarnedRestResources = page => page.evaluate(async () => {
    const { earnedRestResources } = await import('/tests/earnedRecoveryPolicy.js');
    return earnedRestResources(window.game.player);
});

// Normal earned expedition recovery. Call only between completed encounters: no
// mid-fight timer reset, fake recovery, progression grant or death bypass.
export async function recoverBetweenCollectionEncounters(page, leaveTown) {
    const before = await readEarnedRestResources(page);
    const reason = collectionRestReason(before);
    if (!reason) return false;
    return restoreEarnedTownResources(page, leaveTown, before, reason);
}

// Mid-encounter retreat can receive a legitimate in-flight kill/level-up. Never
// undo that progress, and retain strict level equality between encounters.
export async function restoreEarnedTownResources(page, leaveTown, before, reason, { preserveLevel = true } = {}) {
    const started = Date.now();
    if (preserveLevel) await returnToTown(page);
    else await returnToTown(page, { allowRespawn: false });
    await expect.poll(() => readEarnedRestResources(page).then(state => state.zone)).toBe('lanternhold');
    const arrived = await readEarnedRestResources(page);
    await expect.poll(() => readEarnedRestResources(page).then(state => !state.dead && state.hp === state.maxHP && state.mana === state.maxMana),
        { timeout: 15_000, message: 'ordinary sanctuary time must restore the spent pools' }).toBe(true);
    const recovered = await readEarnedRestResources(page);
    if (preserveLevel) expect(recovered.level).toBe(before.level);
    else expect(recovered.level).toBeGreaterThanOrEqual(before.level);
    expect(recovered.bank).toBeGreaterThanOrEqual(arrived.bank);
    await leaveTown();
    await expect.poll(() => readEarnedRestResources(page).then(state => state.zone)).toBe('');
    console.log('[earned-town-rest]', JSON.stringify({ reason, before, arrived, recovered,
        context: preserveLevel ? 'between-encounters' : 'unfinished-hunt',
        resumed: await readEarnedRestResources(page), seconds: (Date.now() - started) / 1000 }));
    return true;
}
