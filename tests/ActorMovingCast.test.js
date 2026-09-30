import * as THREE from 'three';
import { Actor } from '../src/entities/Actor.js';
import { createProceduralFighter, createProceduralRogue, createProceduralWizard, createProceduralCleric } from '../src/art/ProceduralHumanoid.js';

const cases = [['Fighter', createProceduralFighter, 'Guardian Roar'], ['Rogue', createProceduralRogue, 'Cloak & Vanish'],
    ['Wizard', createProceduralWizard, 'Arcane Shield'], ['Cleric', createProceduralCleric, 'Spirit Guardians']];
function make(type, factory) {
    const actor = new Actor('moving-cast', { STATS: { STRENGTH: 5, INTELLIGENCE: 5, DEXTERITY: 6, WISDOM: 5, STAMINA: 5 } });
    actor.meshType = type; actor.setMesh(factory({ batch: true }));
    actor.state = 'MOVING'; actor.targetPosition = new THREE.Vector3(100, 0, 0);
    actor.stats.speed = 6; actor.scaleAnimSpeed = true;
    actor.playAnimation('Run'); actor.update(.15, null, null, null);
    return actor;
}

test.each(cases)('%s keeps a leg stride under an uninterrupted moving cast', (type, factory, skill) => {
    const actor = make(type, factory);
    actor.playAbilityAnimation(skill, { duration: 1 });
    const action = actor.currentAction, thigh = actor.mesh.getObjectByName('Rig_ThighRight');
    const values = [];
    for (let i = 0; i < 30; i++) {
        actor.update(1 / 60, null, null, null);
        if (i > 10) values.push(thigh.rotation.x);
    }
    expect(actor.currentAction).toBe(action);
    expect(actor.currentAbilityAnimation.skillName).toBe(skill);
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(.5);
    expect(actor.position.x).toBeGreaterThan(2);
    actor.dispose();
});

test.each(cases)('%s lower-body mask leaves the cast arms, weapon and torso unchanged', (type, factory, skill) => {
    const actor = make(type, factory), baseline = make(type, factory);
    baseline.movingCastGait.dispose(); baseline.movingCastGait = null;
    actor.playAbilityAnimation(skill, { duration: 1 }); baseline.playAbilityAnimation(skill, { duration: 1 });
    for (let i = 0; i < 35; i++) {
        actor.updateAnimationMixer(1 / 60); baseline.updateAnimationMixer(1 / 60);
        for (const name of ['Rig_UpperArmRight', 'Rig_ForearmRight', 'Rig_Chest', 'Equipment_MainHand']) {
            const actual = actor.mesh.getObjectByName(name), expected = baseline.mesh.getObjectByName(name);
            expect(actual.rotation.toArray()).toEqual(expected.rotation.toArray());
            expect(actual.position.toArray()).toEqual(expected.position.toArray());
        }
    }
    expect(actor.currentAction.time).toBe(baseline.currentAction.time);
    actor.dispose(); baseline.dispose();
});

test.each(['IDLE', 'DEAD', 'JUMPING', 'root', 'stun', 'frozen', 'charge', 'whirlwind'])('moving gait stops for %s', reason => {
    const actor = make('Cleric', createProceduralCleric);
    actor.playAbilityAnimation('Spirit Guardians', { duration: 1 }); actor.updateAnimationMixer(.1);
    expect(actor.movingCastGait.active).toBe(true);
    if (['IDLE', 'DEAD', 'JUMPING'].includes(reason)) actor.state = reason;
    else if (reason === 'charge') actor.isCharging = true;
    else if (reason === 'whirlwind') actor.isWhirlwinding = true;
    else actor[`${reason === 'frozen' ? 'frozen' : reason}Timer`] = 1;
    actor.updateAnimationMixer(.1);
    expect(actor.movingCastGait.active).toBe(false);
    expect(actor.movingCastGait.saved).toHaveLength(0);
    actor.dispose();
});

test('walk/slow playback, moving-cast completion and disposal retain bounded phase and clean ownership', () => {
    const actor = make('Cleric', createProceduralCleric);
    actor.isRunning = false; actor.slowTimer = 5; actor.slowFactor = .5;
    actor.playAnimation('Walk'); actor.playAbilityAnimation('Spirit Guardians', { duration: .5 });
    actor.updateAnimationMixer(.1);
    const phase = actor.movingCastGait.time;
    actor.updateAnimationMixer(.1);
    expect(actor.movingCastGait.time - phase).toBeCloseTo(.05);
    actor.updateAnimationMixer(.31);
    expect(actor.currentAbilityAnimation).toBeNull();
    expect(actor.currentAnimationName).toBe('Walk');
    expect(actor.movingCastGait.active).toBe(false);
    const gait = actor.movingCastGait;
    actor.setMesh(createProceduralCleric({ batch: true }));
    expect(gait.actor).toBeNull(); expect(gait.cache.size).toBe(0); expect(gait.saved).toHaveLength(0);
    actor.dispose(); expect(actor.movingCastGait).toBeNull();
});

test('remote moving casts use the same stride layer without changing authoritative position', () => {
    const actor = make('Cleric', createProceduralCleric);
    actor.isRemote = true; actor.playAbilityAnimation('Spirit Guardians', { duration: 1 });
    const position = actor.position.clone(), angles = [];
    for (let i = 0; i < 25; i++) {
        actor.update(1 / 60, null, null, null);
        angles.push(actor.mesh.getObjectByName('Rig_ThighRight').rotation.x);
    }
    expect(actor.position.toArray()).toEqual(position.toArray());
    expect(Math.max(...angles) - Math.min(...angles)).toBeGreaterThan(.5);
    actor.dispose();
});

test('authored quaternion masks preserve skill arms and restore the mixer pose on disposal', () => {
    function authoredFixture() {
        const root = new THREE.Group();
        const thigh = new THREE.Bone(), arm = new THREE.Bone(), pelvis = new THREE.Bone();
        thigh.name = 'thigh_r'; arm.name = 'upperarm_r'; pelvis.name = 'pelvis';
        root.add(thigh, arm, pelvis);
        const quaternions = angles => angles.flatMap(angle => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle).toArray());
        root.userData.lowerBodyAnimationTracks = ['thigh_r.quaternion', 'pelvis.position'];
        root.userData.animations = [new THREE.AnimationClip('Idle', 1, []),
            new THREE.AnimationClip('Run', 1, [new THREE.QuaternionKeyframeTrack('thigh_r.quaternion', [0, .25, .5, .75, 1], quaternions([0, .8, 0, -.8, 0])),
                new THREE.VectorKeyframeTrack('pelvis.position', [0, .5, 1], [0, 0, 0, 0, 0, .1, 0, 0, 0])]),
            new THREE.AnimationClip('Shout', 1, [new THREE.QuaternionKeyframeTrack('upperarm_r.quaternion', [0, .5, 1], quaternions([0, -1.5, 0]))])];
        return root;
    }
    const actor = make('Fighter', authoredFixture), baseline = make('Fighter', authoredFixture);
    baseline.movingCastGait.dispose(); baseline.movingCastGait = null;
    actor.isRemote = true; baseline.isRemote = true;
    actor.playAbilityAnimation('Guardian Roar', { duration: 1 }); baseline.playAbilityAnimation('Guardian Roar', { duration: 1 });
    const initial = actor.position.clone(), values = [];
    for (let i = 0; i < 35; i++) {
        actor.updateAnimationMixer(1 / 60); baseline.updateAnimationMixer(1 / 60);
        values.push(actor.mesh.getObjectByName('thigh_r').quaternion.x);
        expect(actor.mesh.getObjectByName('upperarm_r').quaternion.toArray()).toEqual(baseline.mesh.getObjectByName('upperarm_r').quaternion.toArray());
    }
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(.3);
    expect(actor.position.toArray()).toEqual(initial.toArray());
    actor.movingCastGait.restore();
    expect(actor.movingCastGait.saved).toHaveLength(0);
    actor.dispose(); baseline.dispose();
});
