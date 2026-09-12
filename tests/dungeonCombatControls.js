// Select ordinary hotbar inputs for the full Fighter playthrough. This does
// not grant resources, skills, damage, healing or invulnerability.
export function selectFighterDungeonSkill(state, defensiveBuild = false, { partyTank = false } = {}) {
    if (state.classAbility !== 'Charge' || state.isCharging || state.dead || !Number.isFinite(state.mana) ||
        state.distance > state.attackRange) return null;
    const priorities = partyTank
        ? [['Iron Fortress', 40], ['Guardian Roar', 35], ['Shield Slam', 25], ['Whirlwind', 30]]
        : defensiveBuild
        ? [['Iron Fortress', 40], ['Guardian Roar', 35], ['Whirlwind', 30], ['Shield Slam', 25]]
        : [['Whirlwind', 30], ['Shield Slam', 25]];
    const cost = (skill, baseCost) => state.skillCosts?.[skill] ?? baseCost * (1 - (state.manaCostReduction || 0));
    for (const [skill, baseCost] of priorities) {
        const index = (state.hotbar || []).indexOf(skill);
        if (index < 0 || (state.cooldowns?.[skill] || 0) > 0 ||
            state.mana < cost(skill, baseCost)) continue;
        // Protect the next defensive cast even while it is cooling down. If
        // every newly pooled25mana buys a Slam, the40mana Fortress can never
        // become affordable. Basic attacks continue while saving this budget.
        let reserve = 0;
        if (partyTank && skill !== 'Iron Fortress' && state.hotbar.includes('Iron Fortress')) {
            reserve += cost('Iron Fortress', 40);
        }
        // Optional Whirlwind also leaves enough for the next threat Slam.
        if (partyTank && skill === 'Whirlwind' && state.hotbar.includes('Shield Slam')) reserve += cost('Shield Slam', 25);
        if (state.mana < cost(skill, baseCost) + reserve) continue;
        return { skill, key: String(index + 1) };
    }
    return null;
}

// Charge is a gap closer, not a replacement for melee contact attacks.
export function shouldUseHuntPrimary(state, { minimumChargeDistance = 0 } = {}) {
    if (state.cooldown > 0 || state.dead || !Number.isFinite(state.distance)) return false;
    if (state.ability === 'Charge' && state.distance <= Math.max(state.attackRange + 2, minimumChargeDistance)) return false;
    return state.distance <= state.castRange;
}
