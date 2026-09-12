// Ordinary party-test input planning only; this never heals, moves or edits a
// character. The real roster/hotbar dispatch retains server admission checks.
export function selectPartyHealTarget(states, healer, range, { allowApproach = true } = {}) {
    if (![healer?.x, healer?.z, range].every(Number.isFinite) || range < 0) {
        throw new Error('Party healing requires finite position and nonnegative range');
    }
    if (healer.dead || healer.hp <= 0) return null;
    const injured = states.filter(state => !state.dead && state.instance === healer.instance &&
        [state.hp, state.maxHP, state.x, state.z].every(Number.isFinite) &&
        state.hp > 0 && state.maxHP > 0 && state.hp / state.maxHP < .85)
        .sort((a, b) => a.hp / a.maxHP - b.hp / b.maxHP);
    const distance = state => Math.hypot(state.x - healer.x, state.z - healer.z);
    const reachable = injured.find(state => distance(state) <= range);
    // Preserve immediate aid for urgent reachable allies. But do not spend a
    // full heal cooldown on someone above60% while a below40% ally is only a
    // short approach away. This selects a walking target, never extends range.
    if (allowApproach && reachable && reachable.hp / reachable.maxHP > .6) {
        const criticalNearby = injured.find(state => state.hp / state.maxHP < .4 && distance(state) <= range + 2);
        if (criticalNearby) return criticalNearby;
    }
    // If nobody reachable needs aid, retain the distant target for approach;
    // the caller still enforces warning, collision and actual cast-range rules.
    return reachable || injured[0] || null;
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
