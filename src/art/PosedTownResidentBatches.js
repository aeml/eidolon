import { Matrix4, Mesh } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Constructor-only optimization for scenery-owned adult residents. Their
// posed body is static except for the explicitly retained motion pivots.
// Never use on services, player equipment, live actors or imported rigs.
export function batchPosedTownResident(root, movingPivots) {
    if (!root.userData.ambientResident) throw new Error('Only owned scenery residents can bake a pose');
    root.updateMatrixWorld(true);
    const boundaries = new Set(movingPivots), buckets = new Map();
    let sourceMeshes = 0;
    const collect = (object, owner) => {
        if (boundaries.has(object)) owner = object;
        if (object.isMesh) {
            sourceMeshes++;
            if (!object.isSkinnedMesh && !object.children.length && object.visible &&
                !Array.isArray(object.material) && !object.material.transparent &&
                !Object.keys(object.geometry.morphAttributes).length) {
                const attributes = Object.entries(object.geometry.attributes)
                    .map(([name, a]) => `${name}:${a.itemSize}:${a.normalized}`).sort().join(',');
                const key = [owner.uuid, object.material.uuid, object.castShadow, object.receiveShadow,
                    object.renderOrder, object.layers.mask, attributes].join(':');
                if (!buckets.has(key)) buckets.set(key, { owner, parts: [] });
                buckets.get(key).parts.push(object);
            }
        }
        for (const child of object.children) collect(child, owner);
    };
    collect(root, root);
    const replaced = new Set(); let saved = 0;
    for (const { owner, parts } of buckets.values()) {
        if (parts.length < 2) continue;
        const inverse = new Matrix4().copy(owner.matrixWorld).invert();
        const baked = parts.map(part => {
            const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
            return geometry.applyMatrix4(new Matrix4().multiplyMatrices(inverse, part.matrixWorld));
        });
        const geometry = mergeGeometries(baked, false); baked.forEach(value => value.dispose());
        if (!geometry) throw new Error('Unable to bake a resident material boundary');
        geometry.computeBoundingBox(); geometry.computeBoundingSphere();
        const first = parts[0], mesh = new Mesh(geometry, first.material);
        mesh.name = `ResidentPose_${first.name}`;
        mesh.castShadow = first.castShadow; mesh.receiveShadow = first.receiveShadow;
        mesh.renderOrder = first.renderOrder; mesh.layers.mask = first.layers.mask;
        mesh.matrixAutoUpdate = false;
        mesh.userData.townPoseSources = parts.map(part => part.name);
        for (const part of parts) { replaced.add(part.geometry); part.removeFromParent(); }
        owner.add(mesh); saved += parts.length - 1;
    }
    // Residents clone their source resources. Release replaced clones now,
    // unless an unbatched part still uses one; no global merged-geometry cache.
    root.traverse(part => { if (part.isMesh) replaced.delete(part.geometry); });
    replaced.forEach(geometry => geometry.dispose());
    root.userData.posedResidentBatches = { sourceMeshes, drawMeshes: sourceMeshes - saved };
}
