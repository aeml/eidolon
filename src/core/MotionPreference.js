// Live device preference plus the in-game reduction setting. No owned listeners
// or per-frame storage access; essential warnings remain visible.
export function createMotionPreference() {
    const system = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
    return { get matches() {
        return globalThis.document?.documentElement?.dataset?.reducedMotion === 'true' || Boolean(system?.matches);
    } };
}

export function prefersReducedMotion() {
    return createMotionPreference().matches;
}
