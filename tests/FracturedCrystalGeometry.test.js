import * as THREE from 'three';
import { createFracturedCrystalGeometry } from '../src/art/FracturedCrystalGeometry.js';
import { getProceduralFoliageArchetype } from '../src/art/ProceduralRealmFoliage.js';
import { getFoliageRenderBatches } from '../src/art/FoliageRenderBatches.js';

test('fractured prisms keep the original radius/height with deterministic outward finite facets', () => {
    const geometry = createFracturedCrystalGeometry(), repeat = createFracturedCrystalGeometry();
    try {
        expect(geometry.attributes.position.array).toEqual(repeat.attributes.position.array);
        expect(geometry.attributes.position.count / 3).toBe(34);
        expect([...geometry.attributes.position.array, ...geometry.attributes.normal.array,
            ...geometry.attributes.uv.array].every(Number.isFinite)).toBe(true);
        const p = geometry.attributes.position, n = geometry.attributes.normal;
        for (let index = 0; index < p.count; index++) {
            expect(Math.hypot(p.getX(index), p.getZ(index))).toBeLessThanOrEqual(.340001);
            expect(Math.hypot(n.getX(index), n.getY(index), n.getZ(index))).toBeCloseTo(1, 5);
        }
        for (let index = 0; index < p.count; index += 3) {
            const center = new THREE.Vector3();
            for (let vertex = 0; vertex < 3; vertex++) center.add(new THREE.Vector3().fromBufferAttribute(p, index + vertex));
            center.multiplyScalar(1 / 3);
            expect(center.dot(new THREE.Vector3().fromBufferAttribute(n, index))).toBeGreaterThan(0);
        }
        expect(geometry.boundingBox.min.y).toBeCloseTo(-1.1, 5);
        expect(geometry.boundingBox.max.y).toBeCloseTo(1.1, 5);
    } finally { geometry.dispose(); repeat.dispose(); }
});

test.each(['basalt_briar', 'storm_crystal'])('%s keeps four parts/three material batches and unchanged High/Low shape', id => {
    const parts = getProceduralFoliageArchetype(id);
    expect(parts).toHaveLength(4);
    expect(parts.every(part => part.geometry.userData.fracturedCrystal)).toBe(true);
    expect(parts[0].material.userData.worldSurfaceDetail).toBe(id === 'basalt_briar' ? 'stratified-rock' : 'slate');
    expect(parts[0].material.map).toBeNull(); expect(parts[0].material.normalMap).toBeNull();
    const high = getFoliageRenderBatches(id), low = getFoliageRenderBatches(id, 'low');
    expect(high).toHaveLength(3); expect(low).toHaveLength(3);
    for (let index = 0; index < high.length; index++) {
        expect(low[index].material).toBe(high[index].material);
        expect(low[index].material.transparent).toBe(false);
        expect(low[index].geometry.attributes.position.array).toEqual(high[index].geometry.attributes.position.array);
        expect(low[index].matrix.elements).toEqual(high[index].matrix.elements);
    }
});

test.each(['basalt_briar', 'storm_crystal'])('%s forks grow from the grounded central formation rather than floating beside it', id => {
    const parts = getProceduralFoliageArchetype(id);
    for (const fork of parts.slice(1, 3)) {
        const root = new THREE.Vector3(0, -1.1, 0).applyMatrix4(fork.matrix);
        expect(root.y).toBeCloseTo(-.08, 5);
        expect(Math.hypot(root.x, root.z)).toBeLessThan(.22);
        const tip = new THREE.Vector3(.05, 1.1, -.02).applyMatrix4(fork.matrix);
        expect(Math.abs(tip.x)).toBeGreaterThan(.5);
    }
});
