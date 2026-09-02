import * as THREE from 'three';
import {
    createProceduralFighter,
    getProceduralHumanoidCacheMetrics,
    HUMANOID_ANIMATION_STATES,
    HUMANOID_EQUIPMENT_ANCHORS
} from '../src/art/ProceduralHumanoid.js';
import { Fighter } from '../src/entities/Fighter.js';

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
            materials: 9
        }));
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
