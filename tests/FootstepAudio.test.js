import { jest } from '@jest/globals';
import { FootstepAudio, FOOTSTEP_CUE, createFootstepCue } from '../src/audio/FootstepAudio.js';
import { AudioManager, AUDIO_CUES } from '../src/audio/AudioManager.js';
import * as THREE from 'three';
import { Actor } from '../src/entities/Actor.js';
import { createProceduralFighter, createProceduralRogue, createProceduralWizard, createProceduralCleric } from '../src/art/ProceduralHumanoid.js';

function fixture(animated = true) {
    const audio = { play: jest.fn(() => true) }, tracker = new FootstepAudio(audio);
    const action = { time: 0, getClip: () => ({ duration: 1 }) };
    const actor = { position: { x: 0, z: 0 }, state: 'MOVING',
        currentAction: animated ? action : null, currentAnimationName: animated ? 'Sword_Run' : '' };
    const engine = { player: actor, currentInstanceId: '', currentInstanceType: '' };
    const tick = (phase, distance = .2, dt = .1) => {
        action.time = phase; actor.position.x += distance; return tracker.update(engine, dt);
    };
    tracker.update(engine, .1);
    return { audio, tracker, actor, engine, action, tick };
}

test('moving contacts follow the locomotion half-cycle and wrap without audio between footfalls', () => {
    const { tick, audio } = fixture();
    expect(tick(.2)).toBe(false); expect(tick(.4)).toBe(false);
    expect(tick(.6)).toBe(true); expect(tick(.8)).toBe(false); expect(tick(0)).toBe(true);
    expect(audio.play.mock.calls).toEqual([
        [FOOTSTEP_CUE, { surface: 'earth', sequence: 0 }],
        [FOOTSTEP_CUE, { surface: 'earth', sequence: 1 }]
    ]);
});

test('held movement against a wall, idle and resumed movement never catch up footsteps', () => {
    const { tick, audio, actor } = fixture();
    tick(.3); tick(.6);
    for (const phase of [.8, 0, .3, .6, .9]) expect(tick(phase, 0)).toBe(false);
    actor.state = 'IDLE'; expect(tick(.1, 1)).toBe(false); actor.state = 'MOVING';
    expect(tick(.3)).toBe(false); expect(tick(.6)).toBe(true);
    expect(audio.play).toHaveBeenCalledTimes(2);
});

test.each(['stunTimer', 'rootTimer', 'frozenTimer', 'teleportPhaseTimer', 'isCharging', 'isWhirlwinding', 'jumpVisualState', 'jumpLandingVisual'])('%s suppresses movement contact and clears the old cadence', field => {
    const { tick, audio, actor } = fixture();
    tick(.3); actor[field] = 1;
    expect(tick(.6)).toBe(false); actor[field] = null;
    expect(tick(.8)).toBe(false); expect(tick(.1)).toBe(true);
    expect(audio.play).toHaveBeenCalledTimes(1);
});

test('spawn, instance arrival, actor replacement, jump and large corrections remain silent', () => {
    const { tick, tracker, engine, actor, audio } = fixture();
    expect(tick(.3, 100)).toBe(false); expect(tick(.6)).toBe(false);
    engine.currentInstanceId = 'run-2'; expect(tick(.9, 1)).toBe(false);
    engine.playerJumpState = {}; expect(tick(.1)).toBe(false); engine.playerJumpState = null;
    engine.player = { ...actor, position: { ...actor.position } };
    expect(tracker.update(engine, .1)).toBe(false);
    expect(audio.play).not.toHaveBeenCalled();
});

test('moving casts follow their lower-body clock rather than the casting action', () => {
    const { tick, actor, action, audio } = fixture();
    actor.movingCastGait = { active: true, name: 'Run', time: .1 };
    actor.animations = { Run: action }; actor.currentAnimationName = 'Cast';
    tick(.7); actor.movingCastGait.time = .3; tick(.8);
    actor.movingCastGait.time = .6; expect(tick(.9)).toBe(true);
    expect(audio.play).toHaveBeenCalledTimes(1);
});

test.each([
    ['Fighter', createProceduralFighter, 'Guardian Roar'],
    ['Rogue', createProceduralRogue, 'Cloak & Vanish'],
    ['Wizard', createProceduralWizard, 'Arcane Shield'],
    ['Cleric', createProceduralCleric, 'Spirit Guardians']
])('%s real moving-cast stride produces contacts without changing the actor or cast', (type, factory, skill) => {
    const make = () => {
        const actor = new Actor('audio-moving-cast', { STATS: {
            STRENGTH: 5, INTELLIGENCE: 5, DEXTERITY: 6, WISDOM: 5, STAMINA: 5
        } });
        actor.meshType = type; actor.setMesh(factory({ batch: true }));
        actor.state = 'MOVING'; actor.targetPosition = new THREE.Vector3(100, 0, 0);
        actor.stats.speed = 6; actor.scaleAnimSpeed = true;
        actor.playAnimation('Run'); actor.update(.15, null, null, null);
        actor.playAbilityAnimation(skill, { duration: 1 });
        return actor;
    };
    const actor = make(), baseline = make(), contacts = [], thighAngles = [];
    let elapsed = 0;
    const tracker = new FootstepAudio({ play: jest.fn(() => { contacts.push(elapsed); return true; }) });
    const engine = { player: actor, currentInstanceId: 'audio-room', currentInstanceType: 'verdant_bastion_catacombs' };
    const action = actor.currentAction;
    try {
        tracker.update(engine, 1 / 60);
        for (let frame = 0; frame < 45; frame++) {
            elapsed += 1 / 60;
            actor.update(1 / 60, null, null, null); baseline.update(1 / 60, null, null, null);
            tracker.update(engine, 1 / 60);
            expect(actor.currentAction).toBe(action);
            expect(actor.currentAbilityAnimation.skillName).toBe(skill);
            expect(actor.movingCastGait.active).toBe(true);
            expect(actor.position.toArray()).toEqual(baseline.position.toArray());
            expect(actor.currentAction.time).toBe(baseline.currentAction.time);
            for (const name of ['Rig_ThighRight', 'Rig_UpperArmRight', 'Rig_Chest', 'Equipment_MainHand']) {
                const actual = actor.mesh.getObjectByName(name), expected = baseline.mesh.getObjectByName(name);
                expect(actual.rotation.toArray()).toEqual(expected.rotation.toArray());
                expect(actual.position.toArray()).toEqual(expected.position.toArray());
            }
            thighAngles.push(actor.mesh.getObjectByName('Rig_ThighRight').rotation.x);
        }
        expect(actor.position.x).toBeGreaterThan(4);
        expect(Math.max(...thighAngles) - Math.min(...thighAngles)).toBeGreaterThan(.5);
        expect(contacts.length).toBeGreaterThan(0);
        expect(contacts.length).toBeLessThanOrEqual(4);
        for (let index = 1; index < contacts.length; index++) {
            expect(contacts[index] - contacts[index - 1]).toBeGreaterThanOrEqual(.16);
        }
    } finally { tracker.reset(); actor.dispose(); baseline.dispose(); }
});

test('procedural fallback uses actual distance and all paths produce at most one contact per update', () => {
    const { tick, audio } = fixture(false);
    for (let i = 0; i < 20; i++) tick(0, .5, .1);
    expect(audio.play).toHaveBeenCalledTimes(3);
    expect(tick(0, 2.9, .25)).toBe(true);
    expect(audio.play).toHaveBeenCalledTimes(4);
    expect(tick(0, 1, 2)).toBe(false);
});

test('declined or muted cues never queue and destruction releases the tracked actor', () => {
    const { tick, audio, tracker, actor, engine } = fixture(false);
    audio.play.mockReturnValue(false);
    for (let i = 0; i < 6; i++) tick(0, .5, .1);
    expect(audio.play).toHaveBeenCalledTimes(1);
    audio.play.mockReturnValue(true); expect(tick(0, .1)).toBe(false);
    engine.isDestroyed = true; expect(tracker.update(engine, .1)).toBe(false);
    expect(tracker.actor).toBeNull();
    engine.isDestroyed = false; actor.position.x += 100;
    expect(tracker.update(engine, .1)).toBe(false);
    expect(audio.play).toHaveBeenCalledTimes(1);
});

test.each(['stone', 'earth', 'ice', 'ash', 'gravel'])('%s contacts are distinct quiet finite noise and thud cues', surface => {
    const cue = createFootstepCue({ surface, sequence: 1 });
    expect(cue).toHaveLength(2); expect(cue[0].type).toBe('noise');
    for (const tone of cue) {
        expect(tone.gain).toBeGreaterThan(0); expect(tone.gain).toBeLessThan(.025);
        expect(tone.frequency).toBeGreaterThan(20); expect(tone.endFrequency).toBeGreaterThan(20);
        expect(tone.duration).toBeLessThan(.1);
    }
    expect(createFootstepCue({ surface, sequence: NaN })).toEqual(createFootstepCue({ surface }));
    expect(createFootstepCue({ surface, sequence: 0 })).not.toEqual(cue);
});

test('AudioManager routes footsteps through ordinary effects and existing mute controls', () => {
    const audio = new AudioManager({ storage: { getItem: () => null } });
    try {
        expect(audio.createCue(AUDIO_CUES.footstep, { surface: 'ice' })).toEqual(createFootstepCue({ surface: 'ice' }));
        expect(audio.getCueBus(AUDIO_CUES.footstep)).toBe(audio.getCueBus(AUDIO_CUES.jumpLand));
        audio.setEnabled(false); expect(audio.play(AUDIO_CUES.footstep)).toBe(false);
        audio.setEnabled(true); audio.setVolume(0); expect(audio.play(AUDIO_CUES.footstep)).toBe(false);
        expect(audio.context).toBeNull(); expect(audio.activeTones.size).toBe(0);
    } finally { audio.dispose(); }
    expect(audio.footsteps.actor).toBeNull();
});


test.each(['playerJumpState', 'playerCorrectionVisualState', 'localRoofFallActive'])('%s prevents airborne or corrected motion from sounding like walking', field => {
    const { tick, audio, engine } = fixture();
    tick(.3); engine[field] = {};
    expect(tick(.6)).toBe(false); expect(audio.play).not.toHaveBeenCalled();
});
