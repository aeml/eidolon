import * as THREE from 'three';
import { Actor } from '../src/entities/Actor.js';
import { createProceduralFighter, createProceduralRogue, createProceduralWizard, createProceduralCleric } from '../src/art/ProceduralHumanoid.js';
import { prepareWeaponMotions } from '../src/art/AuthoredWeaponMotions.js';
import { jest } from '@jest/globals';
import { GameEngine } from '../src/core/GameEngine.js';
import { AUDIO_CUES } from '../src/audio/AudioManager.js';

const cases = [
    ['Fighter', createProceduralFighter, .5, .65],
    ['Rogue', createProceduralRogue, .26, .76],
    ['Wizard', createProceduralWizard, .62, .32],
    ['Cleric', createProceduralCleric, .58, .62]
];

test.each(cases)('%s reaches its authored contact pose at the unchanged 35%% damage time', (name, create, contactTime, chestYaw) => {
    const actor = new Actor(`contact-${name}`, {});
    actor.setMesh(create());
    try {
        for (const cooldown of [1, 1.9]) {
            actor.stats.attackSpeed = cooldown;
            actor.setAttackingState();
            const action = actor.currentAction;
            expect(contactTime / action.getEffectiveTimeScale()).toBeCloseTo(cooldown * .35, 6);
            const position = actor.position.clone();
            // Real mixer/rig sampling, not manually assigning bone transforms.
            actor.mixer.update(cooldown * .35);
            expect(actor.mesh.getObjectByName('Rig_Chest').rotation.y).toBeCloseTo(chestYaw, 4);
            expect(actor.position.equals(position)).toBe(true);
            expect(actor.state).toBe('ATTACKING');
            actor.isRemote = true;
            actor.setAttackingState();
            actor.update(.02);
            expect(contactTime / actor.currentAction.getEffectiveTimeScale()).toBeCloseTo(cooldown * .35, 6);
            actor.isRemote = false;
        }
    } finally { actor.dispose(); }
});

test('unannotated imported/enemy clips keep the existing playback fallback', () => {
    const actor = new Actor('unannotated', {});
    const mesh = new THREE.Group();
    mesh.userData.animations = [new THREE.AnimationClip('Attack', 1.2, [
        new THREE.NumberKeyframeTrack('.rotation[y]', [0, 1.2], [0, 0])
    ])];
    actor.setMesh(mesh); actor.stats.attackSpeed = 2;
    try {
        actor.setAttackingState();
        expect(actor.currentAction.getEffectiveTimeScale()).toBeCloseTo(1.2 / 1.8);
    } finally { actor.dispose(); }
});

const weaponNames = {Sword: 'Iron Sword', Dagger: 'Steel Dagger', Staff: 'Wooden Staff', Mace: 'Cleric Mace'};
function weaponRig() {
    const mesh = createProceduralFighter(); mesh.userData.authoredClass = 'Rogue';
    mesh.userData.basicAttackContactTime = 14 / 30;
    for (const profile of [...Object.keys(weaponNames), 'Unarmed']) mesh.userData.animations.push(
        new THREE.AnimationClip(`${profile}_Attack`, 1.4, [
            new THREE.NumberKeyframeTrack('Rig_Chest.rotation[y]', [0, 14 / 30, 1.4], [0, .8, 0])
        ]));
    prepareWeaponMotions(mesh, mesh); return mesh;
}
const weapon = profile => ({name: weaponNames[profile], baseName: weaponNames[profile], type: 'WEAPON', slot: 'mainHand'});

test.each([...Object.keys(weaponNames), 'Unarmed'])('%s profile reaches its reviewed contact at the unchanged 35%% damage time', profile => {
    const mesh = weaponRig(), actor = new Actor(`bank-${profile}`, {});
    mesh.userData.updateWeaponProfile(profile === 'Unarmed' ? {} : {mainHand: weapon(profile)});
    actor.setMesh(mesh);
    try {
        for (const cooldown of [.67, 1, 1.9]) {
            actor.stats.attackSpeed = cooldown; actor.setAttackingState();
            expect(actor.currentAction.getClip().name).toBe(`${profile}_Attack`);
            expect(mesh.userData.basicAttackContactTime / actor.currentAction.getEffectiveTimeScale()).toBeCloseTo(cooldown * .35, 6);
            actor.mixer.update(cooldown * .35);
            expect(mesh.getObjectByName('Rig_Chest').rotation.y).toBeCloseTo(.8, 4);
        }
    } finally { actor.dispose(); }
});

test('both alternating Rogue strikes use the same reviewed damage contact, not the inactive fallback action', () => {
    const mesh = weaponRig(), actor = new Actor('bank-dual', {});
    mesh.userData.updateWeaponProfile({mainHand: weapon('Dagger'), offHand: weapon('Sword')}); actor.setMesh(mesh);
    try {
        actor.stats.attackSpeed = 2;
        for (const name of ['Dagger_Attack', 'Sword_Attack_Left', 'Dagger_Attack', 'Sword_Attack_Left']) {
            actor.setAttackingState();
            expect(actor.currentAction.getClip().name).toBe(name);
            expect(mesh.userData.basicAttackContactTime / actor.currentAction.getEffectiveTimeScale()).toBeCloseTo(.7, 6);
        }
    } finally { actor.dispose(); }
});

test.each(cases)('%s confirmed impact preserves the running strike and its recovery timer', (name, create) => {
    const actor = new Actor(`impact-${name}`, {});
    actor.meshType = name;
    actor.isRemote = true;
    actor.setMesh(create());
    const engine = Object.assign(Object.create(GameEngine.prototype), {
        player: { id: 'hero', position: new THREE.Vector3(0, 0, 4) },
        remotePlayers: new Map([[actor.id, actor]]),
        floatingTextManager: { spawn: jest.fn() },
        renderCombatFeedback: jest.fn(),
        playAudioCue: jest.fn()
    });
    try {
        actor.setAttackingState();
        actor.updateAnimationMixer(.35);
        const action = actor.currentAction, time = action.time, timer = actor.attackTimer;
        const chest = actor.mesh.getObjectByName('Rig_Chest').quaternion.clone();
        engine.handleServerMessage({ type: 'damage', payload: {
            sourceId: actor.id, targetId: 'hero', amount: 40, kind: 'physical'
        } });
        expect(actor.currentAction === action).toBe(true);
        expect(action.time).toBe(time);
        expect(actor.attackTimer).toBe(timer);
        expect(actor.mesh.getObjectByName('Rig_Chest').quaternion.equals(chest)).toBe(true);
        actor.updateAnimationMixer(.02);
        expect(action.time).toBeGreaterThan(time);
        expect(engine.floatingTextManager.spawn).toHaveBeenCalled();
        expect(engine.renderCombatFeedback).toHaveBeenCalled();
        expect(engine.playAudioCue).toHaveBeenCalledWith(AUDIO_CUES.combatHit, { impact: .5, kind: 'physical' });
    } finally { actor.dispose(); }
});

test.each([
    ['Fighter', createProceduralFighter, 'Whirlwind'],
    ['Rogue', createProceduralRogue, 'Piercing Throw'],
    ['Wizard', createProceduralWizard, 'Fireball'],
    ['Cleric', createProceduralCleric, 'Radiant Strike']
])('%s delayed/periodic damage leaves its current ability animation intact', (name, create, skillName) => {
    const actor = new Actor(`cast-impact-${name}`, {});
    actor.meshType = name;
    actor.isRemote = true;
    actor.setMesh(create());
    const engine = Object.assign(Object.create(GameEngine.prototype), {
        player: { id: 'hero', position: new THREE.Vector3(0, 0, 4) },
        remotePlayers: new Map([[actor.id, actor]]),
        floatingTextManager: { spawn: jest.fn() }, renderCombatFeedback: jest.fn(), playAudioCue: jest.fn()
    });
    try {
        expect(actor.playAbilityAnimation(skillName)).toBe(true);
        actor.updateAnimationMixer(.1);
        const action = actor.currentAction, time = action.time, ability = actor.currentAbilityAnimation;
        for (const kind of ['physical', 'fire', 'arcane', 'holy', 'poison', 'bleed']) {
            engine.handleServerMessage({ type: 'damage', payload: {
                sourceId: actor.id, targetId: 'hero', amount: 8, kind
            } });
            expect(actor.currentAction === action).toBe(true);
            expect(action.time).toBe(time);
            expect(actor.currentAbilityAnimation === ability).toBe(true);
        }
        actor.updateAnimationMixer(.02);
        expect(action.time).toBeGreaterThan(time);
    } finally { actor.dispose(); }
});
