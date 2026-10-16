import * as THREE from 'three';
import { createBastionGatehouse, createBastionRamp, createBastionFoundation, createBondedBastionFoundation } from '../src/art/BastionArchitectureGeometry.js';

test('Bastion has a real recessed doorway, finite chamfers and the unchanged wall/floor envelope', () => {
    const geometry = createBastionGatehouse();
    const material = new THREE.MeshStandardMaterial();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.updateMatrixWorld(true);
    const hit = (origin, direction, far = 18) => new THREE.Raycaster(
        new THREE.Vector3(...origin), new THREE.Vector3(...direction), 0, far
    ).intersectObject(mesh);
    // Limit the ray to the front wall: the intact rear wall closes the hall.
    expect(hit([0, 12, 20], [0, 0, -1])).toHaveLength(0);
    expect(hit([8, 12, 20], [0, 0, -1])[0].point.z).toBeCloseTo(7, 5);
    expect(hit([0, 23, 20], [0, 0, -1])[0].point.z).toBeCloseTo(7, 5);
    const jamb = hit([0, 10, 5.5], [1, 0, 0])[0];
    expect(jamb.point.x).toBeGreaterThan(5); expect(jamb.point.x).toBeLessThan(5.7);
    expect(hit([-30, 20, -5], [1, 0, 0], 15)[0].point.x).toBeCloseTo(-21, 5);
    expect(hit([-30, 25.8, -5], [1, 0, 0], 15)).toHaveLength(0);
    expect(hit([0, 24.8, -30], [0, 0, 1], 18)).toHaveLength(0);
    expect(hit([0, 100, -5], [0, -1, 0], 110)[0].point.y).toBeCloseTo(4, 5);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox.min.toArray()).toEqual([-21, 3, -17]);
    expect(geometry.boundingBox.max.toArray()).toEqual([21, 27, 7]);
    expect([...geometry.attributes.normal.array].every(Number.isFinite)).toBe(true);
    expect(geometry.attributes.position.count / 3).toBeLessThan(500);
    expect(geometry.groups).toHaveLength(0); // One merged geometry/material draw.
    geometry.dispose(); material.dispose();
});

test('Bastion ramp has physical staggered joints within its former slab envelope', () => {
    const geometry = createBastionRamp();
    const material = new THREE.MeshStandardMaterial();
    const mesh = new THREE.Mesh(geometry, material); mesh.updateMatrixWorld(true);
    const surface = (x, z) => new THREE.Raycaster(new THREE.Vector3(x, 4, z),
        new THREE.Vector3(0, -1, 0)).intersectObject(mesh)[0].point.y;
    expect(surface(-9.625, -10.0625)).toBeCloseTo(1, 5);
    expect(surface(-8.25, -10.0625)).toBeCloseTo(.85, 5);
    // The next row shifts its vertical joint by half a stone.
    expect(surface(-8.25, -7.1875)).toBeCloseTo(1, 5);
    expect(surface(0, -8.625)).toBeCloseTo(.85, 5);
    geometry.computeBoundingBox();
    geometry.boundingBox.min.toArray().forEach((value, i) => expect(value).toBeCloseTo([-11, -1, -11.5][i], 5));
    geometry.boundingBox.max.toArray().forEach((value, i) => expect(value).toBeCloseTo([11, 1, 11.5][i], 5));
    expect(Object.values(geometry.attributes).every(attribute => [...attribute.array].every(Number.isFinite))).toBe(true);
    expect(geometry.attributes.position.count / 3).toBeLessThan(5000);
    expect(geometry.groups).toHaveLength(0);
    geometry.dispose(); material.dispose();
});


test('bonded Bastion foundation has staggered physical joints inside the original footing envelope', () => {
    const original = createBastionFoundation(), candidate = createBondedBastionFoundation();
    original.computeBoundingBox(); candidate.computeBoundingBox();
    for (const edge of ['min', 'max']) candidate.boundingBox[edge].toArray().forEach((value, i) =>
        expect(value).toBeCloseTo(original.boundingBox[edge].toArray()[i], 5));
    const material = new THREE.MeshStandardMaterial(), mesh = new THREE.Mesh(candidate, material);
    mesh.updateMatrixWorld(true);
    const top = (x, z) => new THREE.Raycaster(new THREE.Vector3(x, 8, z),
        new THREE.Vector3(0, -1, 0)).intersectObject(mesh)[0].point.y;
    expect(top(0, -.8)).toBeGreaterThan(3);
    expect(top(-2.2, -.8)).toBeCloseTo(2.85, 5);
    expect(top(-2.2, 2.4)).toBeGreaterThan(3);
    expect(candidate.groups).toHaveLength(0);
    expect(candidate.attributes.position.count / 3).toBeLessThan(12000);
    expect(Object.values(candidate.attributes).every(attribute => [...attribute.array].every(Number.isFinite))).toBe(true);
    original.dispose(); candidate.dispose(); material.dispose();
});
