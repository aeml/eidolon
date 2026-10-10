import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hasTrustedEquipmentSurfaceMaps } from './AuthoredEquipmentSurfaces.js';
import { createFlatSurfaceMaterial } from './FittedEquipmentBatches.js';

function keyFor(mesh, serialization) {
    const geometry = mesh.geometry, material = mesh.material;
    if (!mesh.isMesh || mesh.isSkinnedMesh || mesh.isInstancedMesh || mesh.children.length || !mesh.visible ||
        Array.isArray(material) || material?.type !== 'MeshStandardMaterial' ||
        material.transparent || material.opacity !== 1 || !material.visible || material.vertexColors ||
        material.alphaTest || material.alphaHash || material.alphaMap || material.displacementMap || material.clippingPlanes ||
        material.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile ||
        material.onBeforeRender !== THREE.Material.prototype.onBeforeRender ||
        material.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey ||
        mesh.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender ||
        mesh.onAfterRender !== THREE.Object3D.prototype.onAfterRender ||
        mesh.onBeforeShadow !== THREE.Object3D.prototype.onBeforeShadow ||
        mesh.onAfterShadow !== THREE.Object3D.prototype.onAfterShadow ||
        mesh.customDepthMaterial || mesh.customDistanceMaterial ||
        Object.values(material).some(value => value?.isTexture) && !hasTrustedEquipmentSurfaceMaps(material) ||
        !geometry?.index || !geometry.attributes.position || !geometry.attributes.normal || !geometry.attributes.uv ||
        Object.keys(geometry.morphAttributes).length || geometry.groups.length ||
        geometry.drawRange.start !== 0 || geometry.drawRange.count !== Infinity ||
        Object.keys(geometry.attributes).some(name => !['position', 'normal', 'uv', 'tangent'].includes(name)) ||
        Object.values(geometry.attributes).some(attribute => attribute.isInterleavedBufferAttribute ||
            !(attribute.array instanceof Float32Array) || attribute.normalized) ||
        ![...material.color.toArray(), ...material.emissive.toArray(), material.roughness, material.metalness,
            material.emissiveIntensity].every(Number.isFinite)) return null;
    if (mesh.matrixAutoUpdate) mesh.updateMatrix();
    if (!mesh.matrix.elements.every(Number.isFinite)) return null;
    const appearance = material.toJSON(serialization);
    for (const field of ['uuid', 'name', 'metadata', 'userData', 'color', 'roughness', 'metalness', 'emissive', 'emissiveIntensity']) delete appearance[field];
    const layout = Object.entries(geometry.attributes).map(([name, attr]) => [name, attr.itemSize]).sort();
    // Keep each exact local transform and sibling parent. No fit/normal matrix
    // arithmetic is baked into source rows, including mirrored grip transforms.
    return JSON.stringify([appearance, layout, mesh.matrix.elements, mesh.castShadow, mesh.receiveShadow,
        mesh.renderOrder, mesh.layers.mask, mesh.frustumCulled]);
}

export function batchFittedRigidSurfaces(root) {
    const parents = []; root.traverse(node => { if (node.children.length) parents.push(node); });
    const serialization = { textures: {}, images: {} };
    let saved = 0;
    for (const parent of parents) {
        const buckets = new Map();
        for (const mesh of parent.children) {
            const key = keyFor(mesh, serialization);
            if (!key) continue;
            if (!buckets.has(key)) buckets.set(key, []);
            buckets.get(key).push(mesh);
        }
        for (const sources of buckets.values()) {
            if (sources.length < 2) continue;
            let vertexStart = 0, indexStart = 0;
            const partitions = [], copies = sources.map(source => {
                const geometry = source.geometry.clone(), count = geometry.attributes.position.count, material = source.material;
                const diffuse = new Float32Array(count * 4), emissive = new Float32Array(count * 4);
                const color = new Float32Array([...material.color.toArray(), material.roughness]);
                const glow = new Float32Array([...material.emissive.toArray().map(value => value * material.emissiveIntensity), material.metalness]);
                for (let i = 0; i < count; i++) { diffuse.set(color, i * 4); emissive.set(glow, i * 4); }
                geometry.setAttribute('fittedDiffuseRoughness', new THREE.Float32BufferAttribute(diffuse, 4));
                geometry.setAttribute('fittedEmissiveMetalness', new THREE.Float32BufferAttribute(emissive, 4));
                partitions.push(Object.freeze({ vertexStart, vertexCount: count, indexStart, indexCount: geometry.index.count }));
                vertexStart += count; indexStart += geometry.index.count;
                return geometry;
            });
            let geometry;
            try { geometry = mergeGeometries(copies, false); }
            finally { copies.forEach(copy => copy.dispose()); }
            if (!geometry) continue;
            geometry.userData.fittedRigidSurfacePartitions = Object.freeze(partitions);
            geometry.computeBoundingBox(); geometry.computeBoundingSphere();
            const first = sources[0], mesh = new THREE.Mesh(geometry, createFlatSurfaceMaterial(first.material));
            mesh.name = `FittedRigidBatch_${first.name}`;
            mesh.matrix.copy(first.matrix); mesh.matrixAutoUpdate = false;
            mesh.castShadow = first.castShadow; mesh.receiveShadow = first.receiveShadow;
            mesh.renderOrder = first.renderOrder; mesh.layers.mask = first.layers.mask; mesh.frustumCulled = first.frustumCulled;
            Object.assign(mesh.userData, { fittedOwnedGeometry: true, fittedBatchSources: sources.map(source => source.name) });
            for (const source of sources) { source.visible = false; source.userData.fittedBatchSource = true; }
            parent.add(mesh); saved += sources.length - 1;
        }
    }
    return saved;
}
