import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Actor } from '../src/entities/Actor.js';
import { prepareAuthoredSkillMotions } from '../src/art/AuthoredSkillMotions.js';

const banks = new Map();
const classes = ['Fighter', 'Rogue', 'Wizard', 'Cleric'];
const profiles = ['Sword', 'Dagger', 'Staff', 'Mace', 'Unarmed'];
beforeAll(async () => {
    for (const type of classes) {
        const bytes = fs.readFileSync(`assets/equipment/authored/motions/${type}.glb`);
        banks.set(type, await new GLTFLoader().parseAsync(new Uint8Array(bytes).buffer, ''));
    }
});
function fixture(type) {
    const source = banks.get(type), root = new THREE.Group();
    // The motion-only GLBs have no skins, so GLTFLoader creates Object3Ds.
    // Rebuild their exact joint hierarchy as bones, as the body GLBs do.
    const cloneRig = node => {
        const clone = node.isScene || node.name.startsWith('socket_') ? new THREE.Group() : new THREE.Bone();
        clone.name = node.name; clone.position.copy(node.position); clone.quaternion.copy(node.quaternion); clone.scale.copy(node.scale);
        for (const child of node.children) clone.add(cloneRig(child));
        return clone;
    };
    const scene = cloneRig(source.scene);
    root.add(scene);
    root.userData.animations = source.animations.map(clip => clip.clone());
    root.userData.authoredClass = type;
    root.userData.weaponProfile = profiles[0];
    return { source, scene, root };
}
const pose = scene => {
    const values = [];
    scene.traverse(part => values.push(...part.position.toArray(), ...part.quaternion.toArray(), ...part.scale.toArray()));
    return values;
};
const clipData = clips => JSON.stringify(clips.map(clip => [clip.name, clip.duration,
    clip.tracks.map(track => [track.name, [...track.times], [...track.values]])]));

test.each(classes)('%s adds bounded equipped motions while preserving supplied clips and initial pose', type => {
    const { source, scene, root } = fixture(type);
    const original = clipData(root.userData.animations), sourceData = clipData(source.animations), before = pose(scene);
    const count = root.userData.animations.length;
    expect(prepareAuthoredSkillMotions(root, scene)).toBe(type !== 'Wizard');
    expect(clipData(root.userData.animations.slice(0, count))).toBe(original);
    expect(clipData(source.animations)).toBe(sourceData);
    expect(pose(scene)).toEqual(before);
    if (type === 'Wizard') {
        expect(root.userData.authoredSkillMotions).toBeUndefined();
        expect(root.userData.animations).toHaveLength(count);
        return;
    }
    expect(root.userData.authoredSkillMotions.clips).toBe({ Fighter: 20, Rogue: 10, Cleric: 5 }[type]);
    expect(root.userData.authoredSkillMotions.keyframeBytes).toBeLessThan(100_000);
    for (const profile of profiles) for (const family of root.userData.authoredSkillMotions.families) {
        const clip = root.userData.animations.find(clip => clip.name === `${profile}_Skill${family}`);
        expect(clip.duration).toBe(1);
        expect(clip.tracks.every(track => [...track.values, ...track.times].every(Number.isFinite))).toBe(true);
    }
    // The equipped hand/finger and lower-body stance are retained, not
    // replaced with a generic weapon grip or translated gameplay root.
    const [a, b] = root.userData.authoredSkillMotions.families.map(family => root.userData.animations.find(clip => clip.name === `Sword_Skill${family}`));
    const finger = a.tracks.find(track => track.name === 'index_01_r.quaternion');
    if (b) expect(b.tracks.find(track => track.name === finger.name)).toBe(finger);
    expect(a.tracks.find(track => track.name === 'Root.position').values[0]).toBeCloseTo(0);
});

test.each(['Fighter', 'Rogue'])('%s spin completes a continuous full turn and returns to its equipped stance', type => {
    const { scene, root } = fixture(type);
    prepareAuthoredSkillMotions(root, scene);
    root.rotation.y = .7;
    const meshHeading = root.quaternion.clone(), position = root.position.clone();
    const mixer = new THREE.AnimationMixer(root);
    mixer.clipAction(root.userData.animations.find(clip => clip.name === 'Sword_Attack')).play();
    mixer.setTime(14 / 30);
    const contact = ['clavicle_r', 'upperarm_r', 'lowerarm_r', 'hand_r'].map(name => [name, scene.getObjectByName(name).quaternion.clone()]);
    mixer.stopAllAction();
    const clip = root.userData.animations.find(clip => clip.name === 'Sword_SkillSpin');
    const action = mixer.clipAction(clip).setLoop(THREE.LoopOnce).play(); action.clampWhenFinished = true;
    mixer.setTime(.5);
    for (const [name, rotation] of contact) expect(scene.getObjectByName(name).quaternion.clone().normalize().angleTo(rotation.clone().normalize())).toBeLessThan(1e-5);
    const bone = scene.getObjectByName('Root');
    mixer.setTime(0); root.updateMatrixWorld(true);
    const base = bone.getWorldQuaternion(new THREE.Quaternion()), direction = new THREE.Vector3();
    let previous = 0, total = 0;
    for (let frame = 1; frame <= 60; frame++) {
        mixer.setTime(frame / 60); root.updateMatrixWorld(true);
        const delta = bone.getWorldQuaternion(new THREE.Quaternion()).multiply(base.clone().invert());
        direction.set(0, 0, 1).applyQuaternion(delta);
        const yaw = Math.atan2(direction.x, direction.z);
        const step = Math.atan2(Math.sin(yaw - previous), Math.cos(yaw - previous));
        expect(Math.abs(step)).toBeLessThan(.3);
        total += step; previous = yaw;
    }
    expect(total).toBeCloseTo(Math.PI * 2, 5);
    expect(bone.getWorldQuaternion(new THREE.Quaternion()).angleTo(base)).toBeLessThan(1e-5);
    expect(root.quaternion.equals(meshHeading)).toBe(true);
    expect(root.position.equals(position)).toBe(true);
    mixer.stopAllAction(); mixer.uncacheRoot(root);
});

test.each([
    ['Fighter', 'Shield Slam', 'ShieldBash', .82], ['Fighter', 'Earthshaker', 'Heavy', .82], ['Fighter', 'Sweeping Strike', 'Sweep', .72],
    ['Fighter', 'Whirlwind', 'Spin', 1], ['Rogue', 'Death Spiral', 'Spin', .9],
    ['Rogue', 'Piercing Throw', 'Throw', .52], ['Rogue', 'Phantom Volley', 'Throw', .68],
    ['Cleric', 'Radiant Strike', 'Heavy', .82]
])('%s %s selects its equipped motion without changing the cast duration', (type, skill, family, duration) => {
    const { root, scene } = fixture(type); prepareAuthoredSkillMotions(root, scene);
    const actor = new Actor('equipped-skill', {}); actor.meshType = type; actor.setMesh(root);
    actor.isRemote = true; actor.stats.attackSpeed = 1.7;
    try {
        for (const profile of profiles) {
            root.userData.weaponProfile = profile;
            actor.state = 'ATTACKING';
            expect(actor.playAbilityAnimation(skill)).toBe(true);
            expect(actor.currentAction.getClip().name).toBe(`${profile}_Skill${family}`);
            expect(actor.currentAction.getEffectiveTimeScale()).toBeCloseTo(1 / duration);
            actor.update(.02);
            expect(actor.currentAction.getEffectiveTimeScale()).toBeCloseTo(1 / duration);
        }
        actor.skillRunes = { Whirlwind: 'whirlwind_extended' };
        if (skill === 'Whirlwind') {
            actor.playAbilityAnimation(skill);
            actor.update(.02);
            expect(actor.currentAction.getEffectiveTimeScale()).toBe(.5);
        }
        actor.playAbilityAnimation(skill, { clip: 'Attack', duration: .4 });
        expect(actor.currentAction.getClip().name).toBe('Attack');
        actor.playAbilityAnimation('Unknown Future Ability');
        expect(actor.currentAction.getClip().name).toBe('Attack');
    } finally { actor.dispose(); }
});

test('unreviewed rigs retain their existing animation fallback', () => {
    const root = new THREE.Group(); root.userData.animations = [];
    expect(prepareAuthoredSkillMotions(root, root)).toBe(false);
    expect(root.userData.resolveAbilityAnimationName).toBeUndefined();
});

test('Wizard keeps its delivered casting clips without allocating unused melee motions', () => {
    const { root, scene } = fixture('Wizard');
    expect(prepareAuthoredSkillMotions(root, scene)).toBe(false);
    const actor = new Actor('wizard-cast', {}); actor.meshType = 'Wizard'; actor.setMesh(root);
    try {
        actor.playAbilityAnimation('Fireball'); expect(actor.currentAction.getClip().name).toBe('Cast');
        actor.playAbilityAnimation('Scorch Beam'); expect(actor.currentAction.getClip().name).toBe('Channel');
        for (const [skill, duration] of [['Flame Whip', .72], ['Arcane Missiles', .68]]) {
            actor.playAbilityAnimation(skill); expect(actor.currentAction.getClip().name).toBe('Cast');
            expect(actor.currentAbilityAnimation.duration).toBe(duration);
        }
    } finally { actor.dispose(); }
});
