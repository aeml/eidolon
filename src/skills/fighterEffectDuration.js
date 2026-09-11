// Offline counterpart of the existing generic Fighter SkillDuration bonuses.
// Resolve once at the cast, after rune/combo adjustments. Never apply this to
// replicated remaining time, cooldowns, animation or movement/channel timing.
export function getFighterEffectDuration(source, baseSeconds) {
    const rank = id => {
        const value = Number(source?.talentRanks?.[id] || 0);
        return Number.isFinite(value) ? Math.max(0, Math.min(5, Math.floor(value))) : 0;
    };
    return baseSeconds * (1 + .04 * rank('FTR_30') + .03 * rank('FTR_37'));
}
