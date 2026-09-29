import * as THREE from 'three';
import { getFoliageRenderBatches } from '../src/art/FoliageRenderBatches.js';
import { PROCEDURAL_FOLIAGE_RECIPES, getProceduralFoliageArchetype } from '../src/art/ProceduralRealmFoliage.js';

function surfaceSignature(parts) {
    const surfaces = new Map();
    for (const part of parts) {
        const key = `${part.material.uuid}:${part.castShadow}:${part.receiveShadow}`;
        if (!surfaces.has(key)) surfaces.set(key, []);
        const list = surfaces.get(key), geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
        geometry.applyMatrix4(part.matrix);
        const p = geometry.attributes.position, n = geometry.attributes.normal;
        for (let i = 0; i < p.count; i++) {
            list.push([p.getX(i), p.getY(i), p.getZ(i), n.getX(i), n.getY(i), n.getZ(i)]
                .map(value => Math.round(value * 1e4)).join(','));
        }
        geometry.dispose();
    }
    return new Map([...surfaces].map(([key, values]) => [key, values.sort()]));
}

test.each(PROCEDURAL_FOLIAGE_RECIPES.map(recipe => recipe.id))('%s batching preserves every transformed surface and shadow/material assignment', id => {
    const source = getProceduralFoliageArchetype(id), batches = getFoliageRenderBatches(id);
    expect(getFoliageRenderBatches(id)).toBe(batches);
    expect(batches.length).toBeLessThan(source.length);
    expect(surfaceSignature(batches)).toEqual(surfaceSignature(source));
    expect(batches.every(part => part.geometry.boundingSphere.radius > 0)).toBe(true);
    for (const part of source) expect(part.matrix).toBeInstanceOf(THREE.Matrix4);
});
