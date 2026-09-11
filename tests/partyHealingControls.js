// Ordinary party-test input planning only; this never heals, moves or edits a
// character. The real roster/hotbar dispatch retains server admission checks.
export function selectPartyHealTarget(states, healer, range) {
    if (![healer?.x, healer?.z, range].every(Number.isFinite) || range < 0) {
        throw new Error('Party healing requires finite position and nonnegative range');
    }
    if (healer.dead || healer.hp <= 0) return null;
    const injured = states.filter(state => !state.dead && state.instance === healer.instance &&
        [state.hp, state.maxHP, state.x, state.z].every(Number.isFinite) &&
        state.hp > 0 && state.maxHP > 0 && state.hp / state.maxHP < .85)
        .sort((a, b) => a.hp / a.maxHP - b.hp / b.maxHP);
    // Spend a useful heal now before chasing an even more injured ally. If
    // nobody in range needs healing, retain that distant ally as an approach
    // target; warning policy still decides whether movement is currently safe.
    return injured.find(state => Math.hypot(state.x - healer.x, state.z - healer.z) <= range)
        || injured[0] || null;
}
