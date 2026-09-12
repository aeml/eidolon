import { readClericUtilityScalar } from '../core/ClericUtilityState.js';

export const isOfflineUtilityActor = actor => actor && !actor.isRemote && !actor.isMultiplayer && !actor.gameEngine?.isMultiplayer;

export function getClericUtilityPower(source, skill) {
    if ((source?.meshType || source?.constructor?.name) !== 'Cleric') return 1;
    const id = { 'Blessing of Resolve': 19, 'Blessing of Zeal': 21, 'Mark of Weakness': 23 }[skill];
    if (!id) return 1;
    let rank = 0;
    for (const [key, value] of Object.entries(source.talentRanks || {})) {
        if (/^CLR_\d+$/.test(key) && Number(key.slice(4)) === id && Number.isFinite(Number(value))) {
            rank = Math.max(rank, Math.min(5, Math.max(0, Math.floor(Number(value)))));
        }
    }
    return (25 + rank) / 25;
}

// Rebuilt from ordinary derived stats, once. Replicated stats already include
// these effects and must never receive a second local multiplier.
export function applyOfflineClericUtilityStats(actor) {
    if (!isOfflineUtilityActor(actor)) return;
    if (actor.blessingResolveTimer > 0) {
        const power = readClericUtilityScalar({}, '', actor.blessingResolvePower);
        actor.stats.defense = Math.trunc(actor.stats.defense * (1 + .2 * power));
    }
    if (actor.blessingZealTimer > 0) {
        const power = readClericUtilityScalar({}, '', actor.zealPower);
        actor.stats.speed *= 1 + .2 * power;
        actor.stats.attackSpeed /= 1 + .3 * power;
    }
}

export function advanceClericUtilityBuffs(actor, dt) {
    let changed = false;
    for (const [timer, power, active] of [
        ['blessingResolveTimer', 'blessingResolvePower', 'blessingResolveActive'],
        ['blessingZealTimer', 'zealPower', 'blessingZealActive']
    ]) {
        if (!(actor[timer] > 0)) continue;
        actor[timer] = Math.max(0, actor[timer] - dt);
        if (!actor[timer]) {
            actor[power] = 0;
            if (isOfflineUtilityActor(actor)) actor[active] = false;
            changed = true;
        }
    }
    if (!actor.blessingZealTimer) actor.blessingZealFactor = 0;
    if (changed && isOfflineUtilityActor(actor)) actor.recalculateStats();
}
