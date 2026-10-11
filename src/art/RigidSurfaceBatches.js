import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createFlatSurfaceMaterial } from './FittedEquipmentBatches.js';

// Constructor-owned immutable rig geometry and materials only. Both caches
// remain shared like the original family recipes; never batch a live loadout.
const geometries = new Map(), materials = new Map(), trusted = new WeakMap();

export function isOwnedRigidSurfaceMaterial(material) {
    const record = trusted.get(material);
    return Boolean(record && material.onBeforeCompile === record.compile &&
        material.customProgramCacheKey === record.key &&
        material.onBeforeRender === THREE.Material.prototype.onBeforeRender);
}

function appearanceKey(part, animated) {
    const material = part.material, geometry = part.geometry;
    if (!part.isMesh || part.isSkinnedMesh || part.isInstancedMesh || part.children.length || !part.visible ||
        animated.has(part.name) || Array.isArray(material) || material?.type !== 'MeshStandardMaterial' ||
        material.transparent || material.opacity !== 1 || !material.visible || material.vertexColors ||
        material.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile ||
        material.onBeforeRender !== THREE.Material.prototype.onBeforeRender ||
        material.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey ||
        part.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender ||
        part.onAfterRender !== THREE.Object3D.prototype.onAfterRender ||
        part.onBeforeShadow !== THREE.Object3D.prototype.onBeforeShadow ||
        part.onAfterShadow !== THREE.Object3D.prototype.onAfterShadow ||
        part.customDepthMaterial || part.customDistanceMaterial || material.clippingPlanes ||
        Object.values(material).some(value => value?.isTexture) || !geometry?.attributes.position ||
        !geometry.attributes.normal || !geometry.attributes.uv || Object.keys(geometry.morphAttributes).length ||
        geometry.drawRange.start !== 0 || geometry.drawRange.count !== Infinity ||
        geometry.attributes.color || geometry.attributes.fittedDiffuseRoughness || geometry.attributes.fittedEmissiveMetalness ||
        Object.values(geometry.attributes).some(attribute => attribute.isInterleavedBufferAttribute) ||
        ![material.color.r, material.color.g, material.color.b, material.emissive.r, material.emissive.g,
            material.emissive.b, material.emissiveIntensity, material.roughness, material.metalness].every(Number.isFinite)) return null;
    part.updateMatrix();
    if (!(part.matrix.determinant() > 0) || !part.matrix.elements.every(Number.isFinite)) return null;
    const appearance = material.toJSON();
    for (const field of ['uuid', 'name', 'metadata', 'userData', 'color', 'roughness', 'metalness', 'emissive', 'emissiveIntensity']) delete appearance[field];
    const attributes = Object.entries(geometry.attributes).map(([name, attribute]) =>
        `${name}:${attribute.itemSize}:${attribute.normalized}:${attribute.array.constructor.name}`).sort();
    return { material: JSON.stringify(appearance), bucket: JSON.stringify([appearance, attributes,
        part.castShadow, part.receiveShadow, part.renderOrder, part.layers.mask, part.frustumCulled,
        Boolean(part.userData.equipmentBodyBase)]) };
}

export function batchRigidSurfaceParts(root) {
    const animated = new Set(root.userData.animations.flatMap(clip => clip.tracks.map(track =>
        THREE.PropertyBinding.parseTrackName(track.name).nodeName)));
    const parents = []; root.traverse(part => { if (part.children.length) parents.push(part); });
    let saved = 0;
    for (const parent of parents) {
        const buckets = new Map();
        for (const part of parent.children) {
            const key = appearanceKey(part, animated); if (!key) continue;
            if (!buckets.has(key.bucket)) buckets.set(key.bucket, { key, parts: [] });
            buckets.get(key.bucket).parts.push(part);
        }
        for (const { key, parts } of buckets.values()) {
            if (parts.length < 2) continue;
            const geometryKey = parts.map(part => JSON.stringify([part.geometry.uuid, part.matrix.elements,
                part.material.color.toArray(), part.material.roughness, part.material.metalness,
                part.material.emissive.toArray(), part.material.emissiveIntensity])).join('|');
            let geometry = geometries.get(geometryKey);
            if (!geometry) {
                const copies = parts.map(part => {
                    const copy = (part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone()).applyMatrix4(part.matrix);
                    const count = copy.attributes.position.count, material = part.material;
                    const diffuse = new Float32Array(count * 4), emissive = new Float32Array(count * 4);
                    const color = new Float32Array([...material.color.toArray(), material.roughness]);
                    const glow = new Float32Array([...material.emissive.toArray().map(value => value * material.emissiveIntensity), material.metalness]);
                    for (let i = 0; i < count; i++) { diffuse.set(color, i * 4); emissive.set(glow, i * 4); }
                    copy.setAttribute('fittedDiffuseRoughness', new THREE.Float32BufferAttribute(diffuse, 4));
                    copy.setAttribute('fittedEmissiveMetalness', new THREE.Float32BufferAttribute(emissive, 4));
                    return copy;
                });
                geometry = mergeGeometries(copies, false); copies.forEach(copy => copy.dispose());
                if (!geometry) throw new Error(`Unable to merge owned rigid surfaces: ${parent.name}`);
                geometry.computeBoundingBox(); geometry.computeBoundingSphere(); geometries.set(geometryKey, geometry);
            }
            let material = materials.get(key.material);
            if (!material) {
                material = createFlatSurfaceMaterial(parts[0].material);
                trusted.set(material, { compile: material.onBeforeCompile, key: material.customProgramCacheKey });
                materials.set(key.material, material);
            }
            const first = parts[0], mesh = new THREE.Mesh(geometry, material);
            mesh.name = `RigidSurfaceBatch_${first.name}`;
            mesh.castShadow = first.castShadow; mesh.receiveShadow = first.receiveShadow;
            mesh.renderOrder = first.renderOrder; mesh.layers.mask = first.layers.mask; mesh.frustumCulled = first.frustumCulled;
            mesh.matrixAutoUpdate = false;
            mesh.userData.equipmentBodyBase = Boolean(first.userData.equipmentBodyBase);
            mesh.userData.rigidSurfaceBatch = true;
            mesh.userData.rigidSurfaceReferenceNames = parts.map(part => part.name);
            mesh.userData.humanoidBatchSources = parts.flatMap(part => part.userData.humanoidBatchSources || [part.name]);
            parent.remove(...parts); parent.add(mesh); saved += parts.length - 1;
        }
    }
    root.userData.humanoidRenderBatches = Object.freeze({ ...root.userData.humanoidRenderBatches,
        drawMeshes: root.userData.humanoidRenderBatches.drawMeshes - saved, surfaceAttributes: true });
}
