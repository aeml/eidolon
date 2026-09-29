// Display the paid server cast, never another actor's private talent ranks.
// Called only after the existing active-bit/timer admission has accepted a buff.
export function readDamageBuffMultiplier(payload, key, previous, base, maximum, minimum = base) {
    const value = Number(payload[key] !== undefined ? payload[key] : previous);
    return Number.isFinite(value) && value >= minimum && value <= maximum ? value : base;
}
