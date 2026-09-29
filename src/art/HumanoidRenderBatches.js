import { Mesh, PropertyBinding } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Only constructor-owned, immutable humanoid geometry belongs in this cache.
// Do not call this on live/equipped actors or imported/skinned models.
const GEOMETRIES = new Map();

export function getHumanoidBatchGeometryCount() {
    return GEOMETRIES.size;
}

export function batchHumanoidRenderParts(root) {
    const animated = new Set(root.userData.animations.flatMap(clip =>
        clip.tracks.map(track => PropertyBinding.parseTrackName(track.name).nodeName)));
    const parents = [];
    let sourceMeshes = 0, saved = 0;
    root.traverse(object => {
        if (object.isMesh) sourceMeshes++;
        if (object.children.length) parents.push(object);
    });
    for (const parent of parents) {
        const buckets = new Map();
        for (const part of parent.children) {
            // Never cross a pivot, equipment anchor, body-mask boundary or
            // transparent sort boundary. Source previews retain named pieces.
            if (!part.isMesh || part.isSkinnedMesh || part.children.length || !part.visible ||
                animated.has(part.name) || Array.isArray(part.material) || part.material.transparent ||
                Object.keys(part.geometry.morphAttributes).length) continue;
            part.updateMatrix();
            if (part.matrix.determinant() <= 0) continue;
            const attributes = Object.entries(part.geometry.attributes)
                .map(([name, attr]) => `${name}:${attr.itemSize}:${attr.normalized}`).sort().join(',');
            const key = [part.material.uuid, part.castShadow, part.receiveShadow, part.renderOrder,
                part.layers.mask, Boolean(part.userData.equipmentBodyBase), attributes].join(':');
            if (!buckets.has(key)) buckets.set(key, []);
            buckets.get(key).push(part);
        }
        for (const parts of buckets.values()) {
            if (parts.length < 2) continue;
            const key = parts.map(part => `${part.geometry.uuid}:${part.matrix.elements.join(',')}`).join('|');
            let geometry = GEOMETRIES.get(key);
            if (!geometry) {
                const baked = parts.map(part => (part.geometry.index
                    ? part.geometry.toNonIndexed() : part.geometry.clone()).applyMatrix4(part.matrix));
                geometry = mergeGeometries(baked, false);
                baked.forEach(part => part.dispose());
                if (!geometry) throw new Error(`Unable to batch humanoid parts: ${parent.name}`);
                geometry.computeBoundingBox(); geometry.computeBoundingSphere();
                GEOMETRIES.set(key, geometry);
            }
            const first = parts[0], combined = new Mesh(geometry, first.material);
            combined.name = `HumanoidBatch_${first.name}`;
            combined.castShadow = first.castShadow;
            combined.receiveShadow = first.receiveShadow;
            combined.renderOrder = first.renderOrder;
            combined.layers.mask = first.layers.mask;
            combined.userData.equipmentBodyBase = Boolean(first.userData.equipmentBodyBase);
            combined.userData.humanoidBatchSources = parts.map(part => part.name);
            combined.matrixAutoUpdate = false;
            // Removing the sources prevents equipment clear/reset from making
            // hidden duplicates visible. Source geometries remain shared.
            parent.remove(...parts);
            parent.add(combined);
            saved += parts.length - 1;
        }
    }
    root.userData.humanoidRenderBatches = Object.freeze({ sourceMeshes, drawMeshes: sourceMeshes - saved });
}

