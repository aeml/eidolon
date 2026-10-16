import * as THREE from 'three';
import { createBastionGatehouse } from '../src/art/BastionArchitectureGeometry.js';

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
