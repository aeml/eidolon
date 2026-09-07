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
