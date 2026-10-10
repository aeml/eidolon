import * as THREE from 'three';
import { jest } from '@jest/globals';
import { ActorGameplayGeometry } from '../src/core/ActorGameplayGeometry.js';
import { createFlatSurfaceMaterial } from '../src/art/FittedEquipmentBatches.js';

function fixture() {
    const source = new THREE.BufferGeometry();
    source.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3));
    source.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
    source.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(16), 4));
    source.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
    source.setIndex([0, 1, 2, 0, 2, 3]);
    source.morphAttributes.position = [new THREE.Float32BufferAttribute(new Float32Array(12), 3), new THREE.Float32BufferAttribute(new Float32Array(12), 3)];
    source.morphTargetsRelative = true;
    const mesh = new THREE.SkinnedMesh(source, new THREE.MeshStandardMaterial()), bone = new THREE.Bone();
    mesh.add(bone); mesh.bind(new THREE.Skeleton([bone]));
    const root = new THREE.Group(); root.userData.authoredClass = 'Fighter'; root.userData.authoredQuality = 'high'; root.add(mesh);
    const scene = new THREE.Scene(); scene.add(root);
    const camera = new THREE.OrthographicCamera(-15, 15, 15, -15, .1, 100);
    const seen = [], renderer = { domElement: { height: 900 }, render: jest.fn(() => seen.push(mesh.geometry)) };
    const pass = new ActorGameplayGeometry(renderer, scene, camera);
    const register = () => pass.register(mesh, new Uint32Array([0, 1, 2]));
    const draw = pixels => { camera.top = 450 / pixels; camera.bottom = -camera.top; renderer.render(scene, camera); return seen.at(-1); };
    return { source, mesh, root, scene, camera, renderer, pass, register, draw, seen };
}

test('render-owned selection preserves all source buffers and independent blink targets', () => {
    const f = fixture(); f.register();
    const candidate = f.pass.entries.get(f.mesh).candidate;
    expect(f.draw(30)).toBe(candidate); expect(f.mesh.geometry).toBe(f.source);
    for (const name of Object.keys(f.source.attributes)) {
        expect(candidate.attributes[name].array).toEqual(f.source.attributes[name].array);
        expect(candidate.attributes[name].array).not.toBe(f.source.attributes[name].array);
    }
    expect(candidate.morphAttributes.position).toHaveLength(2);
    expect(candidate.morphAttributes.position[0].array).not.toBe(f.source.morphAttributes.position[0].array);
    expect(candidate.morphAttributes.position[0].array).not.toBe(candidate.morphAttributes.position[1].array);
    const sourceDisposed = jest.fn(), candidateDisposed = jest.fn();
    f.source.addEventListener('dispose', sourceDisposed); candidate.addEventListener('dispose', candidateDisposed);
    f.pass.dispose(); f.pass.dispose();
    expect(candidateDisposed).toHaveBeenCalledTimes(1); expect(sourceDisposed).not.toHaveBeenCalled();
});

test('projected pixel hysteresis honors close zoom, resize and camera.zoom', () => {
    const f = fixture(); f.register(); const candidate = f.pass.entries.get(f.mesh).candidate;
    expect(f.draw(45)).toBe(f.source); expect(f.draw(42)).toBe(candidate);
    expect(f.draw(45)).toBe(candidate); expect(f.draw(47)).toBe(f.source);
    expect(f.draw(45)).toBe(f.source); f.camera.zoom = 2;
    expect(f.draw(30)).toBe(f.source); f.camera.zoom = 1;
    expect(f.draw(30)).toBe(candidate); f.renderer.domElement.height = 1800;
    expect(f.draw(30)).toBe(f.source); f.pass.dispose();
});

test('delivered interleaved buffers are independently cloned and their actual data versions retire candidates', () => {
    const f = fixture(), data = new THREE.InterleavedBuffer(new Float32Array([
        0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1
    ]), 6);
    f.source.setAttribute('position', new THREE.InterleavedBufferAttribute(data, 3, 0));
    f.source.setAttribute('normal', new THREE.InterleavedBufferAttribute(data, 3, 3));
    expect(f.register()).toBe(true);
    const candidate = f.pass.entries.get(f.mesh).candidate;
    expect(candidate.attributes.position.data.array).not.toBe(data.array);
    expect(candidate.attributes.position.data.array).toEqual(data.array);
    expect(f.draw(30)).toBe(candidate); data.needsUpdate = true;
    expect(f.draw(30)).toBe(f.source); expect(f.pass.entries.size).toBe(0); f.pass.dispose();
});

test('nested preview sees originals and outer gameplay resumes its own geometry', () => {
    const f = fixture(); f.register(); const candidate = f.pass.entries.get(f.mesh).candidate;
    let nested = false;
    f.pass.original.mockImplementation((scene, camera) => {
        if (nested) { expect(f.mesh.geometry).toBe(f.source); expect(camera).not.toBe(f.camera); return; }
        expect(f.mesh.geometry).toBe(candidate); nested = true;
        f.renderer.render(scene, new THREE.OrthographicCamera());
        expect(f.mesh.geometry).toBe(candidate);
    });
    f.draw(30); expect(f.mesh.geometry).toBe(f.source); expect(f.pass.active).toEqual([]); f.pass.dispose();
});

test('render failure preserves the exact thrown error and restores sources', () => {
    const f = fixture(); f.register(); const error = new Error('draw failure');
    f.pass.original.mockImplementation(() => { throw error; });
    expect(() => f.draw(30)).toThrow(error); expect(f.mesh.geometry).toBe(f.source);
    expect(f.pass.active).toEqual([]); f.pass.dispose();
});

test.each(['geometry', 'material', 'skeleton', 'bone', 'inverse', 'bind', 'attribute', 'attribute-version', 'index-version', 'morph-version', 'candidate-version', 'quality', 'detach'])(
    'a changed %s generation retires only its owned derivative', change => {
        const f = fixture(); f.register(); const candidate = f.pass.entries.get(f.mesh).candidate;
        const disposed = jest.fn(); candidate.addEventListener('dispose', disposed);
        if (change === 'geometry') f.mesh.geometry = f.source.clone();
        if (change === 'material') f.mesh.material = f.mesh.material.clone();
        if (change === 'skeleton') f.mesh.skeleton = new THREE.Skeleton([new THREE.Bone()]);
        if (change === 'bone') f.mesh.skeleton.bones[0] = new THREE.Bone();
        if (change === 'inverse') f.mesh.skeleton.boneInverses[0] = new THREE.Matrix4();
        if (change === 'bind') f.mesh.bindMatrix.elements[12] = 1;
        if (change === 'attribute') f.source.setAttribute('normal', f.source.attributes.normal.clone());
        if (change === 'attribute-version') f.source.attributes.position.needsUpdate = true;
        if (change === 'index-version') f.source.index.needsUpdate = true;
        if (change === 'morph-version') f.source.morphAttributes.position[1].needsUpdate = true;
        if (change === 'candidate-version') candidate.index.needsUpdate = true;
        if (change === 'quality') f.root.userData.authoredQuality = 'low';
        if (change === 'detach') f.root.removeFromParent();
        const current = f.mesh.geometry; expect(f.draw(30)).toBe(current);
        expect(f.mesh.geometry).toBe(current); expect(f.pass.entries.size).toBe(0); expect(disposed).toHaveBeenCalledTimes(1); f.pass.dispose();
    });

test.each(['transparent', 'alphaTest', 'shader', 'customDepth', 'hook', 'disabled', 'projection'])(
    '%s retains original geometry without discarding a valid source', change => {
        const f = fixture(); f.register();
        if (change === 'transparent') { f.mesh.material.transparent = true; f.mesh.material.opacity = .3; }
        if (change === 'alphaTest') f.mesh.material.alphaTest = .5;
        if (change === 'shader') { f.mesh.material.onBeforeCompile = () => {}; f.mesh.material.userData.fittedSurfaceAttributes = true; }
        if (change === 'customDepth') f.mesh.customDepthMaterial = new THREE.MeshDepthMaterial();
        if (change === 'hook') f.mesh.onBeforeRender = () => {};
        if (change === 'disabled') f.pass.enabled = false;
        if (change === 'projection') f.camera.zoom = NaN;
        expect(f.draw(30)).toBe(f.source); expect(f.pass.entries.size).toBe(1); f.pass.dispose();
    });

test('owned fitted PBR material is supported while a forged marker is insufficient', () => {
    const f = fixture(); f.mesh.material = createFlatSurfaceMaterial(f.mesh.material);
    expect(f.register()).toBe(true); expect(f.draw(30)).not.toBe(f.source); f.pass.dispose();
});

test('changing an owned fitted shader retains the source path', () => {
    const f = fixture(); f.mesh.material = createFlatSurfaceMaterial(f.mesh.material); f.register();
    f.mesh.material.onBeforeCompile = () => {};
    expect(f.draw(30)).toBe(f.source); f.pass.dispose();
});

test('source disposal, replacement registration and owner teardown remain bounded', () => {
    const f = fixture(); f.register(); const first = f.pass.entries.get(f.mesh).candidate, disposed = jest.fn();
    first.addEventListener('dispose', disposed); f.register(); expect(disposed).toHaveBeenCalledTimes(1);
    expect(f.pass.entries.size).toBe(1); f.source.dispose(); expect(f.pass.entries.size).toBe(0);
    expect(f.mesh.geometry).toBe(f.source); f.pass.dispose();
    const next = new ActorGameplayGeometry(f.renderer, f.scene, f.camera); next.dispose();
});

test('disabled selection still retires detached pooled actors', () => {
    const f = fixture(); f.register(); f.pass.enabled = false; f.root.removeFromParent();
    expect(f.draw(30)).toBe(f.source); expect(f.pass.entries.size).toBe(0); f.pass.dispose();
});

test('rejects duplicate owner and invalid indices before changing a registration', () => {
    const f = fixture(); f.register(); const candidate = f.pass.entries.get(f.mesh).candidate;
    expect(() => new ActorGameplayGeometry(f.renderer, f.scene, f.camera)).toThrow();
    for (const indices of [new Uint32Array(), new Uint32Array([0, 1, 4]), new Uint32Array([0, 1])]) {
        expect(() => f.pass.register(f.mesh, indices)).toThrow(); expect(f.pass.entries.get(f.mesh).candidate).toBe(candidate);
    }
    f.pass.dispose();
});
