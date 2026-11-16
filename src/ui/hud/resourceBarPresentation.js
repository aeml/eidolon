// Presentation only: never repair or grant resources on the actor itself.
// Zero is real state, not a request for a default full bar.
export function resourceBarPresentation(value, maximum, round = Math.floor) {
    const cap = Number.isFinite(maximum) ? Math.max(0, maximum) : 0;
    const current = Number.isFinite(value) ? Math.min(cap, Math.max(0, value)) : 0;
    return {
        width: `${cap > 0 ? current / cap * 100 : 0}%`,
        text: `${round(current)} / ${cap}`
    };
}
