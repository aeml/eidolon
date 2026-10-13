import * as THREE from 'three';
import { jest } from '@jest/globals';
import { OpaqueSkinnedShadowRuntime } from '../src/core/OpaqueSkinnedShadowRuntime.js';

function building() {
    const root = new THREE.Group(), nested = new THREE.Group(); root.add(nested);
    root.userData.opaqueStaticShadowRoot = true;
    const meshes = [0, 1].map(x => {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute([x, 0, 0, x + 1, 0, 0, x, 1, 0], 3));
        geometry.setIndex([0, 1, 2]);
        const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial()); mesh.castShadow = true;
        nested.add(mesh); return mesh;
    });
    return { root, nested, meshes };
}
function fixture({ enabled = true } = {}) {
    const scene = new THREE.Scene(), group = new THREE.Group(); scene.add(group);
    const light = new THREE.DirectionalLight(), camera = new THREE.OrthographicCamera(-15, 15, 15, -15, .1, 100);
    light.position.set(0, 0, 10); scene.add(light, light.target);
    const depths = [], stockShadow = jest.fn((lights, currentScene) => {
        for (const l of lights) l.shadow.updateMatrices(l, 0);
        const meshes = []; currentScene.traverseVisible(m => { if (m.isMesh && m.castShadow) meshes.push(m); }); depths.push(meshes);
    });
    const renderer = { shadowMap: { enabled, autoUpdate: true, type: THREE.PCFSoftShadowMap, render: stockShadow } };
    renderer.render = (currentScene = scene) => { currentScene.updateMatrixWorld(true); renderer.shadowMap.render([light], currentScene, camera); };
    const stockRender = renderer.render, runtime = new OpaqueSkinnedShadowRuntime(renderer, scene, [group], { staticGroups: [group, group] });
    return { scene, group, light, camera, renderer, runtime, depths, stockShadow, stockRender, draw: () => renderer.render() };
}

test('qualified static roots share the existing boundary and allocate once across steady frames', () => {
    const f = fixture(), a = building(); f.group.add(a.root);
    const sources = a.meshes.map(m => m.geometry), register = jest.spyOn(f.runtime.owner, 'register'); f.draw();
    expect(f.runtime.static.roots.size).toBe(1); expect(f.runtime.owner.lastSavedSubmissions).toBe(1);
    expect(f.depths.at(-1).map(m => m.name)).toEqual(['OpaqueStaticShadowBatch']);
    const entry = [...f.runtime.owner.entries][0], traverse = jest.spyOn(a.root, 'traverse');
    for (let i = 0; i < 4; i++) f.draw();
    expect(traverse).not.toHaveBeenCalled(); expect(register).toHaveBeenCalledTimes(1);
    expect(f.runtime.owner.entries.has(entry)).toBe(true); expect(a.meshes.map(m => m.geometry)).toEqual(sources);
    expect(a.meshes.every(m => m.castShadow)).toBe(true); f.runtime.dispose();
    expect(f.renderer.render).toBe(f.stockRender); expect(f.renderer.shadowMap.render).toBe(f.stockShadow);
});

test('unqualified scenery is neither traversed nor retained', () => {
    const f = fixture(), a = building(); delete a.root.userData.opaqueStaticShadowRoot;
    const traverse = jest.spyOn(a.root, 'traverse'); f.group.add(a.root); f.draw();
    expect(traverse).not.toHaveBeenCalled(); expect(f.runtime.static.roots.size).toBe(0);
    expect(f.runtime.owner.entries.size).toBe(0); f.runtime.dispose();
});

test.each(['low', 'disabled-owner', 'fullscreen', 'custom-hook'])('%s never allocates static shadow buffers', mode => {
    const f = fixture({ enabled: mode !== 'low' }), a = building(); f.group.add(a.root);
    if (mode === 'disabled-owner') f.runtime.owner.enabled = false;
    if (mode === 'custom-hook') a.meshes[0].onBeforeShadow = () => {};
    if (mode === 'fullscreen') f.renderer.render(new THREE.Scene()); else f.draw();
    expect(f.runtime.owner.entries.size).toBe(0); expect(f.runtime.static.roots.get(a.root).sources.size).toBe(0);
    f.runtime.dispose();
});

test('streaming roots and detached groups retire owned resources once and recover on reentry', () => {
    const f = fixture(), a = building(); f.group.add(a.root); f.draw();
    const old = [...f.runtime.owner.entries][0], geometry = jest.spyOn(old.geometry, 'dispose'), material = jest.spyOn(old.material, 'dispose');
    f.group.removeFromParent(); expect(f.runtime.static.roots.size).toBe(0); expect(f.runtime.owner.entries.size).toBe(0);
    expect(geometry).toHaveBeenCalledTimes(1); expect(material).toHaveBeenCalledTimes(1);
    const b = building(); f.group.add(b.root); expect(f.runtime.static.roots.size).toBe(0);
    f.scene.add(f.group); f.draw(); expect(f.runtime.static.roots.size).toBe(2); expect(f.runtime.owner.entries.size).toBe(2);
    a.root.removeFromParent(); expect(f.runtime.static.roots.size).toBe(1); f.runtime.dispose(); f.runtime.dispose();
    expect(geometry).toHaveBeenCalledTimes(1); expect(material).toHaveBeenCalledTimes(1);
});

test('deep topology changes rebuild only their root and do not retain removed descendants', () => {
    const f = fixture(), a = building(), b = building(); f.group.add(a.root, b.root); f.draw();
    const stable = [...f.runtime.owner.entries].find(e => e.meshes.includes(b.meshes[0]));
    const extra = a.meshes[0].clone(); a.nested.add(extra); f.draw();
    expect([...f.runtime.owner.entries].find(e => e !== stable).meshes).toHaveLength(3);
    expect(f.runtime.owner.entries.has(stable)).toBe(true);
    extra.removeFromParent(); f.draw(); const record = f.runtime.static.roots.get(a.root);
    expect(record.nodes.has(extra)).toBe(false); expect(record.sources.has(extra)).toBe(false);
    expect([...f.runtime.owner.entries].find(e => e !== stable).meshes).toHaveLength(2); f.runtime.dispose();
});

test.each(['hidden-root', 'hidden-part', 'alpha', 'side', 'cast', 'layer'])('initial %s fallback recovers with live static state', mode => {
    const f = fixture(), a = building(); f.group.add(a.root);
    if (mode === 'hidden-root') a.root.visible = false;
    if (mode === 'hidden-part') a.meshes[0].visible = false;
    if (mode === 'alpha') a.meshes[0].material.alphaTest = .5;
    if (mode === 'side') a.meshes[0].material.side = THREE.BackSide;
    if (mode === 'cast') a.meshes[0].castShadow = false;
    if (mode === 'layer') a.meshes[0].layers.set(2);
    f.draw(); expect(f.runtime.owner.entries.size).toBe(0);
    a.root.visible = true; a.meshes[0].visible = true; a.meshes[0].material.alphaTest = 0;
    a.meshes[0].material.side = THREE.FrontSide; a.meshes[0].castShadow = true; a.meshes[0].layers.set(0);
    f.draw(); expect(f.runtime.owner.lastSavedSubmissions).toBe(1); f.runtime.dispose();
});

test('disposed source identity cannot resurrect; replacement identity recovers', () => {
    const f = fixture(), a = building(); f.group.add(a.root); f.draw();
    const original = a.meshes[0].geometry; original.dispose();
    for (let i = 0; i < 3; i++) f.draw(); expect(f.runtime.owner.entries.size).toBe(0);
    a.meshes[0].geometry = original.clone(); f.draw(); expect(f.runtime.owner.lastSavedSubmissions).toBe(1); f.runtime.dispose();
});

test('source generation change rebuilds only its building', () => {
    const f = fixture(), a = building(), b = building(); f.group.add(a.root, b.root); f.draw();
    const stable = [...f.runtime.owner.entries].find(e => e.meshes.includes(b.meshes[0]));
    const old = [...f.runtime.owner.entries].find(e => e !== stable), dispose = jest.spyOn(old.geometry, 'dispose');
    a.meshes[0].geometry.attributes.position.needsUpdate = true; f.draw();
    expect(dispose).toHaveBeenCalledTimes(1); expect(f.runtime.owner.entries.has(stable)).toBe(true);
    expect(f.runtime.owner.entries.size).toBe(2); f.runtime.dispose(); expect(dispose).toHaveBeenCalledTimes(1);
});

test('quality reset, clear and shutdown preserve source ownership and release listeners', () => {
    const f = fixture(), a = building(); f.group.add(a.root); f.draw();
    const sources = a.meshes.map(m => jest.spyOn(m.geometry, 'dispose'));
    const old = [...f.runtime.owner.entries][0], geometry = jest.spyOn(old.geometry, 'dispose');
    f.runtime.reset(); f.renderer.shadowMap.enabled = false; f.draw(); expect(f.runtime.owner.entries.size).toBe(0);
    f.renderer.shadowMap.enabled = true; f.draw(); expect(f.runtime.owner.entries.size).toBe(1);
    const record = f.runtime.static.roots.get(a.root); f.runtime.clear();
    expect(record.nodes.size).toBe(0); expect(record.listeners.size).toBe(0); expect(f.runtime.static.roots.size).toBe(0);
    a.root.removeFromParent(); f.group.add(a.root); f.draw(); expect(f.runtime.owner.entries.size).toBe(1);
    f.runtime.dispose(); f.group.add(building().root); expect(f.runtime.static.roots.size).toBe(0);
    expect(geometry).toHaveBeenCalledTimes(1); sources.forEach(spy => expect(spy).not.toHaveBeenCalled());
});
