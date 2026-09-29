import * as THREE from 'three';
import { Actor } from '../src/entities/Actor.js';
import { createProceduralFighter, createProceduralRogue, createProceduralWizard, createProceduralCleric } from '../src/art/ProceduralHumanoid.js';
import { HUMANOID_ABILITY_CLIPS } from '../src/art/HumanoidAbilityClips.js';
import { getAbilityAnimationProfile } from '../src/skills/abilityVisualManifest.js';

test.each([['Fighter', createProceduralFighter], ['Rogue', createProceduralRogue],
    ['Wizard', createProceduralWizard], ['Cleric', createProceduralCleric]])('%s support gestures bind to its own resting rig without moving the root or feet', (_type, factory) => {
    const root = factory({ batch: true }), mixer = new THREE.AnimationMixer(root);
    const poses = [];
    for (const name of HUMANOID_ABILITY_CLIPS) {
        const clip = root.userData.animations.find(clip => clip.name === name);
        expect(clip.duration).toBe(1);
        for (const track of clip.tracks) {
            const binding = THREE.PropertyBinding.parseTrackName(track.name);
            const pivot = root.getObjectByName(binding.nodeName);
            expect(pivot).toBeTruthy();
            expect(binding.nodeName).not.toMatch(/Root|Hip|Thigh|Shin|Foot|Equipment/);
            expect(binding.propertyName).toBe('rotation');
            expect(track.values[0]).toBeCloseTo(pivot.rotation[binding.propertyIndex]);
            expect(track.values.at(-1)).toBeCloseTo(track.values[0]);
            expect(Array.from(track.values).every(Number.isFinite)).toBe(true);
        }
        mixer.clipAction(clip).play(); mixer.update(.5);
        poses.push(['Rig_UpperArmLeft', 'Rig_UpperArmRight', 'Rig_Chest'].flatMap(name => root.getObjectByName(name).rotation.toArray().slice(0,3)));
        mixer.stopAllAction(); root.userData.resetPose();
    }
    expect(new Set(poses.map(pose => JSON.stringify(pose))).size).toBe(5);
    mixer.uncacheRoot(root);
});

test.each([
    ['Wizard', createProceduralWizard, 'Fireball', 'Cast', .7],
    ['Wizard', createProceduralWizard, 'Gravity Well', 'Channel', 1.05],
    ['Fighter', createProceduralFighter, 'Guardian Roar', 'Shout', .88],
    ['Fighter', createProceduralFighter, 'Iron Fortress', 'Guard', .78],
    ['Cleric', createProceduralCleric, 'Blessing of Resolve', 'Bless', .82]
])('%s %s selects its intended gesture at unchanged duration', (type, factory, skill, name, duration) => {
    const actor = new Actor('gesture', {}); actor.meshType = type; actor.setMesh(factory());
    actor.playAbilityAnimation(skill);
    expect(actor.currentAnimationName).toBe(name);
    expect(actor.currentAbilityAnimation.duration).toBe(duration);
    expect(actor.currentAction.getEffectiveTimeScale()).toBeCloseTo(1 / duration);
    expect(getAbilityAnimationProfile(type, skill).duration).toBe(duration);
    actor.dispose();
});
