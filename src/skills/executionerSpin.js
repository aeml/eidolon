// The authoritative spin is one strike, not Whirlwind's periodic channel.
// Keep its intermediate truncation and marked/threat bonus in the same order.
export function getExecutionerSpinDamage(source, target) {
    const rank = id => {
        const value = Number(source.talentRanks?.[id] || 0);
        return Number.isFinite(value) ? Math.max(0, Math.min(5, Math.floor(value))) : 0;
    };
    const multiplier = (1 + .04 * rank('FTR_23') + .02 * rank('FTR_38')) * (source.spellFocusActive ? 2.5 : 1);
    const base = Math.floor((source.stats.damage + source.stats.strength * 3) * 1.3 * multiplier);
    const threatened = target.threat instanceof Map ? target.threat.get(source.id) : target.threat?.[source.id];
    return target.weakPointMarkTimer > 0 || target.markWeaknessTimer > 0 || threatened > 0 ? Math.floor(base * 1.5) : base;
}
