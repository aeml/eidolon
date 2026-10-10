import * as THREE from 'three';
import { jest } from '@jest/globals';
import { ActorShadowGeometry, createOwnedShadowGeometry } from '../src/core/ActorShadowGeometry.js';

function fixture() {
    const source = new THREE.BufferGeometry();
    source.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3));
    source.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(16), 4));
    source.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
    source.setIndex([0, 1, 2, 0, 2, 3]);
    source.morphAttributes.position = [new THREE.Float32BufferAttribute(new Float32Array(12), 3)];
    source.morphTargetsRelative = true;
    const mesh = new THREE.SkinnedMesh(source, new THREE.MeshStandardMaterial());
    const bone = new THREE.Bone(); mesh.add(bone); mesh.bind(new THREE.Skeleton([bone])); mesh.castShadow = true;
    const scene = new THREE.Scene(); scene.add(mesh);
    const shadowMap = { enabled: true, type: THREE.PCFSoftShadowMap, render: jest.fn(() => mesh.geometry) };
    const projected = [], colored = [];
    const renderer = { shadowMap, render: jest.fn((scene, camera) => {
        projected.push(mesh.geometry); shadowMap.render([], scene, camera); colored.push(mesh.geometry);
    }) };
    const pass = new ActorShadowGeometry(renderer, scene);
    const candidate = createOwnedShadowGeometry(source, [0, 1, 2]);
    return { source, candidate, mesh, scene, shadowMap, renderer, projected, colored, pass };
}

test('native-pass boundary sees independent depth data while projection/color see originals', () => {
    const f = fixture(); const original = f.pass.original;
    expect(f.pass.register(f.mesh, f.candidate)).toBe(true);
    f.renderer.render(f.scene, {});
    expect(f.projected).toEqual([f.source]); expect(f.colored).toEqual([f.source]);
    expect(original.mock.results[0].value).toBe(f.candidate);
    expect(f.pass.lastSwaps).toBe(1); expect(f.mesh.geometry).toBe(f.source);
    for (const name of ['position', 'skinIndex', 'skinWeight']) expect(f.candidate.attributes[name].array).not.toBe(f.source.attributes[name].array);
    expect(f.candidate.morphAttributes.position[0].array).not.toBe(f.source.morphAttributes.position[0].array);
    f.pass.dispose();
});

test('shadow exceptions restore original geometry and retain the thrown failure', () => {
    const f = fixture(), failure = new Error('shadow failure'); f.pass.register(f.mesh, f.candidate);
    f.pass.original.mockImplementation(() => { expect(f.mesh.geometry).toBe(f.candidate); throw failure; });
    expect(() => f.renderer.render(f.scene, {})).toThrow(failure);
    expect(f.mesh.geometry).toBe(f.source); expect(f.pass.depth).toBe(0);
    f.pass.dispose();
});

test('nested renderer projection and color use original geometry before outer shadow resumes', () => {
    const f = fixture(); f.pass.register(f.mesh, f.candidate); let nested = false;
    f.pass.original.mockImplementation(() => {
        if (nested) { expect(f.mesh.geometry).toBe(f.source); return; }
        expect(f.mesh.geometry).toBe(f.candidate); nested = true;
        f.renderer.render(f.scene, {}); expect(f.mesh.geometry).toBe(f.candidate);
    });
    f.renderer.render(f.scene, {});
    expect(f.projected).toEqual([f.source, f.source]); expect(f.colored).toEqual([f.source, f.source]);
    expect(f.mesh.geometry).toBe(f.source); f.pass.dispose();
});

test.each(['geometry', 'position-version', 'index-version', 'morph-version', 'skeleton', 'detach'])('retired %s falls back and disposes only its owned candidate', change => {
    const f = fixture(), retired = jest.fn(), sourceDispose = jest.fn();
    f.candidate.addEventListener('dispose', retired); f.source.addEventListener('dispose', sourceDispose);
    f.pass.register(f.mesh, f.candidate);
    if (change === 'geometry') f.mesh.geometry = f.source.clone();
    if (change === 'position-version') f.source.attributes.position.needsUpdate = true;
    if (change === 'index-version') f.source.index.needsUpdate = true;
    if (change === 'morph-version') f.source.morphAttributes.position[0].needsUpdate = true;
    if (change === 'skeleton') f.mesh.skeleton = new THREE.Skeleton([new THREE.Bone()]);
    if (change === 'detach') f.mesh.removeFromParent();
    const current = f.mesh.geometry; f.renderer.render(f.scene, {});
    expect(f.mesh.geometry).toBe(current); expect(f.pass.entries.size).toBe(0);
    expect(retired).toHaveBeenCalledTimes(1); expect(sourceDispose).not.toHaveBeenCalled(); f.pass.dispose();
});

test.each(['transparent', 'alphaTest', 'alphaHash', 'displacementMap', 'clippingPlanes', 'customDepthMaterial', 'customDistanceMaterial', 'onBeforeShadow', 'disabled', 'VSM'])('unsupported live %s retains the exact original shadow route', change => {
    const f = fixture(); f.pass.register(f.mesh, f.candidate);
    if (change === 'transparent') { f.mesh.material.transparent = true; f.mesh.material.opacity = .3; }
    if (change === 'alphaTest') f.mesh.material.alphaTest = .5;
    if (change === 'alphaHash') f.mesh.material.alphaHash = true;
    if (change === 'displacementMap') f.mesh.material.displacementMap = new THREE.Texture();
    if (change === 'clippingPlanes') f.mesh.material.clippingPlanes = [];
    if (change === 'customDepthMaterial') f.mesh.customDepthMaterial = new THREE.MeshDepthMaterial();
    if (change === 'customDistanceMaterial') f.mesh.customDistanceMaterial = new THREE.MeshDistanceMaterial();
    if (change === 'onBeforeShadow') f.mesh.onBeforeShadow = () => {};
    if (change === 'disabled') f.shadowMap.enabled = false;
    if (change === 'VSM') f.shadowMap.type = THREE.VSMShadowMap;
    expect(f.shadowMap.render([], f.scene, {})).toBe(f.source);
    expect(f.pass.lastSwaps).toBe(0); f.pass.dispose();
});

test('source disposal retires shadow buffers; disposal preserves later renderer wrappers', () => {
    const f = fixture(), retired = jest.fn(); f.candidate.addEventListener('dispose', retired);
    f.pass.register(f.mesh, f.candidate); f.source.dispose();
    expect(retired).toHaveBeenCalledTimes(1); expect(f.pass.entries.size).toBe(0);
    const render = () => {}, shadow = () => {}; f.renderer.render = render; f.shadowMap.render = shadow;
    f.pass.dispose(); expect(f.renderer.render).toBe(render); expect(f.shadowMap.render).toBe(shadow);
});

test('rejects shared source buffers, newly referenced masked vertices and empty replacements', () => {
    const f = fixture();
    const shared = createOwnedShadowGeometry(f.source); shared.attributes.position = f.source.attributes.position;
    expect(() => f.pass.register(f.mesh, shared)).toThrow(/own exact/);
    const empty = createOwnedShadowGeometry(f.source, []); expect(() => f.pass.register(f.mesh, empty)).toThrow(/bounded triangle/);
    const invalid = createOwnedShadowGeometry(f.source, [0, 1, 10]); expect(() => f.pass.register(f.mesh, invalid)).toThrow(/new source vertex/);
    const wrongMorph = createOwnedShadowGeometry(f.source); wrongMorph.morphAttributes.position[0].array[0] = .1;
    expect(() => f.pass.register(f.mesh, wrongMorph)).toThrow(/own exact/);
    f.pass.dispose();
});

test('live blink influences and bone animation remain independent from geometry ownership', () => {
    const f = fixture(); f.pass.register(f.mesh, f.candidate);
    f.mesh.morphTargetInfluences[0] = .75; f.mesh.skeleton.bones[0].rotation.z = .5;
    f.mesh.updateMatrixWorld(true);
    expect(f.shadowMap.render([], f.scene, {})).toBe(f.candidate);
    expect(f.mesh.morphTargetInfluences).toEqual([.75]); expect(f.mesh.geometry).toBe(f.source); f.pass.dispose();
});

test('interleaved source attributes own compact raw copies and invalidate on data version changes', () => {
    const f = fixture(), packed = new Float32Array([99, 0, 0, 0, 99, 1, 0, 0, 99, 1, 1, 0, 99, 0, 1, 0]);
    const data = new THREE.InterleavedBuffer(packed, 4);
    f.source.setAttribute('position', new THREE.InterleavedBufferAttribute(data, 3, 1));
    const weights = new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0]);
    f.source.setAttribute('skinWeight', new THREE.BufferAttribute(weights, 4, true));
    const geometry = createOwnedShadowGeometry(f.source);
    expect(geometry.attributes.position.array).toEqual(new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]));
    expect(geometry.attributes.skinWeight.array).toEqual(weights); expect(geometry.attributes.skinWeight.normalized).toBe(true);
    expect(f.pass.register(f.mesh, geometry)).toBe(true);
    expect(f.shadowMap.render([], f.scene, {})).toBe(geometry);
    data.needsUpdate = true; expect(f.shadowMap.render([], f.scene, {})).toBe(f.source);
    expect(f.pass.entries.size).toBe(0); f.pass.dispose();
});
