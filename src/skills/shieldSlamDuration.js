// Match the existing server duration definitions and compose after Concussion.
// This is an effect timer, not a cooldown, animation or charge-travel duration.
export function getShieldSlamStunDuration(source) {
    const rank = id => {
        const value = Number(source?.talentRanks?.[id] || 0);
        return Number.isFinite(value) ? Math.max(0, Math.min(5, Math.floor(value))) : 0;
    };
    const base = source?.skillRunes?.['Shield Slam'] === 'shieldslam_concussion' ? 2.5 : 1.5;
    return base * (1 + .04 * rank('FTR_30') + .03 * rank('FTR_37'));
}
