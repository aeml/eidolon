import * as THREE from 'three';
import { jest } from '@jest/globals';
import { createProceduralAbilityCastEffect } from '../src/art/ProceduralAbilityCasts.js';
import { EARTH_ELEVATION as field } from '../src/data/worldElevation.js';

const point = new THREE.Vector3(-525, 0, 440);

function checkRings(effect) {
    effect.root.updateMatrixWorld(true);
    for (const adapter of effect.groundRings) {
        const mesh = adapter.mesh, positions = mesh.geometry.attributes.position;
        const at = i => new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
        let lift;
        for (let i = 0; i < positions.count; i++) {
            const p = at(i), y = p.y - field.sample(p.x, p.z);
            lift ??= y;
            expect(y).toBeCloseTo(lift, 4);
            if (mesh.userData.gameplayBoundary) expect(Math.hypot(p.x-effect.root.position.x, p.z-effect.root.position.z))
                .toBeLessThanOrEqual(effect.root.userData.gameplayRadius + .0001);
        }
        const indices = mesh.geometry.index;
        for (let i = 0; i < indices.count; i += 3) {
            const center = at(indices.getX(i)).add(at(indices.getX(i+1))).add(at(indices.getX(i+2))).divideScalar(3);
            expect(center.y - field.sample(center.x, center.z)).toBeGreaterThan(0);
        }
    }
}

test.each([
    ['Fighter', 'Shield Slam', 'cone', 8, Math.PI / 2],
    ['Wizard', 'Meteor Drop', 'telegraph', 12, null],
    ['Rogue', 'Smoke Bomb', 'smoke_cloud', 5, null],
    ['Cleric', 'Healing Light', 'pillar', null, null],
    ['Wizard', 'Fireball', 'impact', null, null]
])('%s/%s ground visuals retain reach and animation on terrain', (abilityClass, abilityName, type, radius, arc) => {
    const options = { abilityClass, abilityName, radius, arc, direction: new THREE.Vector3(1, 0, .3).normalize() };
    const effect = createProceduralAbilityCastEffect(new THREE.Group(), type, point, 0xffffff, { ...options, terrainElevation: field });
    const flat = createProceduralAbilityCastEffect(new THREE.Group(), type, point, 0xffffff, options);
    const original = effect.groundRings.map(ring => ring.source);
    const privateGeometry = effect.groundRings.map(ring => ring.geometry);
    const cleanup = privateGeometry.map(geo => jest.spyOn(geo, 'dispose'));
    for (const phase of [.15, .5, .9]) {
        const dt = effect.duration * phase - effect.elapsed;
        effect.update(dt); flat.update(dt);
        checkRings(effect);
        effect.groundRings.forEach((ring, i) => {
            expect(ring.geometry).toBe(privateGeometry[i]);
            expect(flat.root.getObjectByName(ring.mesh.name).geometry).toBe(original[i]);
        });
        for (const { part } of effect.groundPresentation.details) {
            const reference = flat.root.getObjectByName(part.name);
            const before = reference.getWorldPosition(new THREE.Vector3());
            const after = part.getWorldPosition(new THREE.Vector3());
            expect(after.x).toBeCloseTo(before.x, 5);
            expect(after.z).toBeCloseTo(before.z, 5);
            expect(after.y).toBeCloseTo(before.y + field.sample(after.x, after.z), 5);
            expect(part.geometry).toBe(reference.geometry);
            expect(part.quaternion.toArray()).toEqual(reference.quaternion.toArray());
        }
    }
    // The real render loop can step past the exact endpoint. Closing rings
    // reach zero scale before disposal; terrain must not invert that matrix.
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
        effect.update(effect.duration - effect.elapsed + .016);
        expect(effect.isActive).toBe(false);
        expect(errors).not.toHaveBeenCalled();
    } finally {
        errors.mockRestore();
        effect.dispose(); effect.dispose(); flat.dispose();
    }
    cleanup.forEach(spy => expect(spy).toHaveBeenCalledTimes(1));
});

test('Earthshaker strip edges follow terrain without changing their world-space footprint', () => {
    const options = { abilityClass: 'Fighter', abilityName: 'Earthshaker', radius: 16, shapeKind: 'line', direction: new THREE.Vector3(1, 0, 0) };
    const effect = createProceduralAbilityCastEffect(new THREE.Group(), 'wave', point, 0xffffff, { ...options, terrainElevation: field });
    expect(effect.groundPresentation.surfaces).toHaveLength(4);
    effect.update(.3); effect.root.updateMatrixWorld(true);
    for (const { part } of effect.groundPresentation.surfaces) {
        const positions = part.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const p = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(part.matrixWorld);
            expect(p.x).toBeGreaterThanOrEqual(point.x - .031);
            expect(p.x).toBeLessThanOrEqual(point.x + 16.031);
            expect(Math.abs(p.z-point.z)).toBeLessThanOrEqual(4.031);
            expect(p.y - field.sample(p.x, p.z)).toBeGreaterThan(.0599);
            expect(p.y - field.sample(p.x, p.z)).toBeLessThan(.1001);
        }
    }
    effect.dispose();
});

test('Whirlwind follows its moving owner and keeps the authoritative radius update on the floor', () => {
    const owner = { position: point.clone().setY(field.sample(point.x, point.z)), state: 'MOVING', isActive: true };
    const effect = createProceduralAbilityCastEffect(new THREE.Group(), 'spin', owner.position, 0xffffff,
        { source: owner, abilityClass: 'Fighter', abilityName: 'Whirlwind', radius: 6, whirlwindDuration: 2, terrainElevation: field });
    for (let step = 0; step < 4; step++) {
        owner.position.x += 3;
        owner.position.y = field.sample(owner.position.x, owner.position.z) + (step === 3 ? 8 : 0);
        if (step === 2) effect.setRadius(8.1);
        effect.update(.2);
        checkRings(effect);
        expect(effect.root.position.toArray()).toEqual(owner.position.toArray());
    }
    expect(effect.root.userData.gameplayRadius).toBe(8.1);
    const ring = effect.groundRings.find(entry => entry.mesh.userData.gameplayBoundary);
    const outer = new THREE.Vector3().fromBufferAttribute(ring.mesh.geometry.attributes.position, ring.mesh.geometry.attributes.position.count-1)
        .applyMatrix4(ring.mesh.matrixWorld);
    expect(Math.hypot(outer.x-owner.position.x, outer.z-owner.position.z)).toBeCloseTo(8.1, 4);
    const owned = effect.groundRings.map(entry => jest.spyOn(entry.geometry, 'dispose'));
    owner.state = 'DEAD'; effect.update(.1);
    expect(effect.isActive).toBe(false);
    owned.forEach(spy => expect(spy).toHaveBeenCalledTimes(1));
});
