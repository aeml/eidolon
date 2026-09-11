// Dirty Tricks retains its server-defined duration benefit and saved ROG_28
// investment. Resolve at application, never against replicated remaining time.
export function getRogueEffectDuration(source, baseSeconds) {
    const className = source?.meshType || source?.subType || source?.constructor?.name;
    if (className !== 'Rogue' || source?.isMultiplayer || source?.isRemote || source?.gameEngine?.isMultiplayer) return baseSeconds;
    const raw = Number(source?.talentRanks?.ROG_28 || 0);
    const rank = Number.isFinite(raw) ? Math.max(0, Math.min(5, Math.floor(raw))) : 0;
    return baseSeconds*(1+.04*rank);
}
