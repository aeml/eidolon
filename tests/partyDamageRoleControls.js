// Choose legal self-buff inputs from the actual loadout/resources. This does
// not grant skills or stats, and never spends mana during travel/out-of-range.
export function selectPartyDamageBuff(state) {
    if (state.dead || !Number.isFinite(state.distance) || state.distance > state.range ||
        !Number.isFinite(state.mana) || state.sinceCastMs < 550) return null;
    const skill = state.className === 'Wizard' && state.healthRatio < .9 && !state.shieldActive
        ? 'Arcane Shield' : state.className === 'Rogue' && !state.poisonActive ? 'Poison Coating' : null;
    const slot = state.hotbar?.indexOf(skill) ?? -1;
    const cost = state.costs?.[skill];
    if (!skill || slot < 0 || slot > 3 || !state.unlockedSkills?.includes(skill) ||
        (state.cooldowns?.[skill] || 0) > 0 || !Number.isFinite(cost) || cost < 0 || state.mana < cost) return null;
    return { skill, key: String(slot + 1) };
}

// Client-observed timing is diagnostic, not authoritative proof of a dodge.
// Retain the latest position as well as the first early escape so re-entering
// the danger area cannot be disguised by an earlier successful movement.
export function observePartyWarning(warning, position, now) {
    const safe = Math.hypot(position.x - warning.x, position.z - warning.z) >= warning.radius + 1.5;
    const enteredDanger = warning.enteredDanger || !safe;
    const firstSafeAt = warning.firstSafeAt ??
        (enteredDanger && safe && now < warning.expires ? now : null);
    return { ...warning, safe, enteredDanger, firstSafeAt, lastObservedAt: now };
}
