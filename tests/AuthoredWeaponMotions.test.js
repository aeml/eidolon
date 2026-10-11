import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Actor } from '../src/entities/Actor.js';
import { prepareWeaponMotions } from '../src/art/AuthoredWeaponMotions.js';

let bank;
beforeAll(async () => {
    const bytes = fs.readFileSync('assets/equipment/authored/motions/Rogue.glb');
    bank = await new GLTFLoader().parseAsync(new Uint8Array(bytes).buffer, '');
});
const weapon = profile => ({ id: profile, type: 'WEAPON', slot: 'mainHand',
    baseName: { Sword: 'Iron Sword', Dagger: 'Steel Dagger', Mace: 'Cleric Mace' }[profile] });
const serialized = clips => JSON.stringify(clips.map(c => [c.name, c.duration,
    c.tracks.map(t => [t.name, [...t.times], [...t.values]])]));
function fixture() {
    const clone = node => {
        const result = node.isScene || node.name.startsWith('socket_') ? new THREE.Group() : new THREE.Bone();
        result.name = node.name; result.position.copy(node.position); result.quaternion.copy(node.quaternion); result.scale.copy(node.scale);
        node.children.forEach(child => result.add(clone(child)));
        return result;
    };
    const root = new THREE.Group(), scene = clone(bank.scene);
    root.add(scene); root.userData.authoredClass = 'Rogue';
    root.userData.animations = bank.animations.map(clip => clip.clone());
    prepareWeaponMotions(root, scene);
    const actor = new Actor('mixed-weapon-reader', {}); actor.mesh = root;
    actor.mixer = new THREE.AnimationMixer(root);
    root.userData.animations.forEach(clip => { actor.animations[clip.name] = actor.mixer.clipAction(clip); });
    return { root, actor };
}

test.each([['Sword', 'Dagger'], ['Dagger', 'Sword'], ['Sword', 'Mace'], ['Mace', 'Sword'], ['Dagger', 'Mace'], ['Mace', 'Dagger']])(
    '%s/%s keeps each supplied hand grip through rest and locomotion without preallocating every pair', (main, off) => {
        const before = serialized(bank.animations), { root, actor } = fixture();
        const clips = root.userData.animations, originalCount = clips.length;
        const buffers = new Set(clips.flatMap(c => c.tracks.flatMap(t => [t.times.buffer, t.values.buffer])));
        root.userData.updateWeaponProfile({ mainHand: weapon(main), offHand: weapon(off) });
        expect(clips).toHaveLength(originalCount);
        for (const state of ['Idle', 'CombatIdle', 'Walk', 'Block', 'Run']) {
            const expected = `${main}_${off}_${state}_Dual`;
            expect(actor.playAnimation(state, true, true)).toBe(true);
            expect(actor.currentAction.getClip().name).toBe(expected);
            const clip = actor.currentAction.getClip(), right = clips.find(c => c.name === `${main}_${state}`);
            const left = clips.find(c => c.name === `${off}_${state}_Left`);
            expect(clip.duration).toBe(right.duration);
            expect(clip.tracks.find(t => t.name === 'hand_r.quaternion')).toBe(right.tracks.find(t => t.name === 'hand_r.quaternion'));
            expect(clip.tracks.find(t => t.name === 'hand_l.quaternion')).toBe(left.tracks.find(t => t.name === 'hand_l.quaternion'));
            expect(clip.tracks.find(t => t.name === 'index_01_l.quaternion')).toBe(left.tracks.find(t => t.name === 'index_01_l.quaternion'));
            expect(clip.tracks.every(t => buffers.has(t.times.buffer) && buffers.has(t.values.buffer))).toBe(true);
            actor.updateAnimationMixer(.2);
        }
        expect(clips).toHaveLength(originalCount + 5);
        actor.isRunning = true; expect(actor.syncMovementAnimationSpeed(6)).toBe(true);
        expect(actor.currentAction.getEffectiveTimeScale()).toBe(1);
        actor.playAnimation('Attack', false, true);
        expect(actor.currentAction.getClip().name).toBe(`${main}_Attack`);
        actor.playAnimation('Attack', false, true);
        expect(actor.currentAction.getClip().name).toBe(`${off}_Attack_Left`);
        root.userData.updateWeaponProfile({ mainHand: weapon(main), offHand: weapon(main) });
        actor.playAnimation('Idle', true, true);
        expect(actor.currentAction.getClip().name).toBe(`${main}_Idle_Dual`);
        root.userData.updateWeaponProfile({ mainHand: weapon(main), offHand: weapon(off) });
        actor.playAnimation('Run', true, true);
        expect(clips).toHaveLength(originalCount + 5);
        expect(serialized(bank.animations)).toBe(before);
        const mixer = actor.mixer;
        actor.dispose();
        expect(actor.mixer).toBeNull();
        expect(actor.animations).toEqual({});
        expect(mixer.stats.actions.total).toBe(0);
        expect(mixer.stats.bindings.total).toBe(0);
    });
