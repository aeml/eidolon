import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hasTrustedEquipmentSurfaceMaps } from './AuthoredEquipmentSurfaces.js';

const identity = new THREE.Matrix4();

function keyFor(mesh, serialization, surfaceAttributes) {
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
    if (surfaceAttributes && (material.vertexColors || geometry.attributes.color ||
        geometry.attributes.fittedDiffuseRoughness || geometry.attributes.fittedEmissiveMetalness ||
        geometry.attributes.skinIndex?.itemSize !== 4 || geometry.attributes.skinIndex.normalized ||
        geometry.attributes.skinWeight?.itemSize !== 4 ||
        ![material.color.r, material.color.g, material.color.b, material.emissive.r, material.emissive.g,
            material.emissive.b, material.roughness, material.metalness, material.emissiveIntensity].every(Number.isFinite) ||
        !mesh.skeleton.bones.every(bone => {
            for (let node = bone; node; node = node.parent) if (node === mesh.userData.fittedParent) return true;
            return false;
        }) || mesh.skeleton.bones.length !== mesh.skeleton.boneInverses.length ||
        !mesh.skeleton.boneInverses.every(matrix => matrix.elements.every(Number.isFinite)))) return null;
    mesh.updateMatrix();
    if (!mesh.matrix.equals(identity)) return null;
    // Keep texture UUIDs in the appearance key without repeatedly embedding
    // pixel arrays in every material key. The equip pass owns this serializer.
    const appearance = material.toJSON(serialization);
    for (const field of ['uuid', 'name', 'metadata', 'userData']) delete appearance[field];
    if (surfaceAttributes) for (const field of ['color', 'roughness', 'metalness', 'emissive', 'emissiveIntensity']) delete appearance[field];
    const attributes = Object.entries(geometry.attributes).map(([name, attribute]) =>
        `${name}:${attribute.itemSize}:${attribute.normalized}:${surfaceAttributes && name === 'skinIndex' ? 'Uint16Array' : attribute.array?.constructor.name}:${Boolean(attribute.isInterleavedBufferAttribute)}`)
        .sort().join('|');
    if (Object.values(geometry.attributes).some(attribute => attribute.isInterleavedBufferAttribute)) return null;
    return JSON.stringify([appearance, attributes, Boolean(geometry.index),
        surfaceAttributes ? null : mesh.skeleton.bones.map(bone => bone.uuid),
        surfaceAttributes ? null : mesh.skeleton.boneInverses.map(matrix => matrix.elements),
        mesh.bindMatrix.elements, mesh.bindMode, mesh.userData.fittedParent.uuid,
        mesh.castShadow, mesh.receiveShadow, mesh.renderOrder, mesh.layers.mask, mesh.frustumCulled]);
}

// Stock skinning keeps every source bone/inverse pair, including partial rigs
// and mirrored accessories. Only owned copies remap indices into their union;
// no inverse matrix is approximated or substituted with the body's rest pose.
function surfaceCopies(sources) {
    const bones = [], inverses = [], entries = new Map(), geometries = [];
    for (const source of sources) {
        const remap = source.skeleton.bones.map((bone, i) => {
            if (!entries.has(bone)) entries.set(bone, []);
            const candidates = entries.get(bone), inverse = source.skeleton.boneInverses[i];
            const existing = candidates.find(entry => inverses[entry].equals(inverse));
            if (existing !== undefined) return existing;
            const index = bones.length; bones.push(bone); inverses.push(inverse.clone()); candidates.push(index);
            return index;
        });
        if (bones.length > 65_536) { geometries.forEach(geometry => geometry.dispose()); return null; }
        const geometry = source.geometry.clone(), count = geometry.attributes.position.count;
        geometries.push(geometry);
        const indices = new Uint16Array(count * 4), diffuse = new Float32Array(count * 4), emissive = new Float32Array(count * 4);
        const skin = source.geometry.attributes.skinIndex, material = source.material;
        const diffuseValue = new Float32Array([material.color.r, material.color.g, material.color.b, material.roughness]);
        const emissiveValue = new Float32Array([material.emissive.r * material.emissiveIntensity,
            material.emissive.g * material.emissiveIntensity, material.emissive.b * material.emissiveIntensity, material.metalness]);
        for (let vertex = 0; vertex < count; vertex++) {
            for (let channel = 0; channel < 4; channel++) {
                const index = skin.getComponent(vertex, channel);
                if (!Number.isInteger(index) || index < 0 || index >= remap.length) {
                    geometries.forEach(copy => copy.dispose()); return null;
                }
                indices[vertex * 4 + channel] = remap[index];
            }
            diffuse.set(diffuseValue, vertex * 4); emissive.set(emissiveValue, vertex * 4);
        }
        geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
        geometry.setAttribute('fittedDiffuseRoughness', new THREE.Float32BufferAttribute(diffuse, 4));
        geometry.setAttribute('fittedEmissiveMetalness', new THREE.Float32BufferAttribute(emissive, 4));
    }
    return { bones, inverses, geometries };
}

function surfaceMaterial(original) {
    const material = original.clone();
    // Each primitive has one source material. Flat varyings retain its exact
    // GPU float values without blending a different surface across triangles.
    const varyings = 'flat varying vec4 vFittedDiffuseRoughness;\nflat varying vec4 vFittedEmissiveMetalness;\n';
    material.onBeforeCompile = shader => {
        shader.vertexShader = 'attribute vec4 fittedDiffuseRoughness;\nattribute vec4 fittedEmissiveMetalness;\n' + varyings +
            shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
                vFittedDiffuseRoughness = fittedDiffuseRoughness;
                vFittedEmissiveMetalness = fittedEmissiveMetalness;`);
        shader.fragmentShader = varyings + shader.fragmentShader
            .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( vFittedDiffuseRoughness.rgb, opacity );')
            .replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = vFittedEmissiveMetalness.rgb;')
            .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor *= vFittedDiffuseRoughness.a;')
            .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor *= vFittedEmissiveMetalness.a;');
    };
    // The shared roughness/metalness maps still modulate each supplied factor.
    material.roughness = material.metalness = 1;
    material.customProgramCacheKey = () => 'fitted-surface-attributes-v1';
    material.userData.fittedSurfaceAttributes = true;
    return material;
}

// The returned list retains hidden originals for transparent/stealth sorting
// and ownership cleanup. Derived buffers belong to this equip generation only.
export function batchFittedEquipment(parts, { surfaceAttributes = false } = {}) {
    const buckets = new Map(), batches = [];
    const serialization = { textures: {}, images: {} };
    for (const part of parts) {
        const key = keyFor(part, serialization, surfaceAttributes);
        if (!key) continue;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(part);
    }
    for (const sources of buckets.values()) {
        if (sources.length < 2) continue;
        const copies = surfaceAttributes ? surfaceCopies(sources) : null;
        if (surfaceAttributes && !copies) continue;
        const geometry = mergeGeometries(copies?.geometries || sources.map(source => source.geometry), false);
        copies?.geometries.forEach(copy => copy.dispose());
        if (!geometry) continue;
        const first = sources[0], mesh = new THREE.SkinnedMesh(geometry, surfaceAttributes ? surfaceMaterial(first.material) : first.material);
        mesh.name = `FittedBatch_${first.name}`;
        mesh.bindMode = first.bindMode;
        mesh.bind(copies ? new THREE.Skeleton(copies.bones, copies.inverses) : first.skeleton, first.bindMatrix.clone());
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
