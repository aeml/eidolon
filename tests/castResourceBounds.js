// A real regen tick can land between the browser's pre-input snapshot and the
// server's cast receipt. Bound only that recovery; do not require a full bar.
export function castResourceBounds(before, cost, elapsedMs) {
    if (![before.mana, before.maxMana, before.manaRegen, cost, elapsedMs].every(Number.isFinite) ||
        cost < 0 || before.mana < cost || before.mana > before.maxMana || before.manaRegen < 0 || elapsedMs < 0) {
        throw new Error('Invalid cast resource observation');
    }
    const minimum = before.mana - cost;
    const recovery = Math.ceil(before.manaRegen * (Math.floor(elapsedMs / 1000) + 1));
    return { minimum, maximum: Math.min(before.maxMana - cost, minimum + recovery) };
}

// Safe-zone observations are complete authoritative frames on either side of
// one cast. Earned bank time excludes offline time and avoids using the much
// lower ordinary stat-regen rate as an explanation for town recovery.
export function restedCastResourceBounds(before, after, cost) {
    const values = [before.mana, before.maxMana, before.bank, after.bank, after.maxMana, cost];
    if (!values.every(Number.isFinite) || cost < 0 || before.mana < cost ||
        before.mana > before.maxMana || before.maxMana <= 0 || before.bank <= 0 ||
        after.bank < before.bank || after.bank >= 7200 ||
        before.maxMana !== after.maxMana || !before.zone || before.zone !== after.zone) {
        throw new Error('Invalid authoritative sanctuary cast interval');
    }
    const minimum = before.mana - cost;
    // Unknown incoming fractional carry is less than one resource point.
    const recovery = Math.ceil(before.maxMana * .1 * (after.bank - before.bank));
    return { minimum, maximum: Math.min(before.maxMana - cost, minimum + recovery) };
}

// A reconnect clears fractional carry. Across exactly one disconnect the two
// floored segments can lose at most one whole point relative to a continuous
// interval; incoming carry can contribute less than one point. No offline
// seconds appear in the authoritative bank delta.
export function sanctuaryRecoveryBounds(current, maximum, earnedSeconds, disconnects = 0) {
    if (![current, maximum, earnedSeconds].every(Number.isFinite) || current < 0 ||
        current > maximum || maximum <= 0 || earnedSeconds < 0 ||
        ![0, 1].includes(disconnects)) throw new Error('Invalid sanctuary recovery interval');
    const recovery = maximum * .1 * earnedSeconds;
    return { minimum: Math.min(maximum, current + Math.max(0, Math.floor(recovery + 1e-9) - disconnects)),
        maximum: Math.min(maximum, current + Math.ceil(recovery)) };
}
