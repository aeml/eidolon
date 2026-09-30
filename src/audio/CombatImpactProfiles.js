const tone = (frequency, endFrequency, duration, gain, type = 'sine', delay = 0) =>
    Object.freeze({ frequency, endFrequency, duration, gain, type, delay });
const profile = (...tones) => Object.freeze(tones);

// Original synthesized contact accents, not cast/charge announcements. Short
// envelopes leave room for positional danger; no downloaded/licensed recordings.
export const COMBAT_IMPACT_PROFILES = Object.freeze({
    physical: profile(tone(210, 95, .065, .065, 'triangle'), tone(82, 55, .075, .035, 'sine', .012)),
    fire: profile(tone(180, 55, .11, .045, 'sawtooth'), tone(90, 45, .1, .035, 'sine', .01)),
    cold: profile(tone(1540, 880, .04, .025), tone(680, 310, .075, .035, 'triangle', .012)),
    lightning: profile(tone(1800, 420, .045, .025, 'sawtooth'), tone(110, 55, .09, .045, 'sine', .008)),
    arcane: profile(tone(540, 270, .11, .04), tone(1080, 540, .07, .025, 'sine', .015)),
    holy: profile(tone(784, 523, .11, .035), tone(392, 196, .1, .035, 'sine', .012)),
    shadow: profile(tone(170, 50, .14, .045), tone(420, 110, .09, .02, 'triangle', .01)),
    periodic: profile(tone(95, 65, .045, .012))
});

export function createCombatImpactCue({ kind, impact = .5, periodic = false } = {}) {
    const name = periodic ? 'periodic' : ({ frost: 'cold', ice: 'cold', reflect: 'physical' }[kind] || kind);
    if (!Object.hasOwn(COMBAT_IMPACT_PROFILES, name)) return null;
    const strength = Number.isFinite(Number(impact)) ? Math.max(0, Math.min(1, Number(impact))) : .5;
    return COMBAT_IMPACT_PROFILES[name].map(tone => ({ ...tone, gain: tone.gain * (.7 + strength * .3) }));
}
