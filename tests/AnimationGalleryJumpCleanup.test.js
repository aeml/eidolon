import * as THREE from 'three';
import { jest } from '@jest/globals';
import { AnimationGallery } from '../src/animationGallery.js';
import { Actor } from '../src/entities/Actor.js';
import { CONSTANTS } from '../src/core/Constants.js';

function actor(id) {
    const value = new Actor(id, CONSTANTS.ENTITIES.FIGHTER);
    const mesh = new THREE.Group();
    mesh.userData.animations = ['Idle', 'Walk', 'Run', 'Attack', 'Death'].map(name =>
        new THREE.AnimationClip(name, 1, [new THREE.NumberKeyframeTrack('.position[x]', [0, 1], [0, 0.01])]));
    value.setMesh(mesh);
    return value;
}

function gallery() {
    const value = Object.create(AnimationGallery.prototype);
    Object.assign(value, { actor: actor('gallery-source'), remoteActor: null, targetActor: null,
        currentActorType: 'Cleric', presentationSequence: 0, jumpDuration: 0, jumpElapsed: 0,
        effects: [], persistentEntities: [], lootGalleryDrops: [], disposedEffects: 0,
        clearProceduralIconGallery: jest.fn(), clearProceduralLootGallery: jest.fn(),
        clearEffects: jest.fn(), setStatus: jest.fn(), updateMetrics: jest.fn(),
        framePresentation: jest.fn(), frameActorState: jest.fn() });
    return value;
}

describe('gallery jump preview lifecycle', () => {
    test.each(['Walk', 'Run'])('an interrupted jump cannot reset a replacement actor’s %s preview', state => {
        const value = gallery();
        const oldActor = value.actor;
        value.playActorState('Jump');
        value.update(0.6);
        // loadActors calls this cleanup before replacing the actor. Exercise the
        // actual lifecycle methods without asynchronous mesh-loading noise.
        value.cleanupPresentation();
        value.actor = actor('gallery-replacement');
        value.currentActorType = 'Imp';
        value.playActorState(state);
        value.update(0.5);
        expect(value.actor.currentAnimationName).toBe(state);
        expect(value.actor.state).toBe('MOVING');
        expect(value.jumpDuration).toBe(0);
        expect(value.jumpElapsed).toBe(0);
        oldActor.dispose(); value.actor.dispose();
    });

    test('cleanup cancels the current jump and restores its visual height', () => {
        const value = gallery();
        value.playActorState('Jump'); value.update(0.4);
        expect(value.actor.mesh.position.y).toBeGreaterThan(0);
        value.cleanupPresentation();
        expect(value.jumpDuration).toBe(0);
        expect(value.jumpElapsed).toBe(0);
        expect(value.actor.jumpAnimationRestore).toBeNull();
        expect(value.actor.mesh.position.y).toBe(value.actor.position.y);
        expect(value.actor.state).toBe('IDLE');
        value.actor.dispose();
    });

    test('an uninterrupted jump still completes normally', () => {
        const value = gallery();
        value.playActorState('Jump'); value.update(0.4);
        expect(value.actor.state).toBe('JUMPING');
        expect(value.jumpDuration).toBe(1);
        value.update(0.6);
        expect(value.actor.state).toBe('IDLE');
        expect(value.actor.currentAnimationName).toBe('Idle');
        expect(value.jumpDuration).toBe(0);
        value.actor.dispose();
    });
});
