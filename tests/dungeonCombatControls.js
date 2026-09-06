// Select ordinary hotbar inputs for the full Fighter playthrough. This does
// not grant resources, skills, damage, healing or invulnerability.
export function selectFighterDungeonSkill(state, defensiveBuild = false) {
    if (state.classAbility !== 'Charge' || state.isCharging || state.dead || !Number.isFinite(state.mana) ||
        state.distance > state.attackRange) return null;
    const priorities = defensiveBuild
        ? [['Iron Fortress', 40], ['Guardian Roar', 35], ['Whirlwind', 30], ['Shield Slam', 25]]
        : [['Whirlwind', 30], ['Shield Slam', 25]];
    for (const [skill, baseCost] of priorities) {
        const index = (state.hotbar || []).indexOf(skill);
        if (index < 0 || (state.cooldowns?.[skill] || 0) > 0 ||
            state.mana < baseCost * (1 - (state.manaCostReduction || 0))) continue;
        return { skill, key: String(index + 1) };
    }
    return null;
}
