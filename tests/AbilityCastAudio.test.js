import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Actor } from '../src/entities/Actor.js';
import { AUDIO_CUES } from '../src/audio/AudioManager.js';

test.each([
    ['Fighter', 'Shield Slam', AUDIO_CUES.fighterCast],
    ['Rogue', 'Tripwire', AUDIO_CUES.rogueCast],
    ['Wizard', 'Fireball', AUDIO_CUES.wizardCast],
    ['Cleric', 'Healing Light', AUDIO_CUES.clericCast]
])('%s casts play their local sound without adding remote party noise', (meshType, skill, cue) => {
    const actor = { meshType, position: new THREE.Vector3(), skillLevels: {}, stats: {} };
    const engine = { player: actor, spawnTransientEffect: jest.fn(() => true), playAudioCue: jest.fn(() => true) };
    Actor.prototype.spawnAbilityPresentation.call(actor, engine, skill, new THREE.Vector3(0, 0, 4));
    expect(engine.playAudioCue).toHaveBeenCalledWith(cue);
    engine.playAudioCue.mockClear();
    engine.player = { ...actor };
    Actor.prototype.spawnAbilityPresentation.call(actor, engine, skill, new THREE.Vector3(0, 0, 4));
    expect(engine.playAudioCue).not.toHaveBeenCalled();
    engine.player = actor;
    Actor.prototype.spawnAbilityPresentation.call(actor, engine, 'Unknown Future Ability', actor.position);
    expect(engine.playAudioCue).not.toHaveBeenCalled();
});
