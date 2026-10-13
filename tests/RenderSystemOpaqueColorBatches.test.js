import * as THREE from 'three';
import { jest } from '@jest/globals';
import { RenderSystem } from '../src/core/RenderSystem.js';

function actor() {
    const root = new THREE.Group(), bone = new THREE.Bone(); root.add(bone);
    root.userData.authoredClass = 'Fighter'; root.userData.authoredQuality = 'high';
    const skeleton = new THREE.Skeleton([bone]), material = new THREE.MeshStandardMaterial(), meshes = [0, 1].map(x => {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute([x, 0, 0, x + 1, 0, 0, x + 1, 1, 0, x, 1, 0], 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(Array(4).fill([0, 0, 1]).flat(), 3));
        geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(16), 4));
        geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(Array(4).fill([1, 0, 0, 0]).flat(), 4));
        geometry.setIndex([0, 1, 2, 0, 2, 3]);
        const mesh = new THREE.SkinnedMesh(geometry, material);
        root.add(mesh); mesh.bind(skeleton); mesh.castShadow = true; return mesh;
    });
    return { root, meshes };
}
function fixture() {
    const render = new RenderSystem(false), depths = [];
    render.setActorColorBatchesEnabled(false); render.setActorShadowBatchesEnabled(false); render.setActorGameplayGeometryEnabled(false);
    const renderer = render.renderer, shadow = renderer.shadowMap;
    const originalShadow = jest.fn((lights, scene) => {
        for (const light of lights) light.shadow.updateMatrices(light, 0);
        const counts = []; scene.traverseVisible(m => { if (m.isMesh && m.castShadow) counts.push(m.geometry.index.count / 3); }); depths.push(counts);
    });
    shadow.render = originalShadow;
    const calls = [], originalDirect = jest.fn((camera,scene,geometry,material,object)=>calls.push({geometry,material,object}));
    renderer.renderBufferDirect = originalDirect;
    const originalRender = jest.fn((scene, camera) => {
        scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); scene.onBeforeRender(renderer,scene,camera,null);
        shadow.render([render.keyLight], scene, camera);
        if(renderer.throwFrame)throw Error('stock frame failure');
        scene.traverseVisible(mesh=>{if(mesh.isMesh)renderer.renderBufferDirect(camera,scene,mesh.geometry,mesh.material,mesh,null);});
        scene.onAfterRender(renderer,scene,camera);
    });
    renderer.render = originalRender; renderer.domElement.height = 900;
    render.camera.left = -15; render.camera.right = 15; render.camera.top = 15; render.camera.bottom = -15; render.camera.zoom = 1;
    render.camera.updateProjectionMatrix(); render.setActorGameplayGeometryEnabled(true); render.setActorShadowBatchesEnabled(true); render.setActorColorBatchesEnabled(true);
    const a = actor(); render.add(a.root);
    for (const mesh of a.meshes) expect(render.actorGameplayGeometry.pass.register(mesh, new Uint32Array([0, 1, 2]))).toBe(true);
    const draw = () => { calls.length=0; renderer.render(render.scene, render.camera); return calls; };
    return { render, renderer, a, draw, depths, calls, originalDirect, originalShadow, originalRender };
}
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('default color owner sees the geometry selected by the inner pass while original shadow batching remains active', () => {
    const f=fixture(),source=f.a.meshes.map(m=>m.geometry);expect(f.draw()).toHaveLength(1);
    const color=f.render.actorColorBatches,entry=[...color.owner.entries.values()][0];
    expect(entry.geometry.index.count).toBe(6);expect(f.depths.at(-1)).toEqual([2]);expect(color.owner.lastSavedSubmissions).toBe(1);
    expect(f.a.meshes.map(m=>m.geometry)).toEqual(source);expect(f.a.meshes.every(m=>m.castShadow&&m.visible)).toBe(true);
    expect(color.owner.originalRender).toBe(f.render.actorShadowBatches.owner.renderWrapper);
    f.render.dispose();expect(color.disposed).toBe(true);expect(color.roots.size).toBe(0);expect(color.owner.entries.size).toBe(0);
    expect(f.renderer.render).toBe(f.originalRender);expect(f.renderer.renderBufferDirect).toBe(f.originalDirect);expect(f.renderer.shadowMap.render).toBe(f.originalShadow);
    f.render.setActorColorBatchesEnabled(true);expect(f.render.actorColorBatches).toBeNull();
});

test('geometry and shadow owner replacements retire the outer color owner and restore stack ordering', () => {
    const f=fixture();f.draw();const old=f.render.actorColorBatches,entry=[...old.owner.entries.values()][0],disposed=jest.spyOn(entry.geometry,'dispose');
    f.render.setActorGameplayGeometryEnabled(false);expect(old.disposed).toBe(true);expect(disposed).toHaveBeenCalledTimes(1);expect(f.draw()).toHaveLength(1);
    expect(f.calls[0].geometry.index.count).toBe(12);f.render.setActorGameplayGeometryEnabled(true);f.draw();
    expect(f.render.actorColorBatches.owner.originalRender).toBe(f.render.actorShadowBatches.owner.renderWrapper);
    expect(f.render.actorShadowBatches.owner.originalRender).toBe(f.render.actorGameplayGeometry.pass.wrapper);
    const prior=f.render.actorColorBatches;f.render.setActorShadowBatchesEnabled(false);expect(prior.disposed).toBe(true);expect(f.draw()).toHaveLength(1);
    f.render.setActorShadowBatchesEnabled(true);expect(f.draw()).toHaveLength(1);expect(f.render.actorColorBatches.owner.originalRender).toBe(f.render.actorShadowBatches.owner.renderWrapper);
    f.render.dispose();expect(disposed).toHaveBeenCalledTimes(1);expect(f.renderer.render).toBe(f.originalRender);
});

test('quality and appearance changes retire current copies, retain tracked actors and preserve borrowed materials', () => {
    const f=fixture();f.draw();const runtime=f.render.actorColorBatches,entry=[...runtime.owner.entries.values()][0];
    const disposed=jest.spyOn(entry.geometry,'dispose'),material=jest.spyOn(f.a.meshes[0].material,'dispose');
    f.render.setGraphicsQuality('low');expect(runtime.owner.entries.size).toBe(0);expect(runtime.roots.size).toBe(1);expect(disposed).toHaveBeenCalledTimes(1);
    expect(f.draw()).toHaveLength(1);f.render.setGraphicsQuality('high');expect(f.draw()).toHaveLength(1);
    const current=[...runtime.owner.entries.values()][0],generation=jest.spyOn(current.geometry,'dispose');f.a.root.userData.equipmentVisualRevision=3;
    f.draw();expect(generation).toHaveBeenCalledTimes(1);expect([...runtime.owner.entries.values()][0]).not.toBe(current);expect(material).not.toHaveBeenCalled();
    f.render.dispose();expect(disposed).toHaveBeenCalledTimes(1);
});

test('failed frames and realm clear leave no proxy children or stale wrappers', () => {
    const f=fixture(),sources=f.a.meshes.map(m=>m.geometry);f.renderer.throwFrame=true;expect(f.draw).toThrow('stock frame failure');
    const runtime=f.render.actorColorBatches;expect(runtime.owner.context).toBeNull();expect([...runtime.owner.entries.values()].every(e=>!e.proxy.parent)).toBe(true);
    expect(f.a.meshes.map(m=>m.geometry)).toEqual(sources);f.renderer.throwFrame=false;expect(f.draw()).toHaveLength(1);
    const entry=[...runtime.owner.entries.values()][0],disposed=jest.spyOn(entry.geometry,'dispose');f.render.clearInstanceScene();
    expect(runtime.roots.size).toBe(0);expect(runtime.owner.entries.size).toBe(0);expect(disposed).toHaveBeenCalledTimes(1);
    f.render.add(f.a.root);expect(f.draw()).toHaveLength(1);expect(runtime.roots.size).toBe(1);f.render.dispose();expect(disposed).toHaveBeenCalledTimes(1);
    expect(f.renderer.render).toBe(f.originalRender);expect(f.renderer.renderBufferDirect).toBe(f.originalDirect);
});

test('rigid-instance owner replacement releases the previous scene hook beneath the outer color wrapper', () => {
    const f=fixture();f.draw();const previous=f.render.actorColorBatches,instances=f.render.actorInstances,predecessor=instances.before;
    f.render.setActorInstancesEnabled(false);expect(previous.disposed).toBe(true);expect(f.render.actorInstances).toBeNull();
    expect(f.render.actorColorBatches.owner.originalBefore).toBe(predecessor);expect(f.draw()).toHaveLength(1);
    f.render.setActorInstancesEnabled(true);expect(f.render.actorInstances).not.toBe(instances);expect(f.draw()).toHaveLength(1);
    expect(f.render.actorColorBatches.owner.originalBefore).toBe(f.render.actorInstances.beforeHook);
    f.render.dispose();expect(f.renderer.render).toBe(f.originalRender);expect(f.renderer.renderBufferDirect).toBe(f.originalDirect);
});
