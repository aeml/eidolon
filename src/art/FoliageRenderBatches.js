import { Matrix4, Sphere } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getProceduralFoliageArchetype } from './ProceduralRealmFoliage.js';
import { createLeafCanopyGeometry } from './ProceduralLeafCanopy.js';
import { createConiferBoughGeometry } from './ProceduralConiferBoughs.js';

const BATCHES = new Map();
const LOW_CROWNS = new Map();

// Constructor/quality-change work only. A rotated tree's aggregate box sphere
// contains empty corners far beyond its actual crown. Bound the same vertices
// by their cached source spheres too; choose the tighter conservative radius.
// This is O(instances), not a per-frame vertex scan or a different tree LOD.
export function computeFoliageCellBounds(mesh) {
    mesh.computeBoundingBox();
    mesh.boundingSphere ??= new Sphere();
    mesh.boundingBox.getBoundingSphere(mesh.boundingSphere);
    if (!mesh.count) return;
    if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
    const matrix = new Matrix4(), sphere = new Sphere();
    let radius = 0;
    for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix);
        sphere.copy(mesh.geometry.boundingSphere).applyMatrix4(matrix);
        radius = Math.max(radius, sphere.center.distanceTo(mesh.boundingSphere.center) + sphere.radius);
    }
    mesh.boundingSphere.radius = Math.min(mesh.boundingSphere.radius, radius + .000001);
}

// Bake each static tree's same-material parts together once. Spatial instancing
// still owns world placement/culling; previews retain their named source parts.
export function getFoliageRenderBatches(id, quality = 'high') {
    const source = getProceduralFoliageArchetype(id);
    const reduced = quality === 'low' && source.some(part => part.geometry.userData.woodlandCrown);
    const cacheKey = `${id}:${reduced ? 'low' : 'high'}`;
    if (BATCHES.has(cacheKey)) return BATCHES.get(cacheKey);
    const buckets = new Map();
    for (let part of source) {
        const crown = part.geometry.userData.woodlandCrown;
        if (quality === 'low' && crown) {
            if (!LOW_CROWNS.has(crown)) LOW_CROWNS.set(crown,
                crown === 'leaf' ? createLeafCanopyGeometry('low') : createConiferBoughGeometry('low'));
            part = { ...part, geometry: LOW_CROWNS.get(crown) };
        }
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
    BATCHES.set(cacheKey, Object.freeze(batches));
    return BATCHES.get(cacheKey);
}

// Swap shared detail geometry in place. No collision, placement, material or
// instance buffer rebuild, and no disposal of cache-owned geometry on a toggle.
export function updateFoliageRenderQuality(root, quality) {
    const level = quality === 'low' ? 'low' : 'high';
    root?.traverse(group => {
        if (!group.userData.proceduralFoliage || group.userData.region !== 'earth' ||
            group.userData.foliageQuality === level) return;
        const parts = new Map(getFoliageRenderBatches(group.userData.foliageId, level).map(part => [part.name, part]));
        for (const mesh of group.children) {
            const part = parts.get(mesh.name);
            if (!part || mesh.geometry === part.geometry) continue;
            mesh.geometry = part.geometry;
            computeFoliageCellBounds(mesh);
        }
        group.userData.foliageQuality = level;
    });
}
