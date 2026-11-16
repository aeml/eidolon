import * as THREE from 'three';

const equal = (a, b) => a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
const maximumVertices = 1_000_000, maximumIndices = 3_000_000;

// Geometry-only prototype. Sources retain all color materials and vertices.
// No renderer hook, registration owner or default runtime selection lives here.
export function isOpaqueStaticShadowMesh(mesh) {
    const geometry = mesh?.geometry, material = mesh?.material, position = geometry?.attributes.position;
    return Boolean(mesh?.isMesh && !mesh.isSkinnedMesh && !mesh.isInstancedMesh && !mesh.isBatchedMesh && mesh.castShadow &&
        !Array.isArray(material) && (material?.isMeshStandardMaterial || material?.isMeshPhysicalMaterial || material?.isMeshBasicMaterial) &&
        material.visible && !material.transparent && material.opacity === 1 && !material.alphaTest && !material.alphaHash &&
        !material.alphaMap && !material.alphaToCoverage && !material.displacementMap && !material.clippingPlanes && !material.wireframe &&
        [THREE.FrontSide, THREE.BackSide, THREE.DoubleSide].includes(material.side) &&
        (material.shadowSide === null || [THREE.FrontSide, THREE.BackSide, THREE.DoubleSide].includes(material.shadowSide)) &&
        !mesh.customDepthMaterial && !mesh.customDistanceMaterial &&
        mesh.onBeforeShadow === THREE.Object3D.prototype.onBeforeShadow && mesh.onAfterShadow === THREE.Object3D.prototype.onAfterShadow &&
        geometry?.isBufferGeometry && geometry.drawRange.start === 0 && geometry.drawRange.count === Infinity &&
        Object.values(geometry.morphAttributes).every(values => values.length === 0) &&
        position && position.itemSize === 3 && Number.isSafeInteger(position.count) && position.count > 0 && !position.isInterleavedBufferAttribute &&
        !position.isGLBufferAttribute && !position.isInstancedBufferAttribute && !position.normalized && position.array instanceof Float32Array &&
        position.array.length === position.count * 3 &&
        (position.gpuType ?? THREE.FloatType) === THREE.FloatType &&
        (!geometry.index || !geometry.index.isInterleavedBufferAttribute && !geometry.index.isGLBufferAttribute && !geometry.index.normalized &&
            [Uint8Array, Uint16Array, Uint32Array].some(Type => geometry.index.array instanceof Type) &&
            geometry.index.itemSize === 1 && Number.isSafeInteger(geometry.index.count) && geometry.index.count > 0 &&
            geometry.index.array.length === geometry.index.count) &&
        (geometry.index?.count ?? position.count) % 3 === 0 && mesh.matrixWorld.elements.every(Number.isFinite));
}

const compatible = (a, b) => a.layers.mask === b.layers.mask && a.material.side === b.material.side &&
    a.material.shadowSide === b.material.shadowSide && equal(a.matrixWorld.elements, b.matrixWorld.elements);

export function haveCompatibleOpaqueStaticShadowState(meshes) {
    return Array.isArray(meshes) && meshes.length > 1 && new Set(meshes).size === meshes.length &&
        meshes.every(mesh => isOpaqueStaticShadowMesh(mesh) && compatible(meshes[0], mesh));
}

export function groupOpaqueStaticShadowMeshes(root) {
    root.updateWorldMatrix(true, true);
    const groups = [];
    root.traverseVisible(mesh => {
        if (!isOpaqueStaticShadowMesh(mesh)) return;
        const group = groups.find(parts => compatible(parts[0], mesh));
        if (group) group.push(mesh); else groups.push([mesh]);
    });
    return groups.filter(parts => parts.length > 1);
}

export function createOpaqueStaticShadowGeometry(meshes) {
    if (!haveCompatibleOpaqueStaticShadowState(meshes)) throw Error('Exact opaque static shadow state required');
    const vertices = meshes.reduce((count, mesh) => count + mesh.geometry.attributes.position.count, 0);
    const count = meshes.reduce((count, mesh) => count + (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count), 0);
    if (!Number.isSafeInteger(vertices) || vertices > maximumVertices || !Number.isSafeInteger(count) || count > maximumIndices)
        throw Error('Static shadow geometry exceeds bounded allocation');
    const positions = new Float32Array(vertices * 3), indices = new Uint32Array(count);
    let vertexOffset = 0, indexOffset = 0;
    for (const mesh of meshes) {
        const geometry = mesh.geometry, source = geometry.attributes.position;
        if (!source.array.every(Number.isFinite)) throw Error('Non-finite shadow source position');
        positions.set(source.array, vertexOffset * 3);
        const sourceCount = geometry.index?.count ?? source.count;
        for (let i = 0; i < sourceCount; i++) {
            const index = geometry.index ? geometry.index.getX(i) : i;
            if (!Number.isInteger(index) || index < 0 || index >= source.count) throw Error('Shadow source index outside original vertices');
            indices[indexOffset++] = vertexOffset + index;
        }
        vertexOffset += source.count;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    // Stock Three shadows ignore geometry.groups for a single material. Keep
    // that exact full-index behavior, including single-material box primitives.
    return geometry;
}
