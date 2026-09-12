import { CONSTANTS } from '../core/Constants.js';

// Resolve only the caster's named/generic ability damage training. Rune,
// critical and receiver modifiers remain at their existing hit boundaries.
export function getFighterAbilityDamage(source, skill, base) {
    const className = source?.meshType || source?.subType || source?.constructor?.name;
    if (className !== 'Fighter') return base;
    return Math.floor(base * getFighterAbilityDamageMultiplier(source, skill) + 1e-9);
}

export function getFighterAbilityDamageMultiplier(source, skill) {
    const className = source?.meshType || source?.subType || source?.constructor?.name;
    if (className !== 'Fighter') return 1;
    let bonus = 0;
    for (const talent of CONSTANTS.PASSIVE_TALENTS.Fighter) {
        const effect = talent.abilityDamage;
        if (!effect || effect.skill && effect.skill !== skill) continue;
        const [prefix, number] = talent.id.split('_');
        let rank = 0;
        for (const id of new Set([talent.id, `${prefix}_${Number(number)}`])) {
            const raw = Number(source.talentRanks?.[id] || 0);
            if (Number.isFinite(raw)) rank = Math.max(rank, Math.min(talent.maxRank, Math.floor(raw)));
        }
        bonus += effect.damage * rank;
    }
    return (1 + bonus) * (source.spellFocusActive ? 2.5 : 1);
}
