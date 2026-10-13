import * as THREE from 'three';
import { jest } from '@jest/globals';
import { OpaqueSkinnedShadowRuntime } from '../src/core/OpaqueSkinnedShadowRuntime.js';
import { ActorGameplayGeometry } from '../src/core/ActorGameplayGeometry.js';

function actor() {
    const root = new THREE.Group(), bone = new THREE.Bone(); root.add(bone);
    root.userData.authoredClass = 'Fighter'; root.userData.authoredQuality = 'high';
    const skeleton = new THREE.Skeleton([bone]);
    const meshes = [0, 1].map(x => {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute([x, 0, 0, x + 1, 0, 0, x + 1, 1, 0, x, 1, 0], 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(Array(4).fill([0, 0, 1]).flat(), 3));
        geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(16), 4));
        geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(Array(4).fill([1, 0, 0, 0]).flat(), 4));
        geometry.setIndex([0, 1, 2, 0, 2, 3]);
        const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial());
        root.add(mesh); mesh.bind(skeleton); mesh.castShadow = true; return mesh;
    });
    return { root, meshes };
}
function fixture() {
    const scene = new THREE.Scene(), group = new THREE.Group(); scene.add(group);
    const camera = new THREE.OrthographicCamera(-15, 15, 15, -15, .1, 100), light = new THREE.DirectionalLight();
    light.position.set(0, 0, 10); scene.add(light, light.target);
    const depths = [], colors = [], projections = [];
    const shadowMap = { enabled: true, autoUpdate: true, type: THREE.PCFSoftShadowMap, render: jest.fn((lights, currentScene) => {
        light.shadow.updateMatrices(light, 0);
        const casters = []; currentScene.traverseVisible(m => { if (m.isMesh && m.castShadow) casters.push(m); });
        depths.push(casters.map(m => ({ mesh: m, geometry: m.geometry, triangles: m.geometry.index.count / 3 })));
    }) };
    const renderer = { domElement: { height: 900 }, shadowMap, render: jest.fn((currentScene = scene, currentCamera = camera) => {
        currentScene.updateMatrixWorld(true);
        const capture = () => { const geometries = []; currentScene.traverse(m => { if (m.isSkinnedMesh) geometries.push(m.geometry); }); return geometries; };
        projections.push(capture()); shadowMap.render([light], currentScene, currentCamera); colors.push(capture());
    }) };
    return { scene, group, camera, light, depths, colors, projections, renderer, shadowMap };
}

test.each(['before', 'after'])('composes with actual gameplay geometry installed %s the shadow owner without steady-frame allocations', order => {
    const f = fixture(), a = actor(); f.group.add(a.root);
    let gameplay, runtime;
    const installGameplay = () => { gameplay = new ActorGameplayGeometry(f.renderer, f.scene, f.camera); for (const mesh of a.meshes) expect(gameplay.register(mesh, new Uint32Array([0, 1, 2]))).toBe(true); };
    if (order === 'before') installGameplay();
    runtime = new OpaqueSkinnedShadowRuntime(f.renderer, f.scene, [f.group]);
    if (order === 'after') installGameplay();
    const sources = a.meshes.map(m => m.geometry), derivatives = a.meshes.map(m => gameplay.entries.get(m).candidate);
    const register = jest.spyOn(runtime.owner, 'register');
    for (let i = 0; i < 3; i++) f.renderer.render(f.scene, f.camera);
    expect(register).toHaveBeenCalledTimes(1);
    expect(f.depths.map(d => d.map(m => m.triangles))).toEqual([[2], [2], [2]]);
    expect(f.projections).toEqual([derivatives, derivatives, derivatives]); expect(f.colors).toEqual(f.projections);
    expect(a.meshes.map(m => m.geometry)).toEqual(sources);
    const old = [...runtime.owner.entries][0], disposed = jest.spyOn(old.geometry, 'dispose');
    f.camera.zoom = 2; f.renderer.render(f.scene, f.camera);
    expect(disposed).toHaveBeenCalledTimes(1); expect(register).toHaveBeenCalledTimes(2);
    expect(f.depths.at(-1).map(m => m.triangles)).toEqual([4]); expect(f.colors.at(-1)).toEqual(sources);
    f.renderer.render(f.scene, f.camera); expect(register).toHaveBeenCalledTimes(2);
    f.camera.zoom = 1; f.renderer.render(f.scene, f.camera);
    expect(register).toHaveBeenCalledTimes(3); expect(runtime.owner.entries.size).toBe(1);
    expect(a.meshes.map(m => m.geometry)).toEqual(sources);
    // Retire wrappers in their installation order's reverse.
    if (order === 'after') { gameplay.dispose(); runtime.dispose(); } else { runtime.dispose(); gameplay.dispose(); }
});

test('equipment revision replaces owned buffers once and preserves every source', () => {
    const f = fixture(), a = actor(); f.group.add(a.root);
    const runtime = new OpaqueSkinnedShadowRuntime(f.renderer, f.scene, [f.group]);
    f.renderer.render(f.scene, f.camera); const old = [...runtime.owner.entries][0], disposed = jest.spyOn(old.geometry, 'dispose');
    const sources = a.meshes.map(mesh => jest.spyOn(mesh.geometry, 'dispose'));
    a.root.userData.equipmentVisualRevision = 1; f.renderer.render(f.scene, f.camera);
    expect(disposed).toHaveBeenCalledTimes(1); expect([...runtime.owner.entries][0]).not.toBe(old);
    f.renderer.render(f.scene, f.camera); expect(runtime.owner.entries.size).toBe(1);
    runtime.dispose(); sources.forEach(spy => expect(spy).not.toHaveBeenCalled());
});

test('source disposal cannot be resurrected by a late render; replacement identity can recover', () => {
    const f = fixture(), a = actor(); f.group.add(a.root);
    const runtime = new OpaqueSkinnedShadowRuntime(f.renderer, f.scene, [f.group]); f.renderer.render(f.scene, f.camera);
    const old = a.meshes[0].geometry; old.dispose();
    for (let i = 0; i < 3; i++) f.renderer.render(f.scene, f.camera);
    expect(runtime.owner.entries.size).toBe(0); expect(runtime.owner.lastSavedSubmissions).toBe(0);
    a.meshes[0].geometry = old.clone(); f.renderer.render(f.scene, f.camera);
    expect(runtime.owner.entries.size).toBe(1); expect(runtime.owner.lastSavedSubmissions).toBe(1); runtime.dispose();
});

test('geometry and skin generation changes rebuild only their actor', () => {
    const f = fixture(), a = actor(), b = actor(); f.group.add(a.root, b.root);
    const runtime = new OpaqueSkinnedShadowRuntime(f.renderer, f.scene, [f.group]); f.renderer.render(f.scene, f.camera);
    const entries = [...runtime.owner.entries], stable = entries.find(e => e.meshes.includes(b.meshes[0]));
    a.meshes[0].geometry.attributes.position.needsUpdate = true;
    f.renderer.render(f.scene, f.camera); expect(runtime.owner.entries.size).toBe(2); expect(runtime.owner.entries.has(stable)).toBe(true);
    const before = [...runtime.owner.entries].find(e => e !== stable);
    a.meshes[0].skeleton.boneInverses[0].elements[12] = .25; f.renderer.render(f.scene, f.camera);
    expect(runtime.owner.entries.has(before)).toBe(false); expect(runtime.owner.entries.has(stable)).toBe(true); runtime.dispose();
});

test.each([NaN, Infinity, -Infinity])('shared-palette checks reject a late %s inverse and recover on the next scan', value => {
    const f = fixture(), a = actor(), b = actor();
    const skeleton = a.meshes[0].skeleton;
    for (let i = 1; i < 53; i++) {
        const bone = new THREE.Bone(); a.root.add(bone);
        skeleton.bones.push(bone); skeleton.boneInverses.push(new THREE.Matrix4());
    }
    f.group.add(a.root, b.root);
    const runtime = new OpaqueSkinnedShadowRuntime(f.renderer, f.scene, [f.group]);
    f.renderer.render(f.scene, f.camera);
    expect(runtime.owner.entries.size).toBe(2);
    const stable = [...runtime.owner.entries].find(entry => entry.meshes.includes(b.meshes[0]));
    const inverse = skeleton.boneInverses[52].elements, original = inverse[12];
    inverse[12] = value; f.renderer.render(f.scene, f.camera);
    expect(runtime.owner.entries.size).toBe(1); expect(runtime.owner.entries.has(stable)).toBe(true);
    inverse[12] = original; f.renderer.render(f.scene, f.camera);
    expect(runtime.owner.entries.size).toBe(2); expect(runtime.owner.entries.has(stable)).toBe(true);
    runtime.dispose();
});

test('streaming actor arrivals, pool reuse and detached ownership groups retire exact owned resources', () => {
    const f = fixture(), runtime = new OpaqueSkinnedShadowRuntime(f.renderer, f.scene, [f.scene, f.group, f.group]);
    const a = actor(); f.group.add(a.root); f.renderer.render(f.scene, f.camera);
    const entry = [...runtime.owner.entries][0], geometry = jest.spyOn(entry.geometry, 'dispose'), material = jest.spyOn(entry.material, 'dispose');
    f.group.removeFromParent(); expect(runtime.roots.size).toBe(0); expect(runtime.owner.entries.size).toBe(0);
    expect(geometry).toHaveBeenCalledTimes(1); expect(material).toHaveBeenCalledTimes(1);
    const b = actor(); f.group.add(b.root); expect(runtime.roots.size).toBe(0);
    f.scene.add(f.group); expect(runtime.roots.size).toBe(2); f.renderer.render(f.scene, f.camera); expect(runtime.owner.entries.size).toBe(2);
    a.root.removeFromParent(); f.scene.add(a.root); expect(runtime.roots.size).toBe(2);
    runtime.dispose(); runtime.dispose(); expect(runtime.owner.entries.size).toBe(0); expect(geometry).toHaveBeenCalledTimes(1);
});

test.each(['disabled-shadow', 'disabled-owner', 'fullscreen', 'custom-hook'])('%s never constructs actor shadow buffers', mode => {
    const f = fixture(), a = actor(); f.group.add(a.root);
    const runtime = new OpaqueSkinnedShadowRuntime(f.renderer, f.scene, [f.group]), register = jest.spyOn(runtime.owner, 'register');
    if (mode === 'disabled-shadow') f.shadowMap.enabled = false;
    if (mode === 'disabled-owner') runtime.owner.enabled = false;
    if (mode === 'custom-hook') a.meshes[0].onBeforeShadow = () => {};
    f.renderer.render(mode === 'fullscreen' ? new THREE.Scene() : f.scene, f.camera);
    expect(register).not.toHaveBeenCalled(); expect(runtime.owner.entries.size).toBe(0); runtime.dispose();
});

test('scenery changes do not traverse scenery or retain actor listeners after clear and shutdown', () => {
    const f = fixture(), runtime = new OpaqueSkinnedShadowRuntime(f.renderer, f.scene, [f.scene, f.group]);
    const scenery = new THREE.Group(), traverse = jest.spyOn(scenery, 'traverse'); f.scene.add(scenery);
    expect(traverse).not.toHaveBeenCalled(); expect(runtime.roots.size).toBe(0);
    const a = actor(); f.group.add(a.root); f.renderer.render(f.scene, f.camera);
    const observer = jest.fn(); f.group.addEventListener('childadded', observer);
    runtime.clear(); expect(runtime.roots.size).toBe(0); expect(runtime.owner.entries.size).toBe(0);
    a.root.removeFromParent(); f.group.add(a.root); expect(runtime.roots.size).toBe(1);
    runtime.dispose(); f.group.add(actor().root); expect(runtime.roots.size).toBe(0); expect(observer).toHaveBeenCalledTimes(2);
});

test('original Ilyra root participates without treating arbitrary NPCs as supported actors', () => {
    const f = fixture(), a = actor(), b = actor(); delete a.root.userData.authoredClass; delete b.root.userData.authoredClass;
    a.root.userData.npcAppearance = 'ilyra-fourfold-archmage'; b.root.userData.npcAppearance = 'unqualified'; f.group.add(a.root, b.root);
    const runtime = new OpaqueSkinnedShadowRuntime(f.renderer, f.scene, [f.group]); f.renderer.render(f.scene, f.camera);
    expect(runtime.roots.size).toBe(1); expect(runtime.owner.lastSavedSubmissions).toBe(1); runtime.dispose();
});

test.each(['hidden-root', 'hidden-part', 'alpha', 'side'])('initial %s fallback recovers when live compatibility returns', mode => {
    const f = fixture(), a = actor(); f.group.add(a.root);
    if (mode === 'hidden-root') a.root.visible = false;
    if (mode === 'hidden-part') a.meshes[0].visible = false;
    if (mode === 'alpha') a.meshes[0].material.alphaTest = .5;
    if (mode === 'side') a.meshes[0].material.side = THREE.BackSide;
    const runtime = new OpaqueSkinnedShadowRuntime(f.renderer, f.scene, [f.group]);
    f.renderer.render(f.scene, f.camera); expect(runtime.owner.entries.size).toBe(0);
    a.root.visible = true; a.meshes[0].visible = true; a.meshes[0].material.alphaTest = 0; a.meshes[0].material.side = THREE.FrontSide;
    f.renderer.render(f.scene, f.camera); expect(runtime.owner.lastSavedSubmissions).toBe(1);
    const entry = [...runtime.owner.entries][0]; f.renderer.render(f.scene, f.camera); expect(runtime.owner.entries.has(entry)).toBe(true); runtime.dispose();
});

test('stock shadow exceptions restore geometry, caster flags and light hooks before the next frame', () => {
    const f = fixture(), a = actor(); f.group.add(a.root);
    const gameplay = new ActorGameplayGeometry(f.renderer, f.scene, f.camera);
    for (const mesh of a.meshes) gameplay.register(mesh, new Uint32Array([0, 1, 2]));
    const stock = f.shadowMap.render, original = stock.getMockImplementation();
    const runtime = new OpaqueSkinnedShadowRuntime(f.renderer, f.scene, [f.group]);
    const sources = a.meshes.map(m => m.geometry), lightHook = f.light.shadow.updateMatrices;
    stock.mockImplementationOnce((...args) => { original(...args); throw Error('stock shadow failure'); });
    expect(() => f.renderer.render(f.scene, f.camera)).toThrow('stock shadow failure');
    expect(a.meshes.map(m => m.geometry)).toEqual(sources); expect(a.meshes.every(m => m.castShadow)).toBe(true);
    expect(f.scene.children.some(n => n.name === 'OpaqueSkinnedShadowBatch')).toBe(false);
    expect(f.light.shadow.updateMatrices).toBe(lightHook); expect(runtime.owner.depth).toBe(0);
    f.renderer.render(f.scene, f.camera); expect(runtime.owner.lastSavedSubmissions).toBe(1);
    runtime.dispose(); gameplay.dispose();
});

test('nested fullscreen render uses originals without rebuilding the outer frame geometry', () => {
    const f = fixture(), a = actor(); f.group.add(a.root);
    const gameplay = new ActorGameplayGeometry(f.renderer, f.scene, f.camera);
    for (const mesh of a.meshes) gameplay.register(mesh, new Uint32Array([0, 1, 2]));
    const stock = f.shadowMap.render, original = stock.getMockImplementation(); let nested = false;
    const runtime = new OpaqueSkinnedShadowRuntime(f.renderer, f.scene, [f.group]), prepare = jest.spyOn(runtime, 'synchronize');
    stock.mockImplementation((...args) => { original(...args); if (!nested) { nested = true; f.renderer.render(new THREE.Scene(), f.camera); } });
    f.renderer.render(f.scene, f.camera);
    expect(prepare).toHaveBeenCalledTimes(1); expect(runtime.owner.entries.size).toBe(1);
    expect(runtime.owner.lastSavedSubmissions).toBe(1); expect(runtime.owner.active).toEqual([]);
    expect(a.meshes.every(m => m.castShadow)).toBe(true); runtime.dispose(); gameplay.dispose();
});
