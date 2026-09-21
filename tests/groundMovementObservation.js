// This witnesses an input, not final party formation. A long step must make
// real progress toward its planned waypoint; a short step must reach its arrival
// region. Both retain living/same-instance guards. The caller waits for movement
// to settle and gatherPartyFormation checks every member's actual final position.
export function groundMovementObserved(before, after, minimumDistance = 1, arrival = null) {
    const displacement = Math.hypot(after.x - before.x, after.z - before.z);
    if (!arrival) return displacement > minimumDistance;
    const valid = Boolean(Number.isFinite(displacement) && displacement > 0 &&
        [after.x, after.z, arrival.x, arrival.z, arrival.radius].every(Number.isFinite) &&
        arrival.radius > 0 && after.state !== 'DEAD' && after.health > 0 &&
        typeof before.instanceType === 'string' && before.instanceType === after.instanceType &&
        typeof arrival.instanceId === 'string' && before.instanceId === arrival.instanceId && after.instanceId === arrival.instanceId);
    if (!valid) return false;
    const remaining = Math.hypot(after.x - arrival.x, after.z - arrival.z);
    return remaining < arrival.radius || (displacement > minimumDistance &&
        remaining < Math.hypot(before.x - arrival.x, before.z - arrival.z));
}

// A busy multi-page browser can finish an observation after expect.poll's
// deadline. One final read may confirm actual arrival, but never waive a failed
// partial step, death or instance change. No extra input or larger tolerance.
export function confirmedGroundArrival(before, after, arrival, clickProbe) {
    return Boolean(arrival && clickProbe?.result === true && clickProbe.dom === 'CANVAS' &&
        after?.state === 'IDLE' && groundMovementObserved(before, after, 1, arrival) &&
        Math.hypot(after.x - arrival.x, after.z - arrival.z) < arrival.radius);
}
