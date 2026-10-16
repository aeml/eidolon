import { jest } from '@jest/globals';
import * as THREE from 'three';
import { BatchedMaterialVariants } from '../src/art/BatchedMaterialVariants.js';
import { batchRigidSurfaceParts, isOwnedRigidSurfaceMaterial } from '../src/art/RigidSurfaceBatches.js';

test('separates material identity while synchronizing live values once per source/frame', () => {
    const pool = new BatchedMaterialVariants();
    const texture = new THREE.Texture(), source = new THREE.MeshStandardMaterial({ color: 0x123456, map: texture });
    source.defines.EXTRA = 7;
    const sourceDispose = jest.spyOn(source, 'dispose'), textureDispose = jest.spyOn(texture, 'dispose');
    pool.beginFrame(); const variant = pool.use(source); expect(pool.use(source)).toBe(variant); pool.endFrame();
    expect(variant).not.toBe(source); expect(variant.map).toBe(texture); expect(variant.defines).toEqual(source.defines);
    expect(variant.color).not.toBe(source.color); expect(variant.color.equals(source.color)).toBe(true);
    const version = variant.version;
    source.color.setHex(0xaabbcc); source.emissive.setHex(0x112233); source.roughness = .17; source.metalness = .83;
    source.normalScale.set(2, 3); source.envMapRotation.set(.1, .2, .3); source.userData.note = 'updated';
    pool.beginFrame(); expect(pool.use(source)).toBe(variant); expect(pool.use(source)).toBe(variant); pool.endFrame();
    expect(variant.color.equals(source.color)).toBe(true); expect(variant.emissive.equals(source.emissive)).toBe(true);
    expect(variant.roughness).toBe(.17); expect(variant.metalness).toBe(.83);
    expect(variant.normalScale.toArray()).toEqual([2, 3]); expect(variant.envMapRotation.toArray()).toEqual(source.envMapRotation.toArray());
    expect(variant.userData).toEqual(source.userData); expect(variant.version).toBe(version);
    source.side = THREE.DoubleSide; source.defines.EXTRA = 9; source.needsUpdate = true;
    pool.beginFrame(); pool.use(source); pool.use(source); pool.endFrame();
    expect(variant.version).toBe(version + 1); expect(variant.side).toBe(THREE.DoubleSide); expect(variant.defines.EXTRA).toBe(9);
    expect(pool.synchronizations).toBe(3); expect(pool.created).toBe(1);
    const dispose = jest.spyOn(variant, 'dispose'); pool.clear(); pool.clear();
    expect(dispose).toHaveBeenCalledTimes(1); expect(sourceDispose).not.toHaveBeenCalled(); expect(textureDispose).not.toHaveBeenCalled();
});

test('preserves the registered rigid-surface attribute shader contract', () => {
    const root = new THREE.Group(), source = new THREE.MeshStandardMaterial();
    root.userData.animations = [];
    root.userData.humanoidRenderBatches = { drawMeshes: 2 };
    for (let i = 0; i < 2; i++) {
        const geometry = new THREE.BoxGeometry(); geometry.clearGroups();
        const mesh = new THREE.Mesh(geometry, source); mesh.name = `leaf-${i}`; root.add(mesh);
    }
    batchRigidSurfaceParts(root);
    const owned = root.children.find(part => isOwnedRigidSurfaceMaterial(part.material))?.material;
    expect(owned).toBeDefined();
    const pool = new BatchedMaterialVariants(); pool.beginFrame(); const variant = pool.use(owned); pool.endFrame();
    const shader = () => ({ vertexShader: '#include <begin_vertex>', fragmentShader:
        'vec4 diffuseColor = vec4( diffuse, opacity );\nvec3 totalEmissiveRadiance = emissive;\n#include <roughnessmap_fragment>\n#include <metalnessmap_fragment>' });
    const before = shader(), after = shader(); owned.onBeforeCompile(before); variant.onBeforeCompile(after);
    expect(after).toEqual(before); expect(variant.customProgramCacheKey()).toBe(owned.customProgramCacheKey());
    expect(variant).not.toBe(owned); pool.clear();
});

test.each(['compile', 'cache-key', 'render-hook', 'physical', 'complex-metadata', 'accessor-metadata'])(
    'keeps unsupported %s material borrowed', mode => {
        const source = mode === 'physical' ? new THREE.MeshPhysicalMaterial() : new THREE.MeshStandardMaterial();
        if (mode === 'compile') source.onBeforeCompile = () => {};
        if (mode === 'cache-key') source.customProgramCacheKey = () => 'custom';
        if (mode === 'render-hook') source.onBeforeRender = () => {};
        if (mode === 'complex-metadata') source.userData.self = source.userData;
        if (mode === 'accessor-metadata') Object.defineProperty(source.userData, 'getter', { enumerable: true, get: () => { throw new Error('must not invoke'); } });
        const pool = new BatchedMaterialVariants(); pool.beginFrame(); expect(pool.use(source)).toBe(source); pool.endFrame();
        expect(pool.created).toBe(0); expect(pool.entries.size).toBe(0); pool.clear();
    });

test('retires an unused variant without disposing borrowed material or textures', () => {
    const source = new THREE.MeshStandardMaterial({ map: new THREE.Texture() }), pool = new BatchedMaterialVariants();
    pool.beginFrame(); const variant = pool.use(source); pool.endFrame();
    const dispose = jest.spyOn(variant, 'dispose'), sourceDispose = jest.spyOn(source, 'dispose'), mapDispose = jest.spyOn(source.map, 'dispose');
    pool.beginFrame(); pool.endFrame(); pool.clear();
    expect(dispose).toHaveBeenCalledTimes(1); expect(sourceDispose).not.toHaveBeenCalled(); expect(mapDispose).not.toHaveBeenCalled();
    expect(source._listeners.dispose).toEqual([]);
});

test('source disposal retires exactly its variant and permits ordinary later reuse', () => {
    const source = new THREE.MeshStandardMaterial(), pool = new BatchedMaterialVariants();
    pool.beginFrame(); const first = pool.use(source); pool.endFrame(); const dispose = jest.spyOn(first, 'dispose');
    source.dispose(); expect(dispose).toHaveBeenCalledTimes(1); expect(pool.entries.size).toBe(0);
    pool.beginFrame(); const second = pool.use(source); pool.endFrame(); expect(second).not.toBe(first);
    pool.clear(); expect(dispose).toHaveBeenCalledTimes(1); expect(pool.created).toBe(pool.retired);
});

test('a newly unsupported source returns to borrowed rendering and retires its prior variant', () => {
    const source = new THREE.MeshStandardMaterial(), pool = new BatchedMaterialVariants();
    pool.beginFrame(); const variant = pool.use(source); pool.endFrame(); const dispose = jest.spyOn(variant, 'dispose');
    source.onBeforeRender = () => {};
    pool.beginFrame(); expect(pool.use(source)).toBe(source); pool.endFrame();
    expect(dispose).toHaveBeenCalledTimes(1); expect(pool.entries.size).toBe(0); pool.clear();
});

test('copy failure falls back and retires a partial owned material without leaking a source listener', () => {
    const source = new THREE.MeshStandardMaterial(), pool = new BatchedMaterialVariants();
    const copy = jest.spyOn(THREE.MeshStandardMaterial.prototype, 'copy').mockImplementationOnce(() => { throw new Error('copy unavailable'); });
    const dispose = jest.spyOn(source, 'dispose');
    try {
        pool.beginFrame(); expect(pool.use(source)).toBe(source); pool.endFrame();
        expect(pool.created).toBe(1); expect(pool.retired).toBe(1); expect(pool.entries.size).toBe(0);
        expect(source._listeners.dispose).toEqual([]); expect(dispose).not.toHaveBeenCalled();
        pool.beginFrame(); expect(pool.use(source)).not.toBe(source); pool.endFrame(); pool.clear();
        expect(pool.created).toBe(pool.retired);
    } finally { copy.mockRestore(); }
});

test('inherited metadata serialization callbacks are not invoked by the variant owner', () => {
    const source = new THREE.MeshStandardMaterial(), pool = new BatchedMaterialVariants();
    const toJSON = jest.fn(() => { throw new Error('must not serialize a custom metadata prototype'); });
    source.userData = Object.create({ toJSON }); source.userData.label = 'primitive-own-value';
    pool.beginFrame(); expect(pool.use(source)).toBe(source); pool.endFrame();
    expect(toJSON).not.toHaveBeenCalled(); expect(pool.created).toBe(0); pool.clear();
});
