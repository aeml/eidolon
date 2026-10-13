import * as THREE from 'three';
import { groupOpaqueSkinnedShadowMeshes, haveCompatibleOpaqueSkinnedShadowState } from './OpaqueSkinnedShadowGeometry.js';

const storage = attribute => attribute.isInterleavedBufferAttribute
    ? { array: attribute.data.array, stride: attribute.data.stride, offset: attribute.offset }
    : { array: attribute.array, stride: attribute.itemSize, offset: 0 };
const visible = mesh => { for (let node = mesh; node; node = node.parent) if (!node.visible) return false; return true; };
const stockColor = mesh => {
    const material = mesh.material;
    return visible(mesh) && mesh.parent && material?.type === 'MeshStandardMaterial' &&
        material.onBeforeCompile === THREE.Material.prototype.onBeforeCompile &&
        material.customProgramCacheKey === THREE.Material.prototype.customProgramCacheKey &&
        material.onBeforeRender === THREE.Material.prototype.onBeforeRender &&
        mesh.onBeforeRender === THREE.Object3D.prototype.onBeforeRender &&
        mesh.onAfterRender === THREE.Object3D.prototype.onAfterRender &&
        material.blending === THREE.NormalBlending && material.depthTest && material.depthWrite &&
        material.colorWrite && !material.polygonOffset && !material.stencilWrite &&
        Object.values(mesh.geometry.attributes).every(attribute => !attribute.isInstancedBufferAttribute &&
            !attribute.isGLBufferAttribute && (attribute.gpuType ?? THREE.FloatType) === THREE.FloatType && attribute.count === mesh.geometry.attributes.position.count &&
            Number.isInteger(attribute.itemSize) && attribute.itemSize > 0 && attribute.itemSize <= 4);
};
const sameColorState = (first, mesh) => {
    const names = Object.keys(first.geometry.attributes).sort(), other = Object.keys(mesh.geometry.attributes).sort();
    return first.parent === mesh.parent && first.material === mesh.material &&
        first.renderOrder === mesh.renderOrder && first.receiveShadow === mesh.receiveShadow &&
        first.castShadow === mesh.castShadow && names.length === other.length && names.every((name, i) => {
            if (name !== other[i]) return false;
            const a = first.geometry.attributes[name], b = mesh.geometry.attributes[name];
            return storage(a).array.constructor === storage(b).array.constructor &&
                Object.is(a.itemSize, b.itemSize) && Object.is(a.normalized, b.normalized) &&
                Object.is(a.gpuType ?? THREE.FloatType, b.gpuType ?? THREE.FloatType);
        });
};

// Conservative, opt-in geometry construction only. No renderer/default owner.
// The existing exact skin-state guard also retains opaque shadow eligibility;
// color-only/noncasting sources remain untouched by this first prototype.
export function haveCompatibleOpaqueSkinnedColorState(meshes) {
    return haveCompatibleOpaqueSkinnedShadowState(meshes) && meshes.every(mesh =>
        stockColor(mesh) && sameColorState(meshes[0], mesh));
}

export function groupOpaqueSkinnedColorMeshes(root) {
    const groups = [];
    for (const skinGroup of groupOpaqueSkinnedShadowMeshes(root)) {
        const colorGroups = [];
        for (const mesh of skinGroup) {
            if (!stockColor(mesh)) continue;
            const group = colorGroups.find(parts => sameColorState(parts[0], mesh));
            if (group) group.push(mesh); else colorGroups.push([mesh]);
        }
        groups.push(...colorGroups.filter(parts => parts.length > 1));
    }
    return groups;
}

export function createOpaqueSkinnedColorGeometry(meshes) {
    if (!haveCompatibleOpaqueSkinnedColorState(meshes)) {
        throw new Error('Opaque color batch requires distinct sources with exact shared material, parent, skin and attributes');
    }
    const geometry = new THREE.BufferGeometry();
    const vertexCount = meshes.reduce((sum, mesh) => sum + mesh.geometry.attributes.position.count, 0);
    const indexCount = meshes.reduce((sum, mesh) => sum + mesh.geometry.index.count, 0);
    if (!Number.isSafeInteger(vertexCount) || vertexCount > 0xffffffff || !Number.isSafeInteger(indexCount)) {
        throw new Error('Opaque color batch exceeds source index capacity');
    }
    for (const name of Object.keys(meshes[0].geometry.attributes)) {
        const first = meshes[0].geometry.attributes[name], array = new (storage(first).array.constructor)(vertexCount * first.itemSize);
        let cursor = 0;
        for (const mesh of meshes) {
            const attribute = mesh.geometry.attributes[name], packed = storage(attribute);
            for (let vertex = 0; vertex < attribute.count; vertex++) for (let channel = 0; channel < attribute.itemSize; channel++) {
                const value = packed.array[vertex * packed.stride + packed.offset + channel];
                if (!Number.isFinite(value)) throw new Error('Non-finite original color attribute');
                if (name === 'skinIndex' && (!Number.isInteger(value) || value < 0 || value >= mesh.skeleton.bones.length)) {
                    throw new Error('Original color joint outside source skeleton');
                }
                array[cursor++] = value;
            }
        }
        const attribute = new THREE.BufferAttribute(array, first.itemSize, first.normalized);
        attribute.gpuType = first.gpuType ?? THREE.FloatType;
        geometry.setAttribute(name, attribute);
    }
    const indices = new Uint32Array(indexCount); let cursor = 0, offset = 0;
    for (const mesh of meshes) {
        for (const index of mesh.geometry.index.array) {
            if (!Number.isInteger(index) || index < 0 || index >= mesh.geometry.attributes.position.count) {
                throw new Error('Original color index outside source vertices');
            }
            indices[cursor++] = index + offset;
        }
        offset += mesh.geometry.attributes.position.count;
    }
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    return geometry;
}
