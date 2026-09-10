// Input planning only: retain spacing around the Fighter instead of aiming
// followers at the same point (which may be covered by a large boss model).
export function partyFollowStep(state, anchor, spacing = 4) {
    if (![state?.x, state?.z, anchor?.x, anchor?.z, spacing].every(Number.isFinite) || spacing < 0) {
        throw new Error('Party following requires finite world coordinates and nonnegative spacing');
    }
    const dx = anchor.x - state.x, dz = anchor.z - state.z, distance = Math.hypot(dx, dz);
    const travel = Math.min(12, distance - spacing);
    // The ordinary movement helper requires a one-unit witnessed displacement.
    if (travel < 1) return null;
    return { dx: dx * travel / distance, dz: dz * travel / distance };
}
