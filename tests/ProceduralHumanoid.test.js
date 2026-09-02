import * as THREE from 'three';
import {
    createProceduralFighter,
    createProceduralRogue,
    getProceduralHumanoidCacheMetrics,
    HUMANOID_ANIMATION_STATES,
    HUMANOID_EQUIPMENT_ANCHORS
} from '../src/art/ProceduralHumanoid.js';
import { Fighter } from '../src/entities/Fighter.js';
import { Rogue } from '../src/entities/Rogue.js';

function meshCount(root) {
    let count = 0;
    root.traverse((child) => {
        if (child.isMesh && child.visible) count += 1;
    });
    return count;
}

function hasOnlyFiniteTransforms(root) {
    let finite = true;
    root.updateMatrixWorld(true);
    root.traverse((child) => {
        finite &&= child.matrixWorld.elements.every(Number.isFinite);
    });
    return finite;
}

describe('shared procedural humanoid Fighter', () => {
    test('creates a production silhouette grounded at its feet with no external model dependency', () => {
        const fighter = createProceduralFighter();
        const bounds = new THREE.Box3().setFromObject(fighter);
        const size = bounds.getSize(new THREE.Vector3());

        expect(fighter.userData.proceduralHumanoid).toBe(true);
        expect(fighter.userData.proceduralClass).toBe('Fighter');
        expect(fighter.userData.assetFallback).toBeUndefined();
        expect(meshCount(fighter)).toBeGreaterThanOrEqual(40);
        expect(bounds.min.y).toBeCloseTo(0, 1);
        expect(size.y).toBeGreaterThan(4);
        expect(size.x).toBeGreaterThan(2);
        expect(hasOnlyFiniteTransforms(fighter)).toBe(true);
    });

    test('provides named attachment anchors for every equippable slot', () => {
        const fighter = createProceduralFighter();

        expect(fighter.userData.equipmentAnchors).toEqual(HUMANOID_EQUIPMENT_ANCHORS);
        for (const anchorName of Object.values(HUMANOID_EQUIPMENT_ANCHORS).flat()) {
            const anchor = fighter.getObjectByName(anchorName);
            expect(anchor).not.toBeNull();
            expect(anchor.userData.equipmentAnchor).toBe(true);
        }
    });

    test('ships all actor states and animates independent rig pivots', () => {
        const fighter = createProceduralFighter();
        const clips = Object.fromEntries(fighter.userData.animations.map((clip) => [clip.name, clip]));
        const arm = fighter.getObjectByName('Rig_UpperArmRight');
        const originalRotation = arm.rotation.x;
        const mixer = new THREE.AnimationMixer(fighter);

        expect(Object.keys(clips)).toEqual(HUMANOID_ANIMATION_STATES);
        HUMANOID_ANIMATION_STATES.forEach((name) => expect(clips[name].tracks.length).toBeGreaterThan(0));

        mixer.clipAction(clips.Attack).reset().play();
        mixer.update(0.4);
        fighter.updateMatrixWorld(true);
        expect(arm.rotation.x).not.toBeCloseTo(originalRotation, 3);
        expect(hasOnlyFiniteTransforms(fighter)).toBe(true);

        mixer.stopAllAction();
        mixer.uncacheRoot(fighter);
    });

    test('shares immutable render resources while keeping per-actor transforms independent', () => {
        const first = createProceduralFighter();
        const second = createProceduralFighter();
        const firstPlate = first.getObjectByName('Fighter_Breastplate');
        const secondPlate = second.getObjectByName('Fighter_Breastplate');

        expect(first).not.toBe(second);
        expect(first.getObjectByName('Rig_Chest')).not.toBe(second.getObjectByName('Rig_Chest'));
        expect(firstPlate.geometry).toBe(secondPlate.geometry);
        expect(firstPlate.material).toBe(secondPlate.material);

        first.getObjectByName('Rig_Chest').rotation.y = 0.8;
        expect(second.getObjectByName('Rig_Chest').rotation.y).toBe(0);
        expect(getProceduralHumanoidCacheMetrics()).toEqual(expect.objectContaining({
            geometries: expect.any(Number),
            materials: expect.any(Number)
        }));
        expect(getProceduralHumanoidCacheMetrics().materials).toBeGreaterThanOrEqual(9);
        expect(getProceduralHumanoidCacheMetrics().geometries).toBeGreaterThan(20);
    });

    test('restores a pooled actor after death and preview scaling', () => {
        const fighter = createProceduralFighter();
        fighter.scale.setScalar(0.82);
        fighter.getObjectByName('RigRoot').rotation.z = -1.48;
        fighter.getObjectByName('RigRoot').position.set(0.76, -0.7, 0);

        fighter.userData.resetPose();

        expect(fighter.scale.toArray()).toEqual([1, 1, 1]);
        expect(fighter.getObjectByName('RigRoot').rotation.z).toBeCloseTo(0);
        expect(fighter.getObjectByName('RigRoot').position.toArray()).toEqual([0, 0, 0]);
        expect(hasOnlyFiniteTransforms(fighter)).toBe(true);
    });

    test('uses one full-height interaction hitbox when a pooled mesh changes owners', () => {
        const mesh = createProceduralFighter();
        const first = new Fighter('fighter-first');
        const second = new Fighter('fighter-second');

        first.setMesh(mesh);
        second.setMesh(mesh);

        const hitboxes = [];
        mesh.traverse((child) => {
            if (child.name === 'ActorInteractionHitbox') hitboxes.push(child);
        });
        expect(hitboxes).toHaveLength(1);
        expect(hitboxes[0].userData.entityId).toBe('fighter-second');
        expect(hitboxes[0].geometry.parameters).toEqual(expect.objectContaining({
            width: 2.5,
            height: 4.5,
            depth: 2.5
        }));
        expect(hitboxes[0].position.y).toBe(2.25);

        second.setPartyHighlight(true);
        const partyRing = mesh.getObjectByName('PartyRing');
        expect(partyRing.geometry.parameters).toEqual(expect.objectContaining({
            innerRadius: 0.9375,
            outerRadius: 1.3125
        }));
    });
});

describe('shared procedural humanoid Rogue', () => {
    test('creates a grounded Gloamreach shadeblade with an intentional asymmetric silhouette', () => {
        const rogue = createProceduralRogue();
        const bounds = new THREE.Box3().setFromObject(rogue);
        const size = bounds.getSize(new THREE.Vector3());

        expect(rogue.userData).toEqual(expect.objectContaining({
            proceduralHumanoid: true,
            proceduralClass: 'Rogue',
            artStyle: 'Gloamreach shadeblade',
            sharedGeometry: true
        }));
        expect(rogue.userData.assetFallback).toBeUndefined();
        expect(meshCount(rogue)).toBeGreaterThanOrEqual(45);
        expect(bounds.min.y).toBeCloseTo(0, 1);
        expect(size.y).toBeGreaterThan(4);
        expect(size.y).toBeLessThan(4.7);
        expect(size.x).toBeGreaterThan(1.5);
        expect(rogue.getObjectByName('Rogue_ShoulderHookLeft')).not.toBeNull();
        expect(rogue.getObjectByName('Rogue_ShoulderHookRight')).toBeUndefined();
        expect(hasOnlyFiniteTransforms(rogue)).toBe(true);
    });

    test('uses the complete shared equipment contract and purpose-built dual-strike clips', () => {
        const rogue = createProceduralRogue();
        const clips = Object.fromEntries(rogue.userData.animations.map((clip) => [clip.name, clip]));
        const leftArm = rogue.getObjectByName('Rig_UpperArmLeft');
        const rightArm = rogue.getObjectByName('Rig_UpperArmRight');
        const mixer = new THREE.AnimationMixer(rogue);

        expect(rogue.userData.equipmentAnchors).toEqual(HUMANOID_EQUIPMENT_ANCHORS);
        for (const anchorName of Object.values(HUMANOID_EQUIPMENT_ANCHORS).flat()) {
            expect(rogue.getObjectByName(anchorName)?.userData.equipmentAnchor).toBe(true);
        }
        expect(Object.keys(clips)).toEqual(HUMANOID_ANIMATION_STATES);
        HUMANOID_ANIMATION_STATES.forEach((name) => expect(clips[name].tracks.length).toBeGreaterThan(0));

        mixer.clipAction(clips.Attack).reset().play();
        mixer.update(0.4);
        expect(leftArm.rotation.x).not.toBeCloseTo(rightArm.rotation.x, 3);
        expect(hasOnlyFiniteTransforms(rogue)).toBe(true);
        mixer.stopAllAction();
        mixer.uncacheRoot(rogue);
    });

    test('shares cached render resources while preserving independent poses and pool resets', () => {
        const first = createProceduralRogue();
        const second = createProceduralRogue();
        const firstJerkin = first.getObjectByName('Rogue_Jerkin');
        const secondJerkin = second.getObjectByName('Rogue_Jerkin');

        expect(firstJerkin.geometry).toBe(secondJerkin.geometry);
        expect(firstJerkin.material).toBe(secondJerkin.material);
        first.getObjectByName('Rig_Chest').rotation.y = 0.7;
        expect(second.getObjectByName('Rig_Chest').rotation.y).toBe(0);

        first.scale.setScalar(0.78);
        first.getObjectByName('Rig_Hips').position.y = 0.14;
        first.userData.resetPose();
        expect(first.scale.toArray()).toEqual([1, 1, 1]);
        expect(first.getObjectByName('Rig_Hips').position.y).toBeCloseTo(1.7);
    });

    test('declares one correctly sized interaction hitbox when a pooled mesh changes Rogue owners', () => {
        const mesh = createProceduralRogue();
        const first = new Rogue('rogue-first');
        const second = new Rogue('rogue-second');

        first.setMesh(mesh);
        second.setMesh(mesh);
        const hitboxes = [];
        mesh.traverse((child) => {
            if (child.name === 'ActorInteractionHitbox') hitboxes.push(child);
        });

        expect(hitboxes).toHaveLength(1);
        expect(hitboxes[0].userData.entityId).toBe('rogue-second');
        expect(hitboxes[0].geometry.parameters).toEqual(expect.objectContaining({
            width: 2.1,
            height: 4.25,
            depth: 2.1
        }));
        expect(hitboxes[0].position.y).toBe(2.125);
    });
});
