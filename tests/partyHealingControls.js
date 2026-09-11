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

// Spend direct-heal cooldown time maintaining the already-active aura. This
// plans normal follow input only; ready heals and telegraph safety come first.
export function partyAuraFollowSpacing(healer, target, { allowMovement, cooldown, auraActive, auraRadius }) {
    if (!allowMovement || !auraActive || !Number.isFinite(cooldown) || cooldown < 1 ||
        !Number.isFinite(auraRadius) || auraRadius <= 3 || healer?.dead || target?.dead ||
        healer?.instance !== target?.instance || healer?.hp <= 0 || target?.hp <= 0 ||
        ![healer?.hp, target?.hp, healer?.x, healer?.z, target?.x, target?.z].every(Number.isFinite)) return null;
    if (Math.hypot(target.x - healer.x, target.z - healer.z) <= auraRadius - 1) return null;
    return auraRadius - 3;
}
