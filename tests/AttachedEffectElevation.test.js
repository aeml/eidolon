import * as THREE from 'three';
import { jest } from '@jest/globals';
import { AttachedStatusEffect, ACTOR_STATUS_VISUAL_STATES } from '../src/entities/AttachedStatusEffect.js';
import { SpiritGuardiansEffect } from '../src/entities/SpiritGuardiansEffect.js';
import { EARTH_ELEVATION as field } from '../src/data/worldElevation.js';

function source() {
    const position = new THREE.Vector3(-525, field.sample(-525, 440), 440);
    const mesh = new THREE.Group(); mesh.position.copy(position);
    return { id: 'hill-aura', position, mesh, state: 'IDLE', skillRunes: {}, guardianEmbraceRadius: 10,
        gameEngine: { terrainElevation: field, currentInstanceId: '' } };
}

function checkSurface(mesh, lift) {
    mesh.updateWorldMatrix(true, false);
    const geometry = mesh.geometry, p = geometry.attributes.position;
    const vertex = index => new THREE.Vector3().fromBufferAttribute(p, index).applyMatrix4(mesh.matrixWorld);
    for (let i = 0; i < p.count; i++) {
        const point = vertex(i);
        expect(point.y - field.sample(point.x, point.z)).toBeCloseTo(lift, 4);
    }
    // Faces, not just ring vertices, must stay above the visible terrain.
    for (let i = 0; i < geometry.index.count; i += 3) {
        const point = vertex(geometry.index.getX(i)).add(vertex(geometry.index.getX(i+1))).add(vertex(geometry.index.getX(i+2))).divideScalar(3);
        const clearance = point.y - field.sample(point.x, point.z);
        expect(clearance).toBeGreaterThan(0);
        expect(Math.abs(clearance - lift)).toBeLessThan(.08);
    }
}

test.each(Object.keys(ACTOR_STATUS_VISUAL_STATES))('%s ground seals follow movement and jumps without moving body ornaments or reallocating buffers', key => {
    const owner = source();
    const flatOwner = { ...owner, gameEngine: {} };
    const scene = new THREE.Group();
    const effect = new AttachedStatusEffect(scene, owner, key);
    const baseline = new AttachedStatusEffect(new THREE.Group(), flatOwner, key);
    const rings = [...effect.groundRings.entries()];
    expect(rings.length).toBeGreaterThan(0);
    const owned = rings.map(([ring]) => ring.geometry);
    const dispose = owned.map(geo => jest.spyOn(geo, 'dispose'));
    const sources = rings.map(([, adapter]) => jest.spyOn(adapter.source, 'dispose'));
    for (let step = 0; step < 3; step++) {
        owner.position.x += 3;
        owner.position.y = field.sample(owner.position.x, owner.position.z);
        owner.mesh.position.copy(owner.position);
        if (step === 2) owner.mesh.position.y += 8;
        effect.update(.13); baseline.update(.13);
        rings.forEach(([ring], index) => {
            expect(ring.geometry).toBe(owned[index]);
            checkSurface(ring, ring.userData.basePosition[1]);
        });
        effect.group.children.filter(part => !part.userData.groundSurface && !part.isInstancedMesh).forEach(part => {
            const flat = baseline.group.getObjectByName(part.name);
            expect(part.position.toArray()).toEqual(flat.position.toArray());
            expect(part.quaternion.toArray()).toEqual(flat.quaternion.toArray());
            expect(part.geometry).toBe(flat.geometry);
        });
    }
    owner.gameEngine.currentInstanceId = 'lanternhold-casino';
    effect.update(.1);
    rings.forEach(([ring, adapter]) => expect(ring.geometry).toBe(adapter.source));
    dispose.forEach(spy => expect(spy).toHaveBeenCalledTimes(1));
    effect.dispose(); effect.dispose(); baseline.dispose();
    sources.forEach(spy => { expect(spy).not.toHaveBeenCalled(); spy.mockRestore(); });
});

test('Well Rested sparks rise above their own ground samples and retain bounding coverage during jumps', () => {
    const owner = source(); owner.mesh.position.y += 8;
    const effect = new AttachedStatusEffect(new THREE.Group(), owner, 'well_rested');
    effect.update(.1);
    const matrix = new THREE.Matrix4(), point = new THREE.Vector3();
    for (const batch of effect.group.children.filter(part => part.isInstancedMesh)) {
        batch.updateWorldMatrix(true, false);
        for (let slot = 0; slot < batch.count; slot++) {
            batch.getMatrixAt(slot, matrix);
            point.setFromMatrixPosition(matrix);
            expect(batch.boundingSphere.containsPoint(point)).toBe(true);
            point.applyMatrix4(batch.matrixWorld);
            const phase = batch.userData.moteIndices[slot] / 16;
            expect(point.y - field.sample(point.x, point.z)).toBeCloseTo(.15 + ((.1 * .2 + phase) % 1) * 2.6, 4);
        }
    }
    effect.dispose();
});

test('healing boundary keeps its exact radius after a server radius update', () => {
    const owner = source(), effect = new AttachedStatusEffect(new THREE.Group(), owner, 'guardian_embrace');
    owner.guardianEmbraceRadius = 14;
    effect.update(.1);
    const ring = effect.group.getObjectByName('guardian_embrace:HealingReach');
    checkSurface(ring, .155);
    ring.updateWorldMatrix(true, false);
    const p = ring.geometry.attributes.position;
    let radius = 0;
    for (let i = 0; i < p.count; i++) {
        const point = new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(ring.matrixWorld);
        radius = Math.max(radius, Math.hypot(point.x - owner.position.x, point.z - owner.position.z));
    }
    expect(radius).toBeCloseTo(14, 4);
    effect.dispose();
});

test.each(['high', 'low'])('Spirit Guardians keep their ground boundary and terrain-relative orbit on %s', quality => {
    const owner = source(), effect = new SpiritGuardiansEffect(new THREE.Group(), owner, { quality });
    for (let step = 0; step < 4; step++) {
        owner.position.x += 2;
        owner.position.y = field.sample(owner.position.x, owner.position.z);
        effect.update(.15);
        checkSurface(effect.pulseRing, .2);
        for (const guardian of effect.guardians) {
            const point = guardian.getWorldPosition(new THREE.Vector3());
            const bob = Math.sin(effect.elapsed * 3.1 + guardian.userData.phase) * .22;
            expect(point.y - field.sample(point.x, point.z)).toBeCloseTo(1.35 + bob + .12, 4);
        }
    }
    const oldGeometry = effect.pulseRing.geometry;
    const disposed = jest.spyOn(oldGeometry, 'dispose');
    owner.spiritRadius = 20;
    effect.setVariant(); effect.update(.1);
    expect(effect.pulseRing.material.userData.auraInnerRatio.value).toBeCloseTo(19.88 / 20);
    expect(disposed).toHaveBeenCalledTimes(1);
    checkSurface(effect.pulseRing, .2);
    owner.gameEngine.currentInstanceId = 'dungeon_floor'; owner.position.y = 8;
    effect.update(.1);
    expect(effect.groundRing.geometry).toBeNull();
    expect(effect.pulseRing.getWorldPosition(new THREE.Vector3()).y).toBeCloseTo(8.2);
    effect.dispose(); effect.dispose();
});
