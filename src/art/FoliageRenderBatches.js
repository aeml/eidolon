import { Matrix4 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getProceduralFoliageArchetype } from './ProceduralRealmFoliage.js';

const BATCHES = new Map();

// Bake each static tree's same-material parts together once. Spatial instancing
// still owns world placement/culling; previews retain their named source parts.
export function getFoliageRenderBatches(id) {
    if (BATCHES.has(id)) return BATCHES.get(id);
    const buckets = new Map();
    for (const part of getProceduralFoliageArchetype(id)) {
        const key = `${part.material.uuid}:${part.castShadow}:${part.receiveShadow}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(part);
    }
    const batches = [...buckets.values()].map((parts, index) => {
        if (parts.length === 1) return parts[0];
        const baked = parts.map(part => {
            const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
            return geometry.applyMatrix4(part.matrix);
        });
        const geometry = mergeGeometries(baked, false);
        baked.forEach(part => part.dispose());
        if (!geometry) throw new Error(`Unable to batch foliage material: ${id}/${index}`);
        geometry.computeBoundingBox(); geometry.computeBoundingSphere();
        return Object.freeze({ name: `${id}:material-batch:${index}`, geometry,
            material: parts[0].material, matrix: new Matrix4(),
            castShadow: parts[0].castShadow, receiveShadow: parts[0].receiveShadow });
    });
    BATCHES.set(id, Object.freeze(batches));
    return BATCHES.get(id);
}
