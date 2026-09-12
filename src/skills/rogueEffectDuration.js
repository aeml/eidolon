import { CONSTANTS } from '../core/Constants.js';

// Snapshot the named utility Mastery plus Dirty Tricks once at application,
// after rune changes. Never scale replicated remaining time or cooldowns.
export function getRogueEffectDuration(source, baseSeconds, skill = '') {
    const className = source?.meshType || source?.subType || source?.constructor?.name;
    if (className !== 'Rogue' || source?.isMultiplayer || source?.isRemote || source?.gameEngine?.isMultiplayer) return baseSeconds;
    let bonus = 0;
    for (const talent of CONSTANTS.PASSIVE_TALENTS.Rogue) {
        const effect = talent.abilityDuration;
        if (!effect || effect.skill && effect.skill !== skill) continue;
        const [prefix, number] = talent.id.split('_');
        let rank = 0;
        for (const id of new Set([talent.id, `${prefix}_${Number(number)}`])) {
            const raw = Number(source.talentRanks?.[id] || 0);
            if (Number.isFinite(raw)) rank = Math.max(rank, Math.min(talent.maxRank, Math.floor(raw)));
        }
        bonus += effect.duration * rank;
    }
    return baseSeconds * (1 + bonus);
}
