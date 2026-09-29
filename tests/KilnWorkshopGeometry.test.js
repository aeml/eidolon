import * as THREE from 'three';
import { createKilnFurnaceGeometry, createKilnDryingRackGeometry, createKilnYardPaving } from '../src/art/KilnWorkshopGeometry.js';

function finiteOwnedGeometry(geometry, triangleLimit) {
    for (const key of ['position', 'normal', 'uv', 'color']) {
        expect(geometry.attributes[key]).toBeDefined();
        expect([...geometry.attributes[key].array].every(Number.isFinite)).toBe(true);
    }
    expect(geometry.attributes.color.count).toBe(geometry.attributes.position.count);
    expect(geometry.attributes.position.count / 3).toBeLessThan(triangleLimit);
}

test.each(['high', 'low'])('%s kiln has a recessed mouth and hollow chimney inside the existing envelope', quality => {
    const parts = createKilnFurnaceGeometry({ quality });
    for (const geometry of Object.values(parts)) {
        finiteOwnedGeometry(geometry, 5000);
        expect(geometry.boundingBox.min.x).toBeGreaterThan(-2.5);
        expect(geometry.boundingBox.max.x).toBeLessThan(2.5);
        expect(geometry.boundingBox.min.z).toBeGreaterThan(-2.5);
        expect(geometry.boundingBox.max.z).toBeLessThan(2.5);
        expect(geometry.boundingBox.min.y).toBeGreaterThanOrEqual(0);
        expect(geometry.boundingBox.max.y).toBeLessThan(5.8);
    }
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const masonry = new THREE.Mesh(parts.masonry, material), iron = new THREE.Mesh(parts.iron, material);
    const mouth = new THREE.Raycaster(new THREE.Vector3(0, .95, 4), new THREE.Vector3(0, 0, -1));
    const hit = mouth.intersectObjects([masonry, iron])[0];
    expect(hit.point.z).toBeCloseTo(.84, 2); // dark back wall, not a painted door
    const flue = new THREE.Raycaster(new THREE.Vector3(0, 7, 0), new THREE.Vector3(0, -1, 0));
    expect(flue.intersectObject(iron)).toHaveLength(0);
    material.dispose(); Object.values(parts).forEach(g => g.dispose());
});

test.each(['high', 'low'])('%s drying rack stays within the old rack footprint', quality => {
    const parts = createKilnDryingRackGeometry({ quality });
    for (const geometry of Object.values(parts)) {
        finiteOwnedGeometry(geometry, 2000);
        expect(geometry.boundingBox.min.x).toBeGreaterThan(-2.5);
        expect(geometry.boundingBox.max.x).toBeLessThan(2.5);
        expect(geometry.boundingBox.min.z).toBeGreaterThan(-1.3);
        expect(geometry.boundingBox.max.z).toBeLessThan(1.3);
        geometry.dispose();
    }
});

test('yard slabs are low, keep the quest room open and respect full road/hazard clearance', () => {
    const geometry = createKilnYardPaving((x, z, radius) => x - radius > 3);
    finiteOwnedGeometry(geometry, 2200);
    expect(geometry.boundingBox.min.x).toBeGreaterThan(3);
    expect(geometry.boundingBox.min.y).toBeGreaterThan(0);
    expect(geometry.boundingBox.max.y).toBeLessThan(.06);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i), z = positions.getZ(i);
        expect(Math.abs(x) > 3.6 || z < -3.6 || z > 3).toBe(true);
    }
    geometry.dispose();
    const empty = createKilnYardPaving(() => false);
    expect(empty.attributes.position.count).toBe(0); empty.dispose();
});
