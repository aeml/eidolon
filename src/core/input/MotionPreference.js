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

// Presentation time pauses independently of authoritative lifetimes. Reusing
// the sample avoids listeners, storage reads and per-frame result allocation.
export function createVisualMotionClock() {
    const preference = createMotionPreference();
    return {
        time: 0, delta: 0, reduced: false, previous: 0, paused: 0,
        update(elapsed, dt) {
            this.reduced = preference.matches;
            if (this.reduced) this.paused = elapsed - this.time;
            else this.time = Math.max(0, elapsed - this.paused);
            this.previous = elapsed;
            this.delta = this.reduced ? 0 : dt;
            return this;
        }
    };
}
