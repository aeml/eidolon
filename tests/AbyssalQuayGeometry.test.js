import * as THREE from 'three';
import { createAbyssalQuay, createAbyssalMooring } from '../src/art/AbyssalQuayGeometry.js';
import { createBastionFoundation } from '../src/art/BastionArchitectureGeometry.js';

test('drowned quay has physical staggered slab joints within the original water-safe shelf', () => {
    const original = createBastionFoundation(), quay = createAbyssalQuay();
    original.computeBoundingBox();
    for (const edge of ['min', 'max']) quay.boundingBox[edge].toArray().forEach((value, axis) =>
        expect(value).toBeCloseTo(original.boundingBox[edge].toArray()[axis], 5));
    const material = new THREE.MeshStandardMaterial(), mesh = new THREE.Mesh(quay, material);
    mesh.updateMatrixWorld(true);
    const top = (x, z) => new THREE.Raycaster(new THREE.Vector3(x, 8, z), new THREE.Vector3(0, -1, 0))
        .intersectObject(mesh)[0].point.y;
    expect(top(2.25, -.7)).toBeCloseTo(3.08, 5);
    expect(top(-.1, -.7)).toBeCloseTo(2.8, 5);
    expect(top(-.1, 3.5)).toBeGreaterThan(3.05);
    // The existing entrance scales the 3.1m source to 3m, below its 3.1m water.
    expect(3.1 - quay.boundingBox.max.y * 3 / 3.1).toBeGreaterThan(.09);
    expect(quay.groups).toHaveLength(0);
    expect(quay.attributes.position.count / 3).toBeLessThan(8000);
    expect(Object.values(quay.attributes).every(attribute => [...attribute.array].every(Number.isFinite))).toBe(true);
    original.dispose(); quay.dispose(); material.dispose();
});

test('mooring links have open holes, visible iron surfaces and a sagging line inside the old anchor clearance', () => {
    const start = new THREE.Vector3(18, 7, 8), end = new THREE.Vector3(34, 2, 18);
    const chain = createAbyssalMooring(start.toArray(), end.toArray());
    const material = new THREE.MeshStandardMaterial(), mesh = new THREE.Mesh(chain, material);
    mesh.updateMatrixWorld(true);
    const tangent = end.clone().sub(start); tangent.y *= 2; tangent.normalize();
    const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(rotation);
    const across = new THREE.Vector3(.38, 0, 0).applyQuaternion(rotation);
    // Isolate the first link for physical-hole raycasts; the full chain is
    // restored before bounds/cost checks. Subsequent links legitimately cross it.
    chain.setDrawRange(0, 192);
    const hit = point => new THREE.Raycaster(point.clone().addScaledVector(normal, 2), normal.clone().negate())
        .intersectObject(mesh);
    expect(hit(start)).toHaveLength(0);
    expect(hit(start.clone().add(across)).length).toBeGreaterThan(0);
    chain.setDrawRange(0, Infinity);
    const centers = [], position = chain.attributes.position;
    for (let first = 0; first < position.count; first += 192) {
        const center = new THREE.Vector3();
        for (let i = first; i < first + 192; i++) center.add(new THREE.Vector3().fromBufferAttribute(position, i));
        centers.push(center.divideScalar(192));
    }
    const middle = centers.reduce((best, center) => Math.abs(center.x - 26) < Math.abs(best.x - 26) ? center : best);
    const straightY = start.y + (end.y - start.y) * (middle.x - start.x) / (end.x - start.x);
    expect(straightY - middle.y).toBeGreaterThan(1);
    expect(chain.boundingBox.min.x).toBeGreaterThan(17);
    expect(chain.boundingBox.max.x).toBeLessThan(35);
    expect(chain.boundingBox.min.y).toBeGreaterThan(1);
    expect(chain.boundingBox.max.y).toBeLessThan(8);
    expect(chain.groups).toHaveLength(0);
    expect(position.count / 3).toBeLessThan(1600);
    expect(Object.values(chain.attributes).every(attribute => [...attribute.array].every(Number.isFinite))).toBe(true);
    chain.dispose(); material.dispose();
});
