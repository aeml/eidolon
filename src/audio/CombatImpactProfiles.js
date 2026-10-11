const tone = (frequency, endFrequency, duration, gain, type = 'sine', delay = 0) =>
    Object.freeze({ frequency, endFrequency, duration, gain, type, delay });
const profile = (...tones) => Object.freeze(tones);
const noise = (frequency, endFrequency, duration, gain, filterType, q, delay = 0) =>
    Object.freeze({ ...tone(frequency, endFrequency, duration, gain, 'noise', delay), filterType, q });

// Original synthesized contact accents, not cast/charge announcements. Short
// envelopes leave room for positional danger; no downloaded/licensed recordings.
export const COMBAT_IMPACT_PROFILES = Object.freeze({
    physical: profile(tone(210, 95, .065, .065, 'triangle'), noise(1800, 450, .075, .035, 'bandpass', .7, .012)),
    fire: profile(tone(90, 45, .1, .035), noise(6200, 900, .1, .045, 'lowpass', .5, .006)),
    cold: profile(tone(1540, 880, .04, .045), noise(5100, 2000, .075, .045, 'bandpass', 1.2, .006)),
    lightning: profile(tone(1800, 420, .045, .025, 'sawtooth'), noise(6400, 1200, .08, .045, 'highpass', .7, .004)),
    arcane: profile(tone(540, 270, .11, .04), tone(1080, 540, .07, .025, 'sine', .015)),
    holy: profile(tone(784, 523, .11, .035), tone(392, 196, .1, .035, 'sine', .012)),
    shadow: profile(tone(170, 50, .14, .045), noise(900, 140, .09, .02, 'lowpass', .6, .01)),
    periodic: profile(tone(95, 65, .045, .012))
});

export function createCombatImpactCue({ kind, impact = .5, periodic = false } = {}) {
    const name = periodic ? 'periodic' : ({ frost: 'cold', ice: 'cold', reflect: 'physical' }[kind] || kind);
    if (!Object.hasOwn(COMBAT_IMPACT_PROFILES, name)) return null;
    const strength = Number.isFinite(Number(impact)) ? Math.max(0, Math.min(1, Number(impact))) : .5;
    return COMBAT_IMPACT_PROFILES[name].map(tone => ({ ...tone, gain: tone.gain * (.7 + strength * .3) }));
}
