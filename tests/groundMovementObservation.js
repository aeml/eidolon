// Ordinary movement requires the requested displacement. An explicit arrival
// instead requires real movement into that region, alive in the same instance.
// A long displacement cannot bypass an explicitly requested destination.
export function groundMovementObserved(before, after, minimumDistance = 1, arrival = null) {
    const displacement = Math.hypot(after.x - before.x, after.z - before.z);
    if (!arrival) return displacement > minimumDistance;
    return Boolean(Number.isFinite(displacement) && displacement > 0 &&
        [after.x, after.z, arrival.x, arrival.z, arrival.radius].every(Number.isFinite) &&
        arrival.radius > 0 && after.state !== 'DEAD' && after.health > 0 &&
        typeof before.instanceType === 'string' && before.instanceType === after.instanceType &&
        typeof arrival.instanceId === 'string' && before.instanceId === arrival.instanceId && after.instanceId === arrival.instanceId &&
        Math.hypot(after.x - arrival.x, after.z - arrival.z) < arrival.radius);
}
