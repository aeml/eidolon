import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hasTrustedEquipmentSurfaceMaps } from './AuthoredEquipmentSurfaces.js';

const identity = new THREE.Matrix4();

function keyFor(mesh, serialization, palette) {
    const material = mesh.material, geometry = mesh.geometry;
    // Only opaque stock PBR gear with no textures or exact shared generated
    // equipment surfaces is eligible. Preserve other
    // shaders, transparency, morphs, draw ranges and transform boundaries.
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
        material.clippingPlanes || Object.values(material).some(value => value?.isTexture) && !hasTrustedEquipmentSurfaceMaps(material) ||
        mesh.customDepthMaterial || mesh.customDistanceMaterial ||
        Object.keys(geometry.morphAttributes).length || geometry.groups.length ||
        geometry.drawRange.start !== 0 || geometry.drawRange.count !== Infinity ||
        !mesh.userData.fittedParent) return null;
    mesh.updateMatrix();
    if (!mesh.matrix.equals(identity)) return null;
    // Keep texture UUIDs in the appearance key without repeatedly embedding
    // pixel arrays in every material key. The equip pass owns this serializer.
    const appearance = material.toJSON(serialization);
    for (const field of ['uuid', 'name', 'metadata', 'userData']) delete appearance[field];
    // A constant opaque tint can live on the derived vertices. Existing vertex
    // colors remain a boundary; every other PBR/texture/rig property stays keyed.
    if (palette && !material.vertexColors && !geometry.attributes.color) delete appearance.color;
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
export function batchFittedEquipment(parts, { palette = false } = {}) {
    const buckets = new Map(), batches = [];
    const serialization = { textures: {}, images: {} };
    for (const part of parts) {
        const key = keyFor(part, serialization, palette);
        if (!key) continue;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(part);
    }
    for (const sources of buckets.values()) {
        if (sources.length < 2) continue;
        const first = sources[0];
        const variedTint = palette && sources.some(source => !source.material.color.equals(first.material.color));
        if (variedTint && sources.some(source => source.material.vertexColors || source.geometry.attributes.color)) continue;
        const copies = [];
        let geometry;
        try {
            const inputs = sources.map(source => {
                if (!variedTint) return source.geometry;
                const copy = source.geometry.clone(); copies.push(copy);
                const count = copy.attributes.position.count, tint = source.material.color;
                const color = new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3);
                for (let vertex = 0; vertex < count; vertex++) color.setXYZ(vertex, tint.r, tint.g, tint.b);
                copy.setAttribute('color', color);
                return copy;
            });
            geometry = mergeGeometries(inputs, false);
        } finally { copies.forEach(copy => copy.dispose()); }
        if (!geometry) continue;
        const material = variedTint ? first.material.clone() : first.material;
        if (variedTint) { material.color.set(0xffffff); material.vertexColors = true; }
        const mesh = new THREE.SkinnedMesh(geometry, material);
        mesh.name = `FittedBatch_${first.name}`;
        mesh.bindMode = first.bindMode;
        mesh.bind(first.skeleton, first.bindMatrix.clone());
        mesh.castShadow = first.castShadow; mesh.receiveShadow = first.receiveShadow;
        mesh.renderOrder = first.renderOrder; mesh.layers.mask = first.layers.mask;
        mesh.frustumCulled = first.frustumCulled;
        Object.assign(mesh.userData, { authoredEquipment: true, fittedOwnedGeometry: true,
            fittedParent: first.userData.fittedParent, fittedBatchSources: sources.map(source => source.name),
            ...(palette ? { fittedBatchSourceIds: sources.map(source => source.uuid), fittedPaletteBatch: variedTint } : {}),
            fittedSlots: [...new Set(sources.map(source => source.userData.slot))] });
        for (const source of sources) { source.visible = false; source.userData.fittedBatchSource = true; }
        batches.push(mesh);
    }
    return [...parts, ...batches];
}
