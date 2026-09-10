// Ordinary movement still requires the requested displacement. Formation may
// also finish after a real click when an alive character reaches its explicit
// destination region; it need not walk an extra unit after already arriving.
export function groundMovementObserved(before, after, minimumDistance = 1, arrival = null) {
    if (Math.hypot(after.x - before.x, after.z - before.z) > minimumDistance) return true;
    return Boolean(arrival && [after.x, after.z, arrival.x, arrival.z, arrival.radius].every(Number.isFinite) &&
        arrival.radius > 0 && after.state !== 'DEAD' && after.health > 0 &&
        typeof before.instanceType === 'string' && before.instanceType === after.instanceType &&
        Math.hypot(after.x - arrival.x, after.z - arrival.z) < arrival.radius);
}
