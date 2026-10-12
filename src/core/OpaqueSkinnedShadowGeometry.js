import * as THREE from 'three';

const attributes = ['position', 'skinIndex', 'skinWeight'];
const storage = attribute => attribute.isInterleavedBufferAttribute
    ? { array: attribute.data.array, stride: attribute.data.stride, offset: attribute.offset }
    : { array: attribute.array, stride: attribute.itemSize, offset: 0 };
const equalValues = (a, b) => a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
const sameFormat = (a, b) => storage(a).array.constructor.name === storage(b).array.constructor.name &&
    Object.is(a.itemSize, b.itemSize) && Object.is(a.normalized, b.normalized) &&
    Object.is(a.gpuType ?? THREE.FloatType, b.gpuType ?? THREE.FloatType);
const finiteSkeleton = (skeleton, cache) => {
    if (!skeleton?.bones.length || skeleton.boneInverses.length !== skeleton.bones.length) return false;
    if (cache?.has(skeleton)) return cache.get(skeleton);
    const valid = skeleton.boneInverses.every(matrix => matrix.elements.every(Number.isFinite));
    cache?.set(skeleton, valid); return valid;
};
const validAttribute = (attribute, itemSize, count) => attribute && attribute.itemSize === itemSize &&
    attribute.count === count && !attribute.isGLBufferAttribute &&
    (attribute.gpuType ?? THREE.FloatType) === THREE.FloatType;

// Geometry construction only. No renderer hook, scene proxy, registration or
// default activation: native depth/color/lifetime qualification is still needed.
export function isOpaqueSkinnedShadowMesh(mesh, skeletonCache = null) {
    const g = mesh.geometry, m = mesh.material, skeleton = mesh.skeleton;
    return Boolean(mesh.isSkinnedMesh && !mesh.isInstancedMesh && !mesh.isBatchedMesh && mesh.castShadow &&
        !Array.isArray(m) && (m?.isMeshStandardMaterial || m?.isMeshPhysicalMaterial) && m.visible &&
        !m.transparent && m.opacity === 1 && !m.alphaTest && !m.alphaHash && !m.alphaMap && !m.alphaToCoverage &&
        !m.displacementMap && !m.clippingPlanes && !m.wireframe &&
        [THREE.FrontSide, THREE.BackSide, THREE.DoubleSide].includes(m.side) &&
        (m.shadowSide === null || [THREE.FrontSide, THREE.BackSide, THREE.DoubleSide].includes(m.shadowSide)) &&
        !mesh.customDepthMaterial && !mesh.customDistanceMaterial &&
        mesh.onBeforeShadow === THREE.Object3D.prototype.onBeforeShadow &&
        mesh.onAfterShadow === THREE.Object3D.prototype.onAfterShadow &&
        g?.isBufferGeometry && g.index && !g.index.isInterleavedBufferAttribute && !g.index.normalized &&
        g.index.count > 0 && g.index.count % 3 === 0 && g.groups.length === 0 &&
        g.drawRange.start === 0 && g.drawRange.count === Infinity &&
        Object.values(g.morphAttributes).every(values => values.length === 0) &&
        validAttribute(g.attributes.position, 3, g.attributes.position?.count) &&
        g.attributes.position.count > 0 &&
        validAttribute(g.attributes.skinIndex, 4, g.attributes.position.count) && !g.attributes.skinIndex.normalized &&
        validAttribute(g.attributes.skinWeight, 4, g.attributes.position.count) &&
        finiteSkeleton(skeleton, skeletonCache) &&
        mesh.matrixWorld.elements.every(Number.isFinite) && mesh.bindMatrix.elements.every(Number.isFinite) &&
        mesh.bindMatrixInverse.elements.every(Number.isFinite));
}

function compatible(a, b) {
    if (a === b) return true;
    return a.bindMode === b.bindMode && a.layers.mask === b.layers.mask &&
        a.material.side === b.material.side && a.material.shadowSide === b.material.shadowSide &&
        equalValues(a.matrixWorld.elements, b.matrixWorld.elements) &&
        equalValues(a.bindMatrix.elements, b.bindMatrix.elements) &&
        equalValues(a.bindMatrixInverse.elements, b.bindMatrixInverse.elements) &&
        (a.skeleton === b.skeleton || a.skeleton.bones.length === b.skeleton.bones.length &&
            a.skeleton.bones.every((bone, i) => bone === b.skeleton.bones[i]) &&
            a.skeleton.boneInverses.every((matrix, i) => equalValues(matrix.elements, b.skeleton.boneInverses[i].elements))) &&
        attributes.every(name => sameFormat(a.geometry.attributes[name], b.geometry.attributes[name]));
}

export function groupOpaqueSkinnedShadowMeshes(root) {
    root.updateWorldMatrix(true, true);
    const groups = [], skeletonCache = new WeakMap();
    root.traverseVisible(mesh => {
        if (!isOpaqueSkinnedShadowMesh(mesh, skeletonCache)) return;
        const group = groups.find(parts => compatible(parts[0], mesh));
        if (group) group.push(mesh); else groups.push([mesh]);
    });
    return groups.filter(parts => parts.length > 1);
}

export function haveCompatibleOpaqueSkinnedShadowState(meshes) {
    // Scope this cache to one synchronous check. Every subsequent frame still
    // validates live inverse values; meshes sharing one skeleton share the work.
    const skeletonCache = new WeakMap();
    return meshes.length > 1 && new Set(meshes).size === meshes.length &&
        meshes.every(mesh => isOpaqueSkinnedShadowMesh(mesh, skeletonCache) && compatible(meshes[0], mesh));
}

export function createOpaqueSkinnedShadowGeometry(meshes) {
    if (!haveCompatibleOpaqueSkinnedShadowState(meshes)) {
        throw new Error('Opaque shadow batch requires distinct meshes with exact skin, bind, transform and depth state');
    }
    const geometry = new THREE.BufferGeometry();
    const vertexCount = meshes.reduce((count, mesh) => count + mesh.geometry.attributes.position.count, 0);
    if (!Number.isSafeInteger(vertexCount) || vertexCount > 0xffffffff) throw new Error('Shadow batch exceeds original Uint32 index range');
    for (const name of attributes) {
        const first = meshes[0].geometry.attributes[name], firstStorage = storage(first);
        const array = new firstStorage.array.constructor(vertexCount * first.itemSize);
        let cursor = 0;
        for (const mesh of meshes) {
            const source = mesh.geometry.attributes[name], packed = storage(source);
            for (let vertex = 0; vertex < source.count; vertex++) for (let channel = 0; channel < source.itemSize; channel++) {
                const value = packed.array[vertex * packed.stride + packed.offset + channel];
                if (!Number.isFinite(value)) throw new Error('Non-finite shadow source attribute');
                if (name === 'skinIndex' && (!Number.isInteger(value) || value < 0 || value >= mesh.skeleton.bones.length)) {
                    throw new Error('Shadow source joint outside original skeleton');
                }
                array[cursor++] = value;
            }
        }
        geometry.setAttribute(name, new THREE.BufferAttribute(array, first.itemSize, first.normalized));
    }
    const indices = new Uint32Array(meshes.reduce((count, mesh) => count + mesh.geometry.index.count, 0));
    let cursor = 0, offset = 0;
    for (const mesh of meshes) {
        const source = mesh.geometry, count = source.attributes.position.count;
        for (let i = 0; i < source.index.count; i++) {
            const index = source.index.getX(i);
            if (!Number.isInteger(index) || index < 0 || index >= count) throw new Error('Shadow source index outside original vertices');
            indices[cursor++] = index + offset;
        }
        offset += count;
    }
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    return geometry;
}
