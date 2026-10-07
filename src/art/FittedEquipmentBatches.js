import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const identity = new THREE.Matrix4();

function keyFor(mesh) {
    const material = mesh.material, geometry = mesh.geometry;
    // Only opaque standard PBR gear is eligible. Textured pieces must share
    // the exact texture objects in every slot; names or similar images are
    // never sufficient. Preserve shader, morph and transform boundaries.
    if (!mesh.isSkinnedMesh || !mesh.userData.authoredEquipment || mesh.children.length || !mesh.visible ||
        Array.isArray(material) || material?.type !== 'MeshStandardMaterial' ||
        material.transparent || material.opacity !== 1 || !material.visible ||
        material.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile ||
        material.onBeforeRender !== THREE.Material.prototype.onBeforeRender ||
        material.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey ||
        mesh.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender ||
        mesh.onAfterRender !== THREE.Object3D.prototype.onAfterRender ||
        mesh.onBeforeShadow !== THREE.Object3D.prototype.onBeforeShadow ||
        mesh.onAfterShadow !== THREE.Object3D.prototype.onAfterShadow ||
        material.clippingPlanes ||
        mesh.customDepthMaterial || mesh.customDistanceMaterial ||
        Object.keys(geometry.morphAttributes).length || geometry.groups.length ||
        geometry.drawRange.start !== 0 || geometry.drawRange.count !== Infinity ||
        !mesh.userData.fittedParent) return null;
    mesh.updateMatrix();
    if (!mesh.matrix.equals(identity)) return null;
    // Serialize material uniforms/flags and texture identities, not image
    // pixels. Supplying a populated texture cache avoids canvas readback and
    // large data URLs while preserving exact map UUIDs in the appearance key.
    const textures = Object.fromEntries(Object.values(material).filter(value => value?.isTexture)
        .map(texture => [texture.uuid, { uuid: texture.uuid }]));
    const appearance = material.toJSON({ textures, images: {} });
    for (const field of ['uuid', 'name', 'metadata', 'userData']) delete appearance[field];
    const attributes = Object.entries(geometry.attributes).map(([name, attribute]) =>
        `${name}:${attribute.itemSize}:${attribute.normalized}:${attribute.array?.constructor.name}:${Boolean(attribute.isInterleavedBufferAttribute)}`)
        .sort().join('|');
    if (Object.values(geometry.attributes).some(attribute => attribute.isInterleavedBufferAttribute)) return null;
    return JSON.stringify([appearance, attributes, Boolean(geometry.index),
        mesh.skeleton.bones.map(bone => bone.uuid), mesh.skeleton.boneInverses.map(matrix => matrix.elements),
        mesh.bindMatrix.elements, mesh.bindMode, mesh.userData.fittedParent.uuid,
        mesh.castShadow, mesh.receiveShadow, mesh.renderOrder, mesh.layers.mask, mesh.frustumCulled]);
}

// The returned list retains hidden originals for transparent/stealth sorting
// and ownership cleanup. Derived buffers belong to this equip generation only.
export function batchFittedEquipment(parts) {
    const buckets = new Map(), batches = [];
    for (const part of parts) {
        const key = keyFor(part);
        if (!key) continue;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(part);
    }
    for (const sources of buckets.values()) {
        if (sources.length < 2) continue;
        const geometry = mergeGeometries(sources.map(source => source.geometry), false);
        if (!geometry) continue;
        const first = sources[0], mesh = new THREE.SkinnedMesh(geometry, first.material);
        mesh.name = `FittedBatch_${first.name}`;
        mesh.bindMode = first.bindMode;
        mesh.bind(first.skeleton, first.bindMatrix.clone());
        mesh.castShadow = first.castShadow; mesh.receiveShadow = first.receiveShadow;
        mesh.renderOrder = first.renderOrder; mesh.layers.mask = first.layers.mask;
        mesh.frustumCulled = first.frustumCulled;
        Object.assign(mesh.userData, { authoredEquipment: true, fittedOwnedGeometry: true,
            fittedParent: first.userData.fittedParent, fittedBatchSources: sources.map(source => source.name),
            fittedSlots: [...new Set(sources.map(source => source.userData.slot))] });
        for (const source of sources) { source.visible = false; source.userData.fittedBatchSource = true; }
        batches.push(mesh);
    }
    return [...parts, ...batches];
}
