import * as THREE from 'three';
import { createOpaqueSkinnedColorGeometry, groupOpaqueSkinnedColorMeshes } from '../src/core/OpaqueSkinnedColorGeometry.js';

function fixture() {
    const root = new THREE.Group(), bone = new THREE.Bone(), material = new THREE.MeshStandardMaterial();
    root.add(bone); const skeleton = new THREE.Skeleton([bone]), meshes = [];
    for (const x of [0, 2]) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute([x, -0, 0, x + 1, 0, 0, x, 1, 0], 3));
        geometry.setAttribute('normal', new THREE.Int8BufferAttribute([0, 0, 127, 0, 0, 127, 0, 0, 127], 3, true));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
        geometry.setAttribute('skinIndex', new THREE.Uint8BufferAttribute(new Uint8Array(12), 4));
        geometry.setAttribute('skinWeight', new THREE.Uint8BufferAttribute([255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0], 4, true));
        geometry.setIndex([0, 1, 2]);
        const mesh = new THREE.SkinnedMesh(geometry, material);root.add(mesh);mesh.bind(skeleton);mesh.castShadow = true;meshes.push(mesh);
    }
    root.updateMatrixWorld(true);return { root, meshes, material, skeleton };
}

test('full color construction preserves all original triangle/attribute values in independent buffers', () => {
    const { root, meshes } = fixture(), original = meshes.map(mesh => mesh.geometry);
    expect(groupOpaqueSkinnedColorMeshes(root)).toEqual([meshes]);
    const geometry = createOpaqueSkinnedColorGeometry(meshes);
    expect([...geometry.index.array]).toEqual([0, 1, 2, 3, 4, 5]);
    for (const [name, attribute] of Object.entries(geometry.attributes)) {
        expect([...attribute.array]).toEqual(original.flatMap(source => [...source.attributes[name].array]));
        expect(attribute.normalized).toBe(original[0].attributes[name].normalized);
        expect(attribute.array.constructor).toBe(original[0].attributes[name].array.constructor);
        expect(original.every(source => source.attributes[name].array !== attribute.array)).toBe(true);
    }
    expect(Object.is(geometry.attributes.position.array[1], -0)).toBe(true);
    expect(meshes.map(mesh => mesh.geometry)).toEqual(original);geometry.dispose();
});

test.each(['material','parent','receiveShadow','renderOrder','compile','materialRender','programKey','beforeRender','afterRender','blend','depthTest','depthWrite','colorWrite','polygonOffset','stencil','normalFormat','uvMissing','uvNormalized','uvGpuType','bone','inverse','bind','matrix','morph','groups','alpha','hidden','hiddenParent','allIntegerGPU','attributeCount'])('%s mismatch retains original sources', change => {
    const { root, meshes } = fixture(), other = meshes[1];
    if (change === 'material') other.material = other.material.clone();
    if (change === 'parent') { const parent = new THREE.Group();root.add(parent);parent.add(other); }
    if (['receiveShadow','renderOrder'].includes(change)) other[change] = 1;
    if (change === 'compile') other.material.onBeforeCompile = () => {};
    if (change === 'materialRender') other.material.onBeforeRender = () => {};
    if (change === 'programKey') other.material.customProgramCacheKey = () => 'private';
    if (change === 'beforeRender') other.onBeforeRender = () => {};
    if (change === 'afterRender') other.onAfterRender = () => {};
    if (change === 'blend') other.material.blending = THREE.AdditiveBlending;
    if (['depthTest','depthWrite','colorWrite'].includes(change)) other.material[change] = false;
    if (['polygonOffset','stencilWrite'].includes(change)) other.material[change] = true;
    if (change === 'stencil') other.material.stencilWrite = true;
    if (change === 'normalFormat') other.geometry.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(9), 3));
    if (change === 'uvMissing') other.geometry.deleteAttribute('uv');
    if (change === 'uvNormalized') other.geometry.attributes.uv.normalized = true;
    if (change === 'uvGpuType') other.geometry.attributes.uv.gpuType = THREE.IntType;
    if (change === 'bone') other.skeleton = new THREE.Skeleton([new THREE.Bone()]);
    if (change === 'inverse') other.skeleton = new THREE.Skeleton(other.skeleton.bones, [new THREE.Matrix4().makeTranslation(1, 0, 0)]);
    if (change === 'bind') other.bindMatrix.elements[12] = 1;
    if (change === 'matrix') other.position.x = 1;
    if (change === 'morph') other.geometry.morphAttributes.position = [other.geometry.attributes.position.clone()];
    if (change === 'groups') other.geometry.addGroup(0, 3, 0);
    if (change === 'alpha') other.material.alphaTest = .1;
    if (change === 'hiddenParent') root.visible = false;
    if (change === 'allIntegerGPU') for (const mesh of meshes) mesh.geometry.attributes.normal.gpuType = THREE.IntType;
    if (change === 'attributeCount') other.geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0,0],2));
    if (change === 'hidden') other.visible = false;
    expect(groupOpaqueSkinnedColorMeshes(root)).toEqual([]);
    expect(() => createOpaqueSkinnedColorGeometry(meshes)).toThrow(/exact/);
});

test('deinterleaves signed-zero UVs and normalized raw normals without changing source arrays', () => {
    const { root, meshes } = fixture();
    for (const mesh of meshes) {
        mesh.geometry.setAttribute('uv', new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(new Float32Array([5, -0, 0, 5, 1, 0, 5, 0, 1]), 3), 2, 1));
    }
    expect(groupOpaqueSkinnedColorMeshes(root)).toEqual([meshes]);
    const geometry = createOpaqueSkinnedColorGeometry(meshes);
    expect(Object.is(geometry.attributes.uv.array[0], -0)).toBe(true);
    expect(geometry.attributes.normal.array[2]).toBe(127);geometry.dispose();
});

test('duplicate sources, corrupt normals, unknown joints and out-of-range indices fail construction', () => {
    const { meshes } = fixture();
    expect(() => createOpaqueSkinnedColorGeometry([meshes[0],meshes[0]])).toThrow(/distinct/);
    meshes[1].geometry.attributes.uv.array[0] = NaN;
    expect(() => createOpaqueSkinnedColorGeometry(meshes)).toThrow(/Non-finite/);
    meshes[1].geometry.attributes.uv.array[0] = 0;meshes[1].geometry.attributes.skinIndex.array[0] = 2;
    expect(() => createOpaqueSkinnedColorGeometry(meshes)).toThrow(/joint/);
    meshes[1].geometry.attributes.skinIndex.array[0] = 0;meshes[1].geometry.index.array[0] = 9;
    expect(() => createOpaqueSkinnedColorGeometry(meshes)).toThrow(/index/);
});

test('stock physical materials share only the same original material identity', () => {
    const { root, meshes } = fixture(), material = new THREE.MeshPhysicalMaterial({ clearcoat: .5, roughness: .3 });
    for (const mesh of meshes) mesh.material = material;
    expect(groupOpaqueSkinnedColorMeshes(root)).toEqual([meshes]);
    const geometry = createOpaqueSkinnedColorGeometry(meshes);expect(geometry.index.count).toBe(6);geometry.dispose();
    meshes[1].material = material.clone();expect(groupOpaqueSkinnedColorMeshes(root)).toEqual([]);
});

test('other stock material families stay on their original route', () => {
    const { root, meshes } = fixture(), material = new THREE.MeshBasicMaterial();
    for (const mesh of meshes) mesh.material = material;
    expect(groupOpaqueSkinnedColorMeshes(root)).toEqual([]);
    expect(() => createOpaqueSkinnedColorGeometry(meshes)).toThrow(/exact/);
});

test('transmissive physical surfaces retain their original renderer pass', () => {
    const { root, meshes } = fixture(), material = new THREE.MeshPhysicalMaterial({ transmission: .5 });
    for (const mesh of meshes) mesh.material = material;
    expect(groupOpaqueSkinnedColorMeshes(root)).toEqual([]);
    expect(() => createOpaqueSkinnedColorGeometry(meshes)).toThrow(/exact/);
});
