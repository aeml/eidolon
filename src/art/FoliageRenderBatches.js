import { Box3, Matrix4, Sphere, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getProceduralFoliageArchetype } from './ProceduralRealmFoliage.js';
import { createLeafCanopyGeometry } from './ProceduralLeafCanopy.js';
import { createConiferBoughGeometry } from './ProceduralConiferBoughs.js';
import { createWillowCurtainGeometry } from './WillowCurtainGeometry.js';
import { createElementalConiferGeometry } from './ElementalConiferGeometry.js';
import { createDrownedWillowGeometry } from './DrownedWillowGeometry.js';

const BATCHES = new Map();
const LOW_CROWNS = new Map();
const SHEAR_BAKES = new WeakMap();

// Three's instanced normal transform assumes orthogonal matrix columns. The
// taller woodland recipe composes nonuniform growth with tilted branches,
// producing shear. Bake only those fixed part transforms once, preserving
// exact positions/UVs/colors and inverse-transpose normals; placement remains
// an ordinary rotation plus uniform scale in the instance buffer.
function supportedInstancePart(part) {
    const columns = [0, 1, 2].map(index => new Vector3().setFromMatrixColumn(part.matrix, index).normalize());
    if (Math.max(Math.abs(columns[0].dot(columns[1])), Math.abs(columns[0].dot(columns[2])),
        Math.abs(columns[1].dot(columns[2]))) <= 1e-7) return part;
    let matrices = SHEAR_BAKES.get(part.geometry);
    if (!matrices) { matrices = new WeakMap(); SHEAR_BAKES.set(part.geometry, matrices); }
    let geometry = matrices.get(part.matrix);
    if (!geometry) {
        geometry = part.geometry.clone().applyMatrix4(part.matrix);
        geometry.computeBoundingBox(); geometry.computeBoundingSphere();
        matrices.set(part.matrix, geometry);
    }
    return Object.freeze({ ...part, geometry, matrix: new Matrix4() });
}

// Constructor/quality-change work only. A rotated tree's aggregate box sphere
// and transformed source spheres contain empty space beyond the actual crown.
// Visit the unchanged vertices once to bound their real transformed positions.
// Affine shear is handled exactly too; no per-frame scan or different tree LOD.
export function computeFoliageCellBounds(mesh) {
    mesh.computeBoundingBox();
    mesh.boundingSphere ??= new Sphere();
    mesh.boundingBox.getBoundingSphere(mesh.boundingSphere);
    if (!mesh.count) return;
    const matrix = new Matrix4(), point = new Vector3(), exactBox = new Box3();
    const positions = mesh.geometry.attributes.position;
    let radiusSquared = 0;
    for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix);
        for (let vertex = 0; vertex < positions.count; vertex++) {
            point.fromBufferAttribute(positions, vertex).applyMatrix4(matrix);
            exactBox.expandByPoint(point);
            radiusSquared = Math.max(radiusSquared, point.distanceToSquared(mesh.boundingSphere.center));
        }
    }
    mesh.boundingSphere.radius = Math.min(mesh.boundingSphere.radius, Math.sqrt(radiusSquared) + .000001);
    // The same existing vertex walk also tightens shadow influence bounds.
    // Rotated source-box corners are not foliage; keep a conservative epsilon.
    mesh.boundingBox.copy(exactBox).expandByScalar(.000001);
}

// Bake static same-material parts once. Keep woodland crowns, needle tiers and
// hanging curtains independently cullable: a shared enclosing box submits all
// of them in shadow/color passes when only one contributes. Every
// leaf/transform remains; spatial instancing still owns placement and culling.
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
                crown === 'leaf' ? createLeafCanopyGeometry('low') : crown === 'willow'
                    ? createWillowCurtainGeometry('low') : crown === 'drowned-willow'
                        ? createDrownedWillowGeometry('low') : crown === 'elemental-needle'
                        ? createElementalConiferGeometry('low') : createConiferBoughGeometry('low'));
            part = { ...part, geometry: LOW_CROWNS.get(crown) };
        }
        // The compact elemental crowns retain their original same-material
        // batches. Unlike dense Earth crowns, splitting these cheap sprays
        // would add cells/draws without enough saved triangles to justify it.
        const crownKey = crown && crown !== 'elemental-needle' ? `:${part.name}` : '';
        const key = `${part.material.uuid}:${part.castShadow}:${part.receiveShadow}${crownKey}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(part);
    }
    const batches = [...buckets.values()].map((parts, index) => {
        if (parts.length === 1) return supportedInstancePart(parts[0]);
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
        if (!group.userData.proceduralFoliage || !group.userData.foliageId ||
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
