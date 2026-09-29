import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Actor } from '../src/entities/Actor.js';
import { AudioManager, AUDIO_CUES } from '../src/audio/AudioManager.js';
import { ABILITY_CAST_PROFILES, getAbilityCastProfile } from '../src/audio/AbilityCastProfiles.js';
import { PLAYER_ABILITY_VISUALS, ABILITY_VISUAL_ALIASES } from '../src/skills/abilityVisualManifest.js';

test('every known class ability and alias resolves a bounded short action signature', () => {
    for (const [className, skills] of Object.entries(PLAYER_ABILITY_VISUALS)) {
        for (const name of [...Object.keys(skills), ...Object.keys(ABILITY_VISUAL_ALIASES[className])]) {
            const profile = getAbilityCastProfile(className, name);
            expect(ABILITY_CAST_PROFILES[profile]).toBeDefined();
        }
    }
    expect(getAbilityCastProfile('Wizard', 'Meteor')).toBe('fire');
    expect(getAbilityCastProfile('Wizard', 'Frost Nova')).toBe('frost');
    expect(getAbilityCastProfile('Wizard', 'Blink')).toBe('time');
    expect(getAbilityCastProfile('Wizard', 'Gravity Well')).toBe('gravity');
    expect(getAbilityCastProfile('Wizard', 'Arcane Missiles')).toBe('arcane');
    expect(getAbilityCastProfile('Wizard', 'Unknown Future Ability')).toBeNull();
    expect(new Set(Object.values(ABILITY_CAST_PROFILES).map(tones => JSON.stringify(tones))).size).toBe(14);
    for (const tones of Object.values(ABILITY_CAST_PROFILES)) {
        expect(tones.length).toBeLessThanOrEqual(2);
        for (const tone of tones) {
            expect(tone.delay + tone.duration).toBeLessThan(.35);
            expect(tone.gain).toBeGreaterThan(0); expect(tone.gain).toBeLessThanOrEqual(.075);
            expect(tone.frequency).toBeGreaterThan(20); expect(tone.endFrequency).toBeGreaterThan(20);
        }
    }
});

test('AudioManager selects skill families but retains the legacy class cue without skill metadata', () => {
    const audio = new AudioManager({ storage: { getItem: () => null } });
    expect(audio.createCue(AUDIO_CUES.wizardCast, { skillName: 'Fireball' })).toBe(ABILITY_CAST_PROFILES.fire);
    expect(audio.createCue(AUDIO_CUES.wizardCast, { skillName: 'Time Warp' })).toBe(ABILITY_CAST_PROFILES.time);
    expect(audio.createCue(AUDIO_CUES.fighterCast, { skillName: 'Shield Slam' })).toBe(ABILITY_CAST_PROFILES.guard);
    expect(audio.createCue(AUDIO_CUES.wizardCast)).toHaveLength(2);
    expect(audio.createCue(AUDIO_CUES.wizardCast, { skillName: 'Unknown' })).toEqual(audio.createCue(AUDIO_CUES.wizardCast));
    audio.dispose();
});

test.each([
    ['Fighter', 'Shield Slam', AUDIO_CUES.fighterCast],
    ['Fighter', 'Earthshaker', AUDIO_CUES.fighterCast],
    ['Rogue', 'Tripwire', AUDIO_CUES.rogueCast],
    ['Wizard', 'Fireball', AUDIO_CUES.wizardCast],
    ['Wizard', 'Time Warp', AUDIO_CUES.wizardCast],
    ['Wizard', 'Teleport', AUDIO_CUES.wizardCast],
    ['Cleric', 'Healing Light', AUDIO_CUES.clericCast]
])('%s casts play their local sound without adding remote party noise', (meshType, skill, cue) => {
    const actor = { meshType, position: new THREE.Vector3(), skillLevels: {}, stats: {} };
    const engine = { player: actor, spawnTransientEffect: jest.fn(() => true), playAudioCue: jest.fn(() => true) };
    Actor.prototype.spawnAbilityPresentation.call(actor, engine, skill, new THREE.Vector3(0, 0, 4));
    expect(engine.playAudioCue).toHaveBeenCalledWith(cue, { skillName: skill });
    engine.playAudioCue.mockClear();
    engine.player = { ...actor };
    Actor.prototype.spawnAbilityPresentation.call(actor, engine, skill, new THREE.Vector3(0, 0, 4));
    expect(engine.playAudioCue).not.toHaveBeenCalled();
    engine.player = actor;
    Actor.prototype.spawnAbilityPresentation.call(actor, engine, 'Unknown Future Ability', actor.position);
    expect(engine.playAudioCue).not.toHaveBeenCalled();
});
