import { CONSTANTS } from '../core/Constants.js';

// Paired with actual server casts via testdata/rogue_damage.json. Wounds,
// positional/rune bonuses, armor and ordinary criticals remain separate.
export const ROGUE_DAMAGE_PROFILES = Object.freeze(Object.fromEntries([
    ['Piercing Throw', 15, 1.5, 0], ['Backstab', 0, 0, 1.5],
    ['Death Spiral', 0, 0, 2], ['Fan of Knives', 10, 1, 0],
    ['Blade Storm', 10, 1, 0], ['Phantom Volley', 25, 2, 0], ['Tripwire', 20, 1, 0]
].map(([skill, base, dexterity, weapon]) => [skill, Object.freeze({ base, dexterity, weapon })])));

export function getRogueAbilityDamageMultiplier(source, skill) {
    const className = source?.meshType || source?.subType || source?.constructor?.name;
    if (className !== 'Rogue' || source.isRemote || source.isMultiplayer ||
        source.gameEngine?.isMultiplayer || !Object.hasOwn(ROGUE_DAMAGE_PROFILES, skill)) return 1;
    let bonus = 0;
    for (const talent of CONSTANTS.PASSIVE_TALENTS.Rogue) {
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
    return 1 + bonus;
}

export function resolveRogueAbilityDamage(source, skill) {
    // Preserve the existing legacy dagger fallback for unknown skills.
    const profile = ROGUE_DAMAGE_PROFILES[skill] || ROGUE_DAMAGE_PROFILES['Piercing Throw'];
    const base = profile.base + Math.trunc(source.stats.dexterity * profile.dexterity) +
        source.stats.damage * profile.weapon;
    return Math.trunc(base * getRogueAbilityDamageMultiplier(source, skill));
}
