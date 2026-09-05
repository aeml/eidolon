import * as THREE from 'three';
import { createTailoredTorsoGeometry, createOpenHoodGeometry, createPairedEyesGeometry } from '../src/art/ProceduralGarmentGeometry.js';
import { createProceduralFighter, createProceduralRogue, createProceduralWizard, createProceduralCleric } from '../src/art/ProceduralHumanoid.js';
import { applyProceduralEquipment, clearProceduralEquipment } from '../src/art/ProceduralEquipment.js';

const classes = [
    ['Fighter', createProceduralFighter, 'Fighter_Cloak'],
    ['Rogue', createProceduralRogue, 'Rogue_CloakLeft'],
    ['Wizard', createProceduralWizard, 'Wizard_RobePanelLeft'],
    ['Cleric', createProceduralCleric, 'Cleric_VestmentPanelLeft']
];

test('tailored torso narrows at both waist and neckline with finite faceted surfaces', () => {
    const geometry = createTailoredTorsoGeometry(0.4, 0.6, 1.1);
    const profile = geometry.parameters.points;
    expect(profile).toHaveLength(5);
    expect(profile[0].x).toBeLessThan(profile[2].x);
    expect(profile.at(-1).x).toBeLessThan(profile[2].x * 0.5);
    expect(profile.at(-1).y - profile[0].y).toBeCloseTo(1.1);
    expect(geometry.attributes.position.array.every(Number.isFinite)).toBe(true);
    expect(geometry.attributes.normal.array.every(Number.isFinite)).toBe(true);
    geometry.dispose();
});

test('hood leaves the face opening clear rather than forming a cone over the face', () => {
    const geometry = createOpenHoodGeometry();
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const hood = new THREE.Mesh(geometry, material);
    hood.updateMatrixWorld(true);
    const hits = new THREE.Raycaster(new THREE.Vector3(0, 0.25, 1), new THREE.Vector3(0, 0, -1)).intersectObject(hood);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].point.z).toBeLessThan(0);
    geometry.dispose();
    material.dispose();
});

test('paired eyes leave a real gap across the nose', () => {
    const geometry = createPairedEyesGeometry(0.1, 0.04, 0.24);
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const eyes = new THREE.Mesh(geometry, material);
    eyes.updateMatrixWorld(true);
    const cast = (x) => new THREE.Raycaster(new THREE.Vector3(x, 0, 1), new THREE.Vector3(0, 0, -1)).intersectObject(eyes);
    expect(cast(0)).toHaveLength(0);
    expect(cast(-0.12).length).toBeGreaterThan(0);
    expect(cast(0.12).length).toBeGreaterThan(0);
    geometry.dispose();
    material.dispose();
});

test.each(classes)('%s cloth panels are visible from both sides', (_name, create, panelName) => {
    const actor = create();
    actor.updateMatrixWorld(true);
    const panel = actor.getObjectByName(panelName);
    panel.geometry.computeBoundingBox();
    const center = panel.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(panel.matrixWorld);
    const normal = new THREE.Vector3(0, 0, 1).transformDirection(panel.matrixWorld);
    for (const side of [-1, 1]) {
        const ray = new THREE.Raycaster(center.clone().addScaledVector(normal, side), normal.clone().multiplyScalar(-side));
        expect(ray.intersectObject(panel).length).toBeGreaterThan(0);
    }
});

test.each(classes)('%s uses independent garment length and preserves the rig through animation and unequip', (name, create) => {
    const actor = create();
    const bounds = { ...actor.userData.bounds };
    const shoulder = actor.getObjectByName('Rig_UpperArmRight');
    const shoulderRest = shoulder.position.clone();
    expect(shoulder.position.y).toBeGreaterThan(0.6);
    applyProceduralEquipment(actor, {
        chest: { id: 'fit-chest', name: 'Plate Mail', level: 1 },
        legs: { id: 'fit-legs', name: 'Plate Greaves', level: 1 }
    });
    for (const slot of ['chest', 'legs']) {
        const piece = actor.getObjectByName(`EquippedVisual_${slot}`);
        expect(piece.scale.y).toBe(actor.userData.equipmentLengthBySlot[slot]);
        expect(piece.scale.x).toBe(actor.userData.equipmentScaleBySlot?.[slot] ?? 1);
        if (name !== 'Fighter') expect(piece.scale.y).toBeGreaterThan(piece.scale.x);
    }
    const mixer = new THREE.AnimationMixer(actor);
    for (const clip of actor.userData.animations) {
        const action = mixer.clipAction(clip).play();
        for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
            mixer.setTime(clip.duration * fraction);
            actor.updateMatrixWorld(true);
            actor.traverse((child) => expect(child.matrixWorld.elements.every(Number.isFinite)).toBe(true));
        }
        action.stop();
    }
    mixer.stopAllAction();
    mixer.uncacheRoot(actor);
    clearProceduralEquipment(actor);
    expect(shoulder.position.toArray()).toEqual(shoulderRest.toArray());
    expect(actor.userData.bounds).toEqual(bounds);
    expect(actor.getObjectByName('EquippedVisual_chest')).toBeUndefined();
});
