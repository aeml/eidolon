import * as THREE from 'three';
import { createGaleCypressGeometry } from '../src/art/GaleCypressGeometry.js';
import { getProceduralFoliageArchetype, PROCEDURAL_FOLIAGE_RECIPES } from '../src/art/ProceduralRealmFoliage.js';
import { getFoliageRenderBatches } from '../src/art/FoliageRenderBatches.js';

test('gale timber is deterministic, UV-bearing and finite within a bounded construction budget', () => {
    const first = createGaleCypressGeometry(), second = createGaleCypressGeometry();
    try {
        expect(first.attributes.position.array).toEqual(second.attributes.position.array);
        expect(first.attributes.position.count / 3).toBe(244);
        expect(first.attributes.uv.count).toBe(first.attributes.position.count);
        const positions = first.attributes.position, normals = first.attributes.normal;
        for (let i = 0; i < positions.count; i++) {
            expect(Math.hypot(positions.getX(i), positions.getZ(i))).toBeLessThan(.85);
            expect(positions.getY(i)).toBeGreaterThan(-3.3);
            expect(positions.getY(i)).toBeLessThan(4);
            expect(Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i))).toBeCloseTo(1, 5);
        }
        expect(first.attributes.uv.array.every(Number.isFinite)).toBe(true);
        expect(first.boundingSphere.radius).toBeLessThan(4);
    } finally { first.dispose(); second.dispose(); }
});

test('mature cypresses retain the original planting and walking apron without a floating root cone', () => {
    const recipe = PROCEDURAL_FOLIAGE_RECIPES.find(recipe => recipe.id === 'gale_cypress');
    expect(recipe.count).toBe(90); expect(recipe.collision).toBeNull();
    expect(recipe.renderCellSize).toBe(64);
    const parts = getProceduralFoliageArchetype(recipe.id);
    expect(parts).toHaveLength(4);
    const point = new THREE.Vector3(), bounds = new THREE.Box3();
    for (const part of parts) for (let i = 0; i < part.geometry.attributes.position.count; i++) {
        point.fromBufferAttribute(part.geometry.attributes.position, i).applyMatrix4(part.matrix);
        bounds.expandByPoint(point);
        expect(Math.hypot(point.x, point.z) * recipe.scale[1]).toBeLessThan(8);
        if (point.y < 2.5) expect(Math.hypot(point.x, point.z)).toBeLessThan(1.1);
    }
    expect(bounds.min.y).toBeGreaterThan(-.35);
    expect(bounds.min.y).toBeLessThan(.02);
    expect(bounds.max.y).toBeGreaterThan(9);
    const stem = parts[0];
    expect(stem.geometry.userData.galeCypress).toBe(true);
    expect(stem.material.userData.woodlandBark).toBe('pine');
    expect(stem.material.flatShading).toBe(false);
    expect(stem.material.map).toBeNull();
    expect(stem.castShadow).toBe(true); expect(stem.receiveShadow).toBe(true);
    for (const quality of ['high', 'low']) expect(getFoliageRenderBatches(recipe.id, quality)).toHaveLength(3);
});
