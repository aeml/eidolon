import * as THREE from 'three';
import { createLanternholdBenchPlank, createLanternholdWellBucket, createLanternholdSupplyBarrel } from '../src/art/LanternholdUtilityGeometry.js';

test('beveled bench slats preserve their physical envelope with finite light-catching normals', () => {
    for (const size of [[4.4, .25, .34], [4.4, .33, .14]]) {
        const geometry = createLanternholdBenchPlank(...size);
        geometry.computeBoundingBox();
        geometry.boundingBox.getSize(new THREE.Vector3()).toArray().forEach((v, i) => expect(v).toBeCloseTo(size[i], 6));
        expect(geometry.attributes.position.count / 3).toBeLessThanOrEqual(108);
        expect([...geometry.attributes.normal.array].every(Number.isFinite)).toBe(true);
        expect([...geometry.attributes.normal.array].some(v => Math.abs(v) > .1 && Math.abs(v) < .9)).toBe(true);
        geometry.dispose();
    }
});

test.each(['high', 'low'])('well bucket has an open mouth, real inner wall and closed floor at %s', quality => {
    const geometry = createLanternholdWellBucket(quality);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox.min.y).toBeCloseTo(-.35, 6);
    expect(geometry.boundingBox.max.y).toBeCloseTo(.35, 6);
    expect(geometry.attributes.position.count).toBeLessThanOrEqual(150);
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material); mesh.updateMatrixWorld(true);
    const down = new THREE.Raycaster(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0));
    expect(down.intersectObject(mesh)[0].point.y).toBeCloseTo(-.28, 6);
    const wall = new THREE.Raycaster(new THREE.Vector3(0, .2, 0), new THREE.Vector3(1, 0, 0));
    expect(wall.intersectObject(mesh)[0].distance).toBeGreaterThan(.3);
    expect(wall.intersectObject(mesh)[0].distance).toBeLessThan(.45);
    geometry.dispose(); material.dispose();
});

test('provision casks have closed ends and a bulged body inside a bounded unit footprint', () => {
    const geometry = createLanternholdSupplyBarrel(); geometry.computeBoundingBox();
    const size = geometry.boundingBox.getSize(new THREE.Vector3());
    expect(size.x).toBeCloseTo(1, 6); expect(size.z).toBeCloseTo(1, 6);
    expect(geometry.boundingBox.min.y).toBeCloseTo(.025, 6);
    expect(geometry.boundingBox.max.y).toBeCloseTo(1.4, 6);
    expect([...geometry.attributes.position.array].every(Number.isFinite)).toBe(true);
    expect(geometry.index.count / 3).toBeLessThanOrEqual(224);
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material); mesh.updateMatrixWorld(true);
    for (const [y, direction, hit] of [[2, -1, 1.4], [-1, 1, .025]]) {
        const ray = new THREE.Raycaster(new THREE.Vector3(.1, y, .1), new THREE.Vector3(0, direction, 0));
        expect(ray.intersectObject(mesh)[0].point.y).toBeCloseTo(hit, 6);
    }
    geometry.dispose(); material.dispose();
});
