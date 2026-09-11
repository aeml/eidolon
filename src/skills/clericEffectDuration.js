import { CONSTANTS } from '../core/Constants.js';

// Resolve caster training at application, after a rune's base duration. Never
// reinterpret authoritative remaining time or multiply an already-applied buff.
export function getClericEffectDuration(source, skill, baseSeconds) {
    const className = source?.meshType || source?.subType || source?.constructor?.name;
    if (className !== 'Cleric' || source?.isMultiplayer || source?.isRemote || source?.gameEngine?.isMultiplayer || !(baseSeconds > 0)) return baseSeconds;
    let bonus = 0;
    for (const talent of CONSTANTS.PASSIVE_TALENTS.Cleric) {
        const effect = talent.abilityDuration;
        if (!effect || effect.skill && effect.skill !== skill) continue;
        const [prefix,number] = talent.id.split('_');
        let rank = 0;
        for (const id of new Set([talent.id,`${prefix}_${Number(number)}`])) {
            const raw = Number(source.talentRanks?.[id] || 0);
            if (Number.isFinite(raw)) rank = Math.max(rank,Math.min(talent.maxRank,Math.floor(raw)));
        }
        bonus += effect.duration*rank;
    }
    return baseSeconds*(1+bonus);
}
