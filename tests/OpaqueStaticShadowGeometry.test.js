import * as THREE from 'three';
import { createOpaqueStaticShadowGeometry, groupOpaqueStaticShadowMeshes,
    haveCompatibleOpaqueStaticShadowState, isOpaqueStaticShadowMesh } from '../src/core/OpaqueStaticShadowGeometry.js';

function fixture() {
    const root = new THREE.Group(); root.position.set(12, .5, -20); root.rotation.y = .4;
    const a = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 3), new THREE.MeshStandardMaterial({ color: 0x884422 }));
    const b = new THREE.Mesh(new THREE.ConeGeometry(1, 2, 7).toNonIndexed(), new THREE.MeshStandardMaterial({ color: 0x112244 }));
    for (const mesh of [a, b]) { mesh.castShadow = true; mesh.material.shadowSide = THREE.FrontSide; root.add(mesh); }
    root.updateWorldMatrix(true, true); return { root, a, b, meshes: [a, b] };
}

test('single-material groups retain every exact raw position and ordered triangle without transform baking', () => {
    const { root, a, b, meshes } = fixture(), positions = meshes.map(mesh => mesh.geometry.attributes.position.array.slice()),
        sourceIndex = a.geometry.index.array.slice(), matrices = meshes.map(mesh => mesh.matrixWorld.toArray());
    expect(a.geometry.groups.length).toBeGreaterThan(0); expect(groupOpaqueStaticShadowMeshes(root)).toEqual([meshes]);
    const result = createOpaqueStaticShadowGeometry(meshes), array = result.attributes.position.array;
    expect(array.slice(0, positions[0].length)).toEqual(positions[0]); expect(array.slice(positions[0].length)).toEqual(positions[1]);
    expect([...result.index.array]).toEqual([...sourceIndex, ...Array.from({ length: b.geometry.attributes.position.count }, (_, i) => i + a.geometry.attributes.position.count)]);
    for (let i = 0; i < meshes.length; i++) { expect(meshes[i].geometry.attributes.position.array).toEqual(positions[i]); expect(meshes[i].matrixWorld.toArray()).toEqual(matrices[i]); }
    array[0] += 1; result.index.array[0] = 7;
    expect(a.geometry.attributes.position.array).toEqual(positions[0]); expect(a.geometry.index.array).toEqual(sourceIndex);
    expect(Object.keys(result.attributes)).toEqual(['position']); expect(result.groups).toEqual([]); result.dispose();
});

test('opaque color maps and different color shader callbacks retain compatible stock depth state', () => {
    const { a, b, meshes } = fixture(); a.material.map = new THREE.Texture();
    b.material.onBeforeCompile = () => {}; b.material.roughness = .2; b.material.metalness = .8;
    expect(haveCompatibleOpaqueStaticShadowState(meshes)).toBe(true);
});

test('changed world transforms split groups and exact shared transforms recover', () => {
    const { root, b, meshes } = fixture(); b.position.x = 1;
    expect(groupOpaqueStaticShadowMeshes(root)).toEqual([]); b.position.x = 0;
    expect(groupOpaqueStaticShadowMeshes(root)).toEqual([meshes]);
    root.visible = false; expect(groupOpaqueStaticShadowMeshes(root)).toEqual([]);
});

test.each(['side', 'shadowSide', 'layers', 'transform'])('distinct %s state cannot merge', mode => {
    const { b, meshes } = fixture();
    if (mode === 'side') b.material.side = THREE.DoubleSide;
    if (mode === 'shadowSide') b.material.shadowSide = THREE.BackSide;
    if (mode === 'layers') b.layers.set(2);
    if (mode === 'transform') b.matrixWorld.elements[12] += 1;
    expect(haveCompatibleOpaqueStaticShadowState(meshes)).toBe(false);
    expect(() => createOpaqueStaticShadowGeometry(meshes)).toThrow('Exact opaque static');
});

test.each(['skinned', 'instanced', 'batched', 'transparent', 'opacity', 'alphaTest', 'alphaHash', 'alphaMap', 'coverage',
    'displacement', 'clipping', 'wireframe', 'hidden-material', 'custom-depth', 'custom-distance', 'before-shadow', 'after-shadow',
    'morph', 'draw-range', 'normalized-position', 'integer-position', 'gpu-position', 'position-count', 'index-count',
    'float-index', 'instanced-position', 'nonfinite-matrix', 'material-array'])(
    '%s uses original shadow rendering', mode => {
        const { a } = fixture();
        if (mode === 'skinned') a.isSkinnedMesh = true;
        if (mode === 'instanced') a.isInstancedMesh = true;
        if (mode === 'batched') a.isBatchedMesh = true;
        if (mode === 'transparent') a.material.transparent = true;
        if (mode === 'opacity') a.material.opacity = .5;
        if (mode === 'alphaTest') a.material.alphaTest = .1;
        if (mode === 'alphaHash') a.material.alphaHash = true;
        if (mode === 'alphaMap') a.material.alphaMap = new THREE.Texture();
        if (mode === 'coverage') a.material.alphaToCoverage = true;
        if (mode === 'displacement') a.material.displacementMap = new THREE.Texture();
        if (mode === 'clipping') a.material.clippingPlanes = [new THREE.Plane()];
        if (mode === 'wireframe') a.material.wireframe = true;
        if (mode === 'hidden-material') a.material.visible = false;
        if (mode === 'custom-depth') a.customDepthMaterial = new THREE.MeshDepthMaterial();
        if (mode === 'custom-distance') a.customDistanceMaterial = new THREE.MeshDistanceMaterial();
        if (mode === 'before-shadow') a.onBeforeShadow = () => {};
        if (mode === 'after-shadow') a.onAfterShadow = () => {};
        if (mode === 'morph') a.geometry.morphAttributes.position = [a.geometry.attributes.position.clone()];
        if (mode === 'draw-range') a.geometry.setDrawRange(0, 3);
        if (mode === 'normalized-position') a.geometry.attributes.position.normalized = true;
        if (mode === 'integer-position') a.geometry.attributes.position.array = new Int32Array(a.geometry.attributes.position.array);
        if (mode === 'gpu-position') a.geometry.attributes.position.gpuType = THREE.IntType;
        if (mode === 'position-count') a.geometry.attributes.position.count++;
        if (mode === 'index-count') a.geometry.index.count -= 3;
        if (mode === 'float-index') a.geometry.index.array = new Float32Array(a.geometry.index.array);
        if (mode === 'instanced-position') a.geometry.attributes.position.isInstancedBufferAttribute = true;
        if (mode === 'nonfinite-matrix') a.matrixWorld.elements[0] = NaN;
        if (mode === 'material-array') a.material = [a.material];
        expect(isOpaqueStaticShadowMesh(a)).toBe(false);
    });

test.each(['position', 'index'])('malformed %s data rejects construction without altering the source', mode => {
    const { a, meshes } = fixture();
    if (mode === 'position') a.geometry.attributes.position.array[0] = Infinity;
    else a.geometry.index.array[0] = 65535;
    const original = a.geometry.attributes.position.array.slice();
    expect(() => createOpaqueStaticShadowGeometry(meshes)).toThrow(mode === 'position' ? 'Non-finite' : 'outside original');
    expect(a.geometry.attributes.position.array).toEqual(original);
});

test('duplicate or unbounded sources cannot allocate a shadow geometry', () => {
    const { a, meshes } = fixture();
    expect(() => createOpaqueStaticShadowGeometry([a, a])).toThrow('Exact opaque static');
    const oversized = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(1_500_003), 3));
    for (const mesh of meshes) mesh.geometry = oversized;
    expect(() => createOpaqueStaticShadowGeometry(meshes)).toThrow('bounded allocation');
});
