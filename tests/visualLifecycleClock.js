// Prepared visual fixtures still owe their actors real elapsed time. This is
// not a gameplay clock override or a substitute for multiplayer expiry tests.
export function createVisualActorClock(actor, initialTimestamp) {
    if (typeof actor?.update !== 'function' || !Number.isFinite(initialTimestamp)) {
        throw new Error('A visual actor and finite initial timestamp are required');
    }
    let previous = initialTimestamp;
    return now => {
        if (!Number.isFinite(now)) throw new Error('Visual frame timestamp must be finite');
        if (now <= previous) return 0;
        const elapsed = (now - previous) / 1000;
        previous = now;
        const steps = Math.ceil(elapsed / .05);
        const step = elapsed / steps;
        for (let index = 0; index < steps; index++) actor.update(step, null, null, null);
        return elapsed;
    };
}
