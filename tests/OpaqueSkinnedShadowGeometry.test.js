import * as THREE from 'three';
import { groupOpaqueSkinnedShadowMeshes, createOpaqueSkinnedShadowGeometry } from '../src/core/OpaqueSkinnedShadowGeometry.js';

function fixture() {
    const root = new THREE.Group(), bone = new THREE.Bone(); root.add(bone);
    const skeleton = new THREE.Skeleton([bone]), meshes = [];
    for (const x of [0, 2]) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute([x, -0, 0, x + 1, 0, 0, x, 1, 0], 3));
        geometry.setAttribute('skinIndex', new THREE.Uint8BufferAttribute(new Uint8Array(12), 4));
        geometry.setAttribute('skinWeight', new THREE.Uint8BufferAttribute([255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0], 4, true));
        geometry.setIndex([0, 1, 2]);
        const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial({ color: x ? 0x884422 : 0x228844 }));
        root.add(mesh); mesh.bind(skeleton); mesh.castShadow = true; meshes.push(mesh);
    }
    root.updateMatrixWorld(true); return { root, meshes, bone, skeleton };
}

test('concatenates every original triangle and raw skin value into independent depth-only buffers', () => {
    const { root, meshes } = fixture(), original = meshes.map(mesh => mesh.geometry);
    expect(groupOpaqueSkinnedShadowMeshes(root)).toEqual([meshes]);
    const result = createOpaqueSkinnedShadowGeometry(meshes);
    expect(Object.keys(result.attributes)).toEqual(['position', 'skinIndex', 'skinWeight']);
    expect([...result.index.array]).toEqual([0, 1, 2, 3, 4, 5]);
    for (const name of Object.keys(result.attributes)) {
        expect([...result.attributes[name].array]).toEqual(original.flatMap(g => [...g.attributes[name].array]));
        for (const source of original) expect(result.attributes[name].array).not.toBe(source.attributes[name].array);
        expect(result.attributes[name].normalized).toBe(original[0].attributes[name].normalized);
    }
    expect(Object.is(result.attributes.position.array[1], -0)).toBe(true);
    expect(meshes.map(mesh => mesh.geometry)).toEqual(original); result.dispose();
});

test('deinterleaves exact raw storage without normalizing weights or losing signed zero', () => {
    const { root, meshes } = fixture();
    for (const mesh of meshes) for (const name of ['position', 'skinIndex', 'skinWeight']) {
        const source = mesh.geometry.attributes[name], array = new source.array.constructor(source.count * (source.itemSize + 1));
        for (let v = 0; v < source.count; v++) {
            array[v * (source.itemSize + 1)] = 17;
            for (let c = 0; c < source.itemSize; c++) array[v * (source.itemSize + 1) + c + 1] = source.array[v * source.itemSize + c];
        }
        mesh.geometry.setAttribute(name, new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(array, source.itemSize + 1), source.itemSize, 1, source.normalized));
    }
    expect(groupOpaqueSkinnedShadowMeshes(root)).toEqual([meshes]);
    const result = createOpaqueSkinnedShadowGeometry(meshes);
    expect([...result.attributes.skinWeight.array]).toEqual(Array(6).fill([255, 0, 0, 0]).flat());
    expect(result.attributes.skinWeight.normalized).toBe(true); expect(Object.is(result.attributes.position.array[1], -0)).toBe(true);
    expect(result.attributes.position.isInterleavedBufferAttribute).toBeUndefined(); result.dispose();
});

test.each(['bone', 'inverse', 'bind', 'bindInverse', 'bindMode', 'transform', 'layer', 'side', 'shadowSide', 'format', 'normalized', 'signedZero'])('%s mismatch keeps meshes separate and rejects manual combination', change => {
    const { root, meshes } = fixture(), other = meshes[1];
    if (change === 'bone') other.skeleton = new THREE.Skeleton([new THREE.Bone()]);
    if (change === 'inverse') other.skeleton = new THREE.Skeleton(other.skeleton.bones, [new THREE.Matrix4().makeTranslation(1, 0, 0)]);
    if (change === 'bind') other.bindMatrix.elements[12] = 1;
    if (change === 'bindInverse') { other.bindMode = meshes[0].bindMode = 'detached'; other.bindMatrixInverse.elements[12] = 1; }
    if (change === 'bindMode') other.bindMode = 'detached';
    if (change === 'transform') other.position.x = 1;
    if (change === 'layer') other.layers.set(2);
    if (change === 'side') other.material.side = THREE.DoubleSide;
    if (change === 'shadowSide') other.material.shadowSide = THREE.BackSide;
    if (change === 'format') other.geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Float32Array(12), 4));
    if (change === 'normalized') other.geometry.attributes.skinWeight.normalized = false;
    if (change === 'signedZero') other.bindMatrix.elements[12] = -0;
    expect(groupOpaqueSkinnedShadowMeshes(root)).toEqual([]);
    expect(() => createOpaqueSkinnedShadowGeometry(meshes)).toThrow(/exact skin/);
});

test.each(['morph', 'alphaTest', 'alphaHash', 'alphaMap', 'alphaToCoverage', 'transparent', 'opacity', 'displacementMap', 'clippingPlanes', 'wireframe', 'customDepthMaterial', 'customDistanceMaterial', 'onBeforeShadow', 'onAfterShadow', 'noShadow', 'groups', 'drawRange', 'jointNormalization', 'hidden', 'differentWeightGPUType'])('unsupported %s remains on its original route', change => {
    const { root, meshes } = fixture(), other = meshes[1];
    if (change === 'morph') other.geometry.morphAttributes.position = [other.geometry.attributes.position.clone()];
    if (['alphaTest', 'alphaHash', 'alphaToCoverage', 'transparent', 'wireframe'].includes(change)) other.material[change] = true;
    if (change === 'opacity') other.material.opacity = .9;
    if (['alphaMap', 'displacementMap'].includes(change)) other.material[change] = new THREE.Texture();
    if (change === 'clippingPlanes') other.material.clippingPlanes = [];
    if (['customDepthMaterial', 'customDistanceMaterial'].includes(change)) other[change] = new THREE.MeshDepthMaterial();
    if (['onBeforeShadow', 'onAfterShadow'].includes(change)) other[change] = () => {};
    if (change === 'noShadow') other.castShadow = false;
    if (change === 'groups') other.geometry.addGroup(0, 3, 0);
    if (change === 'drawRange') other.geometry.setDrawRange(0, 3);
    if (change === 'jointNormalization') other.geometry.attributes.skinIndex.normalized = true;
    if (change === 'hidden') other.visible = false;
    if (change === 'differentWeightGPUType') other.geometry.attributes.skinWeight.gpuType = THREE.IntType;
    expect(groupOpaqueSkinnedShadowMeshes(root)).toEqual([]);
});

test('new palettes may share only identical ordered bone objects and exact inverse matrices', () => {
    const { root, meshes } = fixture(); meshes[1].skeleton = new THREE.Skeleton(meshes[0].skeleton.bones, meshes[0].skeleton.boneInverses.map(m => m.clone()));
    expect(groupOpaqueSkinnedShadowMeshes(root)).toEqual([meshes]);
    expect(createOpaqueSkinnedShadowGeometry(meshes).index.count).toBe(6);
});

test('rejects duplicate sources, non-finite source data and out-of-range source indices', () => {
    const { meshes } = fixture();
    expect(() => createOpaqueSkinnedShadowGeometry([meshes[0], meshes[0]])).toThrow(/distinct/);
    meshes[1].geometry.attributes.position.array[0] = NaN;
    expect(() => createOpaqueSkinnedShadowGeometry(meshes)).toThrow(/Non-finite/);
    meshes[1].geometry.attributes.position.array[0] = 2; meshes[1].geometry.index.array[0] = 9;
    expect(() => createOpaqueSkinnedShadowGeometry(meshes)).toThrow(/outside original/);
});


test('invalid source joints retain the original path rather than indexing an unknown palette', () => {
    const { meshes } = fixture(); meshes[1].geometry.attributes.skinIndex.array[0] = 4;
    expect(() => createOpaqueSkinnedShadowGeometry(meshes)).toThrow(/outside original skeleton/);
});
