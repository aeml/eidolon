import * as THREE from 'three';
import { Actor } from '../src/entities/Actor.js';
import { createProceduralFighter, createProceduralRogue, createProceduralWizard, createProceduralCleric } from '../src/art/ProceduralHumanoid.js';
import { prepareWeaponMotions } from '../src/art/AuthoredWeaponMotions.js';

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
