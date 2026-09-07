import { CONSTANTS } from './Constants.js';

// Mirrors server equipment rounding followed by the additive spell-talent
// multiplier. Call only from implemented offline healing consumers; receiving
// poison and missing-health clamps belong to the particular target.
export function getAbilityHealingAmount(source, skillName, base) {
    if (!(base > 0)) return 0;
    const className = source?.meshType || source?.constructor?.name;
    let bonus = 0;
    for (const talent of CONSTANTS.PASSIVE_TALENTS[className] || []) {
        const effect = talent.abilityHealing;
        if (!effect || effect.skill && effect.skill !== skillName) continue;
        const raw = Number(source?.talentRanks?.[talent.id] || 0);
        const rank = Number.isFinite(raw) ? Math.max(0, Math.min(talent.maxRank, Math.floor(raw))) : 0;
        bonus += effect.healing * rank;
    }
    const equipment = Number(source?.stats?.healingDoneBonus || 0);
    const equipped = Math.max(1, Math.floor(base * (1 + (Number.isFinite(equipment) ? equipment : 0))));
    return Math.floor(equipped * (1 + Math.max(0, bonus)) + 1e-9);
}

// Receiving-side policy for implemented offline heals: poison, then the missing
// health clamp. Never mutate replicas; their health belongs to the server.
export function applyOfflineHealing(target, amount, floatingTextManager = null) {
    if (!target?.isActive || target.state === 'DEAD' || target.isMultiplayer || target.isRemote || target.gameEngine?.isMultiplayer || !(amount > 0)) return 0;
    const received = target.poisonTimer > 0 ? Math.max(1, Math.floor(amount / 2)) : amount;
    const before = target.stats.hp;
    target.stats.hp = Math.min(target.stats.maxHp, before + received);
    const actual = target.stats.hp - before;
    if (actual > 0) floatingTextManager?.spawn(`+${actual}`, target.position, '#00ff00');
    return actual;
}

export function updateOfflineHealingLight(target, dt) {
    const renewal = target.healingLightRenewal;
    if (!renewal) return;
    if (!target.isActive || target.state === 'DEAD' || target.isMultiplayer || target.isRemote || target.gameEngine?.isMultiplayer) {
        target.healingLightRenewal = null;
        return;
    }
    renewal.elapsed += Math.max(0, dt);
    while (renewal.elapsed >= 1 && renewal.ticks > 0) {
        renewal.elapsed -= 1;
        renewal.ticks--;
        applyOfflineHealing(target, renewal.amount, renewal.floatingTextManager);
    }
    if (renewal.ticks === 0) target.healingLightRenewal = null;
}
