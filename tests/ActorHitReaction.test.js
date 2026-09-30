import * as THREE from 'three';
import { jest } from '@jest/globals';
import { Actor } from '../src/entities/Actor.js';
import { ActorHitReaction } from '../src/entities/ActorHitReaction.js';
import { createProceduralFighter } from '../src/art/ProceduralHumanoid.js';
import { createProceduralSkeleton } from '../src/art/ProceduralLegacyEnemies.js';

function fixture(factory = createProceduralSkeleton) {
    const actor = new Actor('hit-review', {});
    actor.setMesh(factory());
    actor.isRemote = true;
    const reaction = new ActorHitReaction(actor);
    actor.hitReaction = reaction;
    return { actor, reaction, source: new THREE.Vector3(-5, 0, 0) };
}

describe('directional body impact presentation', () => {
    test('authored rigs recoil as a whole without separating skeleton and skin siblings', () => {
        const mesh = new THREE.Group(), visual = new THREE.Group(), rig = new THREE.Group(), skin = new THREE.Group();
        visual.name = 'FighterVisualRig';
        visual.add(rig, skin); mesh.add(visual);
        mesh.userData.hitReactionRig = visual.name;
        mesh.userData.bounds = { height: 4.5 };
        const actor = { mesh, position: new THREE.Vector3(), rotation: new THREE.Quaternion(), stats: { hp: 100, maxHp: 100 }, state: 'IDLE' };
        const reaction = new ActorHitReaction(actor);
        expect(reaction.rig).toBe(visual);
        expect(reaction.play(new THREE.Vector3(-5, 0, 0), 25)).toBe(true);
        reaction.update(.045);
        expect(visual.parent).toBe(reaction.pivot);
        expect(rig.parent).toBe(visual); expect(skin.parent).toBe(visual);
        expect(mesh.quaternion.toArray()).toEqual([0, 0, 0, 1]);
        reaction.dispose();
        expect(visual.parent).toBe(mesh);
        expect(mesh.getObjectByName('ActorHitReactionPivot')).toBeUndefined();
    });

    test.each([createProceduralSkeleton, createProceduralFighter])('composes with animation without moving gameplay bounds (%p)', factory => {
        const { actor, reaction, source } = fixture(factory);
        const box = actor.mesh.getObjectByName('ActorInteractionHitbox');
        const initialBox = box.matrix.clone(), initialPosition = actor.position.clone();
        actor.state = 'ATTACKING';
        actor.playAnimation('Attack', false);
        const action = actor.currentAction;
        expect(reaction.play(source, 25)).toBe(true);
        actor.update(.045);
        expect(reaction.pivot.rotation.z).toBeLessThan(0);
        expect(actor.position).toEqual(initialPosition);
        expect(actor.rotation).toEqual(new THREE.Quaternion());
        expect(box.parent).toBe(actor.mesh);
        expect(box.matrix).toEqual(initialBox);
        expect(actor.currentAction === action).toBe(true);
        expect(action.time).toBeGreaterThan(0);
        actor.update(.3);
        expect(reaction.pivot.quaternion.toArray()).toEqual([0, 0, 0, 1]);
        actor.dispose();
    });

    test('direction follows the source even when the actor faces another way', () => {
        const { actor, reaction, source } = fixture();
        actor.rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
        expect(reaction.play(source, 20)).toBe(true);
        reaction.update(.045);
        const tippedUp = new THREE.Vector3(0, 1, 0).applyQuaternion(reaction.pivot.quaternion).applyQuaternion(actor.rotation);
        expect(tippedUp.x).toBeGreaterThan(.02);
        expect(Math.abs(tippedUp.z)).toBeLessThan(.001);
        actor.dispose();
    });

    test('one bounded recoil per burst; larger rigs resist impact', () => {
        const { actor, reaction, source } = fixture();
        reaction.play(source, 1e6); reaction.update(.045);
        const angle = reaction.pivot.quaternion.angleTo(new THREE.Quaternion());
        expect(angle).toBeLessThanOrEqual(.101);
        expect(reaction.play(source.clone().negate(), 100)).toBe(false);
        reaction.update(.3);
        actor.mesh.userData.proceduralBossFamily = 'test';
        reaction.play(source, 1e6); reaction.update(.045);
        expect(reaction.pivot.quaternion.angleTo(new THREE.Quaternion())).toBeCloseTo(angle * .3);
        actor.dispose();
    });

    test.each([0, -1, NaN, Infinity])('ignores invalid damage %p', amount => {
        const { actor, reaction, source } = fixture();
        expect(reaction.play(source, amount)).toBe(false);
        actor.dispose();
    });

    test('dead actors, unknown rigs and missing directions remain untouched', () => {
        const { actor, reaction, source } = fixture();
        expect(reaction.play(null, 20)).toBe(false);
        expect(reaction.play(actor.position, 20)).toBe(false);
        expect(reaction.play(new THREE.Vector3(NaN, 0, 0), 20)).toBe(false);
        actor.state = 'DEAD';
        expect(reaction.play(source, 20)).toBe(false);
        actor.setMesh(new THREE.Group());
        expect(actor.playHitReaction(source, 20)).toBe(false);
        actor.dispose();
    });

    test('death and reduced motion immediately cancel recoil; stun still lets it finish', () => {
        const { actor, reaction, source } = fixture();
        reaction.play(source, 20); reaction.update(.045);
        actor.state = 'DEAD'; reaction.update(0);
        expect(reaction.pivot.quaternion.toArray()).toEqual([0, 0, 0, 1]);
        actor.state = 'IDLE';
        reaction.motionPreference = { matches: true };
        expect(reaction.play(source, 20)).toBe(false);
        reaction.motionPreference.matches = false;
        reaction.play(source, 20); reaction.update(.045);
        reaction.motionPreference.matches = true; reaction.update(0);
        expect(reaction.pivot.quaternion.toArray()).toEqual([0, 0, 0, 1]);
        reaction.motionPreference.matches = false;
        reaction.play(source, 20);
        actor.stunTimer = 1;
        actor.update(.3);
        expect(reaction.pivot.quaternion.toArray()).toEqual([0, 0, 0, 1]);
        actor.dispose();
    });

    test('mesh replacement and disposal unwrap the rig without disposing shared resources', () => {
        const { actor, reaction, source } = fixture();
        const oldMesh = actor.mesh, rig = reaction.rig;
        const material = rig.getObjectsByProperty('isMesh', true)[0].material;
        const dispose = jest.spyOn(material, 'dispose');
        reaction.play(source, 20); reaction.update(.045);
        actor.setMesh(createProceduralFighter());
        expect(rig.parent).toBe(oldMesh);
        expect(oldMesh.getObjectByName('ActorHitReactionPivot')).toBeUndefined();
        actor.playHitReaction(source, 20);
        const mesh = actor.mesh;
        actor.dispose();
        expect(mesh.getObjectByName('ActorHitReactionPivot')).toBeUndefined();
        expect(dispose).not.toHaveBeenCalled();
        dispose.mockRestore();
    });
});
