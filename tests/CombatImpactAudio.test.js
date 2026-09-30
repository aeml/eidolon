import { jest } from '@jest/globals';
import { AudioManager, AUDIO_CUES, playLocalDamageCue } from '../src/audio/AudioManager.js';
import { COMBAT_IMPACT_PROFILES, createCombatImpactCue } from '../src/audio/CombatImpactProfiles.js';

test('impact types have distinct bounded original signatures and quiet periodic ticks', () => {
    expect(new Set(Object.values(COMBAT_IMPACT_PROFILES).map(JSON.stringify)).size).toBe(8);
    for (const tones of Object.values(COMBAT_IMPACT_PROFILES)) {
        expect(tones.length).toBeLessThanOrEqual(2);
        for (const tone of tones) {
            expect(tone.delay + tone.duration).toBeLessThan(.16);
            expect(tone.gain).toBeGreaterThan(0); expect(tone.gain).toBeLessThanOrEqual(.065);
            expect(tone.frequency).toBeGreaterThan(20); expect(tone.endFrequency).toBeGreaterThan(20);
        }
    }
    expect(createCombatImpactCue({ periodic: true, kind: 'fire' })).toHaveLength(1);
    expect(createCombatImpactCue({ periodic: true })[0].gain).toBeLessThan(.013);
});

test('AudioManager chooses typed impacts and retains generic legacy/unknown-kind cues', () => {
    const audio = new AudioManager({ storage: { getItem: () => null } });
    try {
        for (const kind of Object.keys(COMBAT_IMPACT_PROFILES)) {
            expect(audio.createCue(AUDIO_CUES.combatHit, { kind, impact: 1 })).toEqual(COMBAT_IMPACT_PROFILES[kind]);
        }
        expect(createCombatImpactCue({ kind: 'ice', impact: 1 })).toEqual(COMBAT_IMPACT_PROFILES.cold);
        expect(createCombatImpactCue({ kind: 'reflect', impact: 1 })).toEqual(COMBAT_IMPACT_PROFILES.physical);
        expect(audio.createCue(AUDIO_CUES.combatHit, { kind: 'future-kind' })).toEqual(audio.createCue(AUDIO_CUES.combatHit));
        for (const impact of [NaN, Infinity, -1, 100]) {
            expect(createCombatImpactCue({ kind: 'fire', impact }).every(tone => Number.isFinite(tone.gain) && tone.gain > 0 && tone.gain <= .045)).toBe(true);
        }
    } finally { audio.dispose(); }
});

test('a generic authored contact cannot override typed impacts, but legacy asset routing remains', () => {
    let now = 1000;
    const audio = new AudioManager({ context: { state: 'running', currentTime: 0 }, now: () => now,
        storage: { getItem: () => null } });
    const authored = jest.spyOn(audio, 'playAuthoredCue').mockReturnValue(true);
    jest.spyOn(audio, 'ensureBusGain').mockReturnValue({});
    const tones = jest.spyOn(audio, 'playTone').mockImplementation(() => {});
    try {
        expect(audio.play(AUDIO_CUES.combatHit, { kind: 'fire', impact: 1 })).toBe(true);
        expect(authored).not.toHaveBeenCalled();
        expect(tones.mock.calls.map(call => call[3])).toEqual(COMBAT_IMPACT_PROFILES.fire);
        now += 100;
        expect(audio.play(AUDIO_CUES.combatHit)).toBe(true);
        expect(authored).toHaveBeenCalledWith(AUDIO_CUES.combatHit);
        expect(tones).toHaveBeenCalledTimes(2);
    } finally { audio.dispose(); }
});

test.each(['hero', 'enemy'])('confirmed local damage by %s carries authoritative kind without changing amount', sourceId => {
    const engine = { player: { id: 'hero' }, playAudioCue: jest.fn(() => true) };
    const damage = Object.freeze({ sourceId, targetId: sourceId === 'hero' ? 'enemy' : 'hero', amount: 40, kind: 'arcane' });
    expect(playLocalDamageCue(engine, damage)).toBe(true);
    expect(engine.playAudioCue).toHaveBeenCalledWith(AUDIO_CUES.combatHit, { kind: 'arcane', impact: .5 });
});

test.each(['bleed', 'poison', 'hazard-lava'])('%s local damage uses quiet periodic contact', sourceId => {
    const engine = { player: { id: 'hero' }, playAudioCue: jest.fn(() => true) };
    playLocalDamageCue(engine, { sourceId, targetId: 'hero', amount: 8, kind: 'fire' });
    expect(engine.playAudioCue).toHaveBeenCalledWith(AUDIO_CUES.combatHit, { kind: 'fire', impact: .1, periodic: true });
});

test.each([0, -1, NaN, Infinity, undefined])('non-hits (%s) and remote-only damage do not sound like a local hit', amount => {
    const engine = { player: { id: 'hero' }, playAudioCue: jest.fn(() => true) };
    expect(playLocalDamageCue(engine, { sourceId: 'hero', targetId: 'enemy', amount })).toBe(false);
    expect(playLocalDamageCue(engine, { sourceId: 'remote', targetId: 'enemy', amount: 50, kind: 'fire' })).toBe(false);
    expect(playLocalDamageCue(engine, null)).toBe(false);
    expect(engine.playAudioCue).not.toHaveBeenCalled();
});
