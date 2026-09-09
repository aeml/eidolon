import { expect } from '@playwright/test';
import { collectionRestReason } from '../collectionRestPolicy.js';
import { returnToTown } from './helpers.js';

const resources = page => page.evaluate(async () => {
    const p = window.game.player;
    const { getAbilityManaCost } = await import('/src/core/AbilityEconomy.js');
    return { hp: p.stats.hp, maxHP: p.stats.maxHp, mana: p.stats.mana, maxMana: p.stats.maxMana,
        dead: p.state === 'DEAD', castCost: getAbilityManaCost(p, p.abilityName, 30),
        bank: p.wellRestedSeconds, zone: p.safeZoneId, level: p.level };
});

// Opt-in earned-play comparison. Call only between completed encounters: no
// mid-fight timer reset, fake recovery, progression grant or death bypass.
export async function recoverBetweenCollectionEncounters(page, leaveTown) {
    expect(await page.evaluate(() => window.game.player.constructor.name)).toBe('Wizard');
    const before = await resources(page);
    const reason = collectionRestReason(before);
    if (!reason) return false;
    const started = Date.now();
    await returnToTown(page);
    await expect.poll(() => resources(page).then(state => state.zone)).toBe('lanternhold');
    const arrived = await resources(page);
    await expect.poll(() => resources(page).then(state => !state.dead && state.hp === state.maxHP && state.mana === state.maxMana),
        { timeout: 15_000, message: 'ordinary sanctuary time must restore the spent pools' }).toBe(true);
    const recovered = await resources(page);
    expect(recovered.level).toBe(before.level);
    expect(recovered.bank).toBeGreaterThanOrEqual(arrived.bank);
    await leaveTown();
    await expect.poll(() => resources(page).then(state => state.zone)).toBe('');
    console.log('[earned-town-rest]', JSON.stringify({ reason, before, arrived, recovered,
        resumed: await resources(page), seconds: (Date.now() - started) / 1000 }));
    return true;
}
