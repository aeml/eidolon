import * as THREE from 'three';
import { Actor } from '../src/entities/Actor.js';
import { createProceduralFighter, createProceduralRogue, createProceduralWizard, createProceduralCleric } from '../src/art/ProceduralHumanoid.js';

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
