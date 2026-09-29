import * as THREE from 'three';
import { jest } from '@jest/globals';
import { createTerrainBeamGeometry } from '../src/art/TerrainBeamGeometry.js';
import { createTransientEffect } from '../src/core/TransientEffects.js';
import { EARTH_ELEVATION as field } from '../src/data/worldElevation.js';

function ringCenters(mesh, sides) {
    mesh.updateWorldMatrix(true, false);
    const positions = mesh.geometry.attributes.position;
    const centers = [];
    for (let row = 0; row < positions.count / (sides + 1); row++) {
        const center = new THREE.Vector3();
        for (let side = 0; side < sides; side++) center.add(new THREE.Vector3().fromBufferAttribute(positions, row * (sides + 1) + side));
        centers.push(center.divideScalar(sides).applyMatrix4(mesh.matrixWorld));
    }
    return centers;
}

function expectCenterline(mesh, sides, start, end) {
    const centers = ringCenters(mesh, sides);
    expect(centers[0].distanceTo(start)).toBeLessThan(.00001);
    expect(centers.at(-1).distanceTo(end)).toBeLessThan(.00001);
    const dx = end.x - start.x, dz = end.z - start.z;
    const lengthSq = dx * dx + dz * dz;
    for (let row = 0; row < centers.length - 1; row++) for (const blend of [0, .25, .5, .75, 1]) {
        const point = centers[row].clone().lerp(centers[row + 1], blend);
        const t = lengthSq > 0 ? ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSq : blend;
        const lift = THREE.MathUtils.lerp(start.y - field.sample(start.x, start.z), end.y - field.sample(end.x, end.z), t);
        expect(point.y).toBeCloseTo(field.sample(point.x, point.z) + lift, 4);
        expect(Math.abs((point.x - start.x) * dz - (point.z - start.z) * dx)).toBeLessThan(.001);
    }
}

test.each([
    [-590, 410, -510, 430], [-510, 430, -590, 410],
    [-570, 410, -570, 460], [-590, 410, -510, 410],
    [-1010, 410, -980, 430]
])('beam rings and spans follow each terrain triangle from %s,%s to %s,%s', (sx, sz, ex, ez) => {
    const start = new THREE.Vector3(sx, field.sample(sx, sz) + 3, sz);
    const end = new THREE.Vector3(ex, field.sample(ex, ez) + 1.25, ez);
    const beam = createTerrainBeamGeometry(start, end, field, .12);
    const mesh = new THREE.Mesh(beam.geometry);
    mesh.position.copy(start);
    const originalGeometry = mesh.geometry;
    for (const width of [1, 1.09, .91, .08]) {
        beam.setWidthScale(width);
        expectCenterline(mesh, 8, start, end);
        expect(mesh.geometry).toBe(originalGeometry);
        const center = ringCenters(mesh, 8)[0];
        const vertex = new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, 0).applyMatrix4(mesh.matrixWorld);
        expect(vertex.distanceTo(center)).toBeCloseTo(.12 * width, 5);
    }
    beam.geometry.dispose();
});

test.each([
    ['Wizard', 'Scorch Beam'], ['Wizard', 'Dragonfire Lance'], ['Fighter', 'Unbreakable Grip'], [null, null]
])('%s/%s uses terrain geometry with stable endpoints throughout animation and disposes it', (className, abilityName) => {
    const scene = new THREE.Group();
    const source = { meshType: className, position: new THREE.Vector3(-570, field.sample(-570, 410), 410) };
    const position = new THREE.Vector3(-535, 0, 439);
    const effect = createTransientEffect(scene, 'beam', position, 0xffaa00,
        { source, ...(abilityName ? { abilityName } : {}), terrainElevation: field });
    const beams = abilityName ? effect.root.children.filter(child => child.terrainBeam) : effect.meshes;
    expect(beams).toHaveLength(abilityName ? 2 : 1);
    const disposeSpies = beams.map(beam => jest.spyOn(beam.geometry, 'dispose'));
    const lift = abilityName ? 1.25 : 1.5;
    const start = source.position.clone().add(new THREE.Vector3(0, lift, 0));
    const end = position.clone().setY(field.sample(position.x, position.z) + lift);
    for (let step = 0; step < 4; step++) {
        effect.update(.06);
        beams.forEach((beam, index) => expectCenterline(beam, abilityName ? (index ? 5 : 8) : 10, start, end));
    }
    effect.dispose(); effect.dispose();
    disposeSpies.forEach(spy => expect(spy).toHaveBeenCalledTimes(1));
    expect(scene.children).toHaveLength(0);
    expect(source.position.y).toBe(field.sample(-570, 410));
    expect(position.y).toBe(0);
});

test('zero horizontal beam remains finite', () => {
    const start = new THREE.Vector3(-570, field.sample(-570, 410) + 1.25, 410);
    const beam = createTerrainBeamGeometry(start, start, field, .12);
    expect([...beam.geometry.attributes.position.array].every(Number.isFinite)).toBe(true);
    expectCenterline(new THREE.Mesh(beam.geometry).translateX(start.x).translateY(start.y).translateZ(start.z), 8, start, start);
    beam.geometry.dispose();
});
