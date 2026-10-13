import * as THREE from 'three';
import { jest } from '@jest/globals';
import { RenderSystem } from '../src/core/RenderSystem.js';

function actor() {
    const root = new THREE.Group(), bone = new THREE.Bone(); root.add(bone);
    root.userData.authoredClass = 'Fighter'; root.userData.authoredQuality = 'high';
    const skeleton = new THREE.Skeleton([bone]), meshes = [0, 1].map(x => {
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
    const render = new RenderSystem(false), depths = [];
    render.setActorShadowBatchesEnabled(false); render.setActorGameplayGeometryEnabled(false);
    const renderer = render.renderer, shadow = renderer.shadowMap;
    const originalShadow = jest.fn((lights, scene) => {
        for (const light of lights) light.shadow.updateMatrices(light, 0);
        const counts = []; scene.traverseVisible(m => { if (m.isMesh && m.castShadow) counts.push(m.geometry.index.count / 3); }); depths.push(counts);
    });
    shadow.render = originalShadow;
    const originalRender = jest.fn((scene, camera) => { scene.updateMatrixWorld(true); shadow.render([render.keyLight], scene, camera); });
    renderer.render = originalRender; renderer.domElement.height = 900;
    render.camera.left = -15; render.camera.right = 15; render.camera.top = 15; render.camera.bottom = -15; render.camera.zoom = 1;
    render.camera.updateProjectionMatrix(); render.setActorGameplayGeometryEnabled(true); render.setActorShadowBatchesEnabled(true);
    const a = actor(); render.add(a.root);
    for (const mesh of a.meshes) expect(render.actorGameplayGeometry.pass.register(mesh, new Uint32Array([0, 1, 2]))).toBe(true);
    const draw = () => renderer.render(render.scene, render.camera);
    return { render, renderer, a, draw, depths, originalShadow, originalRender };
}
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('actual RenderSystem composes outer shadow ownership with inner geometry selection', () => {
    const f = fixture(), runtime = f.render.actorShadowBatches, sources = f.a.meshes.map(m => m.geometry);
    f.draw(); expect(runtime.owner.entries.size).toBe(1); expect(runtime.owner.lastSavedSubmissions).toBe(1);
    expect(f.depths.at(-1)).toEqual([2]); expect(f.a.meshes.map(m => m.geometry)).toEqual(sources);
    f.render.dispose(); expect(runtime.disposed).toBe(true); expect(runtime.roots.size).toBe(0);
    expect(f.renderer.render).toBe(f.originalRender); expect(f.renderer.shadowMap.render).toBe(f.originalShadow);
    f.render.setActorShadowBatchesEnabled(true); expect(f.render.actorShadowBatches).toBeNull();
});

test('High to Low releases every batch while preserving root tracking for High recovery', () => {
    const f = fixture(); f.draw(); const runtime = f.render.actorShadowBatches, entry = [...runtime.owner.entries][0];
    const geometry = jest.spyOn(entry.geometry, 'dispose'), material = jest.spyOn(entry.material, 'dispose');
    f.render.setGraphicsQuality('low'); expect(runtime.roots.size).toBe(1); expect(runtime.owner.entries.size).toBe(0);
    expect(geometry).toHaveBeenCalledTimes(1); expect(material).toHaveBeenCalledTimes(1);
    f.draw(); expect(runtime.owner.entries.size).toBe(0); expect(runtime.owner.lastSavedSubmissions).toBe(0);
    f.render.setGraphicsQuality('high'); f.draw(); expect(runtime.owner.entries.size).toBe(1);
    expect(runtime.owner.lastSavedSubmissions).toBe(1); f.render.dispose(); expect(geometry).toHaveBeenCalledTimes(1);
});

test('geometry toggles retire and reinstall the outer wrapper without retaining an obsolete owner', () => {
    const f = fixture(); f.draw(); const old = f.render.actorShadowBatches, geometry = f.render.actorGameplayGeometry;
    f.render.setActorGameplayGeometryEnabled(false); expect(old.disposed).toBe(true); expect(geometry.disposed).toBe(true);
    expect(f.render.actorShadowBatches).not.toBe(old); f.draw(); expect(f.depths.at(-1)).toEqual([4]);
    f.render.setActorGameplayGeometryEnabled(true); const current = f.render.actorShadowBatches;
    expect(current.owner.originalRender).toBe(f.render.actorGameplayGeometry.pass.wrapper);
    f.draw(); expect(current.owner.lastSavedSubmissions).toBe(1); f.render.dispose();
    expect(f.renderer.render).toBe(f.originalRender); expect(f.renderer.shadowMap.render).toBe(f.originalShadow);
});

test('realm scene retirement and subsequent actor arrival preserve bounded ownership', () => {
    const f = fixture(); f.draw(); const runtime = f.render.actorShadowBatches, old = [...runtime.owner.entries][0];
    const disposed = jest.spyOn(old.geometry, 'dispose'); f.render.clearInstanceScene();
    expect(runtime.roots.size).toBe(0); expect(runtime.owner.entries.size).toBe(0); expect(disposed).toHaveBeenCalledTimes(1);
    const next = actor(); f.render.add(next.root); f.draw(); expect(runtime.roots.size).toBe(1); expect(runtime.owner.lastSavedSubmissions).toBe(1);
    f.render.dispose(); expect(disposed).toHaveBeenCalledTimes(1);
});

test('a stock shadow failure restores actor geometry and caster flags through the actual owner stack', () => {
    const f = fixture(), sources = f.a.meshes.map(m => m.geometry), original = f.originalShadow.getMockImplementation();
    f.originalShadow.mockImplementationOnce((...args) => { original(...args); throw Error('stock failure'); });
    expect(f.draw).toThrow('stock failure'); expect(f.a.meshes.map(m => m.geometry)).toEqual(sources);
    expect(f.a.meshes.every(m => m.castShadow)).toBe(true); expect(f.render.actorShadowBatches.owner.active).toEqual([]);
    f.draw(); expect(f.render.actorShadowBatches.owner.lastSavedSubmissions).toBe(1); f.render.dispose();
});

test('actual RenderSystem streams static town roots alongside actors across quality, geometry, scene and session lifetimes', () => {
    const f = fixture(), root = new THREE.Group(); root.userData.opaqueStaticShadowRoot = true;
    for (let i = 0; i < 2; i++) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()); mesh.castShadow = true; root.add(mesh);
    }
    f.render.addToEnvironment(root); f.draw(); const runtime = f.render.actorShadowBatches;
    expect(runtime.static.roots.size).toBe(1); expect(runtime.owner.entries.size).toBe(2);
    const old = [...runtime.owner.entries].find(e => e.isStatic), geometry = jest.spyOn(old.geometry, 'dispose');
    f.render.setGraphicsQuality('low'); expect(runtime.owner.entries.size).toBe(0); f.draw(); expect(runtime.owner.entries.size).toBe(0);
    f.render.setGraphicsQuality('high'); f.draw(); expect(runtime.owner.entries.size).toBe(2);
    f.render.setActorGameplayGeometryEnabled(false); expect(runtime.disposed).toBe(true);
    f.draw(); expect(f.render.actorShadowBatches.static.roots.size).toBe(1); expect(f.render.actorShadowBatches.owner.entries.size).toBe(2);
    f.render.clearInstanceScene(); expect(f.render.actorShadowBatches.static.roots.size).toBe(0);
    expect(f.render.actorShadowBatches.owner.entries.size).toBe(0); f.render.dispose(); expect(geometry).toHaveBeenCalledTimes(1);
});
