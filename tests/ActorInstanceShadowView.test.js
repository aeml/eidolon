import { jest } from '@jest/globals';
import * as THREE from 'three';
import { ActorInstanceBatches } from '../src/art/ActorInstanceBatches.js';
import { ActorInstanceShadowView } from '../src/art/ActorInstanceShadowView.js';

function fixture(callback = () => {}) {
    const scene = new THREE.Scene();
    const instances = new ActorInstanceBatches(scene);
    const geometry = new THREE.BoxGeometry(1, 1, 1), material = new THREE.MeshStandardMaterial();
    const batch = new THREE.InstancedMesh(geometry, material, 2);
    batch.count = 2; batch.castShadow = true;
    batch.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1);
    batch.matrixWorld.makeTranslation(100, 2, 0);
    instances.group.add(batch); instances.group.visible = true;
    instances.batches.set('batch', batch);
    const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, .1, 100);
    camera.position.set(0, 20, 0); camera.up.set(0, 0, -1); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    const light = new THREE.DirectionalLight(); light.castShadow = true;
    light.position.set(0, 20, 0); scene.add(light, light.target); light.updateMatrixWorld();
    const seen = [];
    const original = jest.fn(function(...args) { seen.push(batch.castShadow); callback(...args); return 'original'; });
    const renderer = { shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap, render: original }, capabilities: { maxTextureSize: 4096 } };
    const view = new ActorInstanceShadowView(renderer, scene, instances);
    return { scene, instances, batch, geometry, material, camera, light, seen, original, renderer, view,
        render: (lights = [light]) => renderer.shadowMap.render(lights, scene, camera),
        dispose() { view.dispose(); instances.dispose(); geometry.dispose(); material.dispose(); } };
}

test('omits a whole offscreen shadow batch without rewriting any rows or color flags', () => {
    const f = fixture(), rows = f.batch.instanceMatrix.array.slice(), matrix = f.batch.matrixWorld.clone();
    expect(f.render()).toBe('original');
    expect(f.seen).toEqual([false]); expect(f.batch.castShadow).toBe(true);
    expect(f.batch.visible).toBe(true); expect(f.batch.count).toBe(2);
    expect(f.batch.matrixWorld.equals(matrix)).toBe(true); expect(f.batch.instanceMatrix.array).toEqual(rows);
    expect(f.view.stats).toEqual({ lights: 1, checked: 1, omitted: 1 }); f.dispose();
});

test('keeps visible geometry and incoming offscreen shadows', () => {
    const f = fixture();
    f.batch.matrixWorld.makeTranslation(0, 2, 0); f.render();
    f.batch.matrixWorld.makeTranslation(20, 20, 0); f.light.position.set(20, 20, 0); f.render();
    expect(f.seen).toEqual([true, true]); f.dispose();
});

test('uses every actual nested light supplied by the renderer', () => {
    const f = fixture(), nested = new THREE.DirectionalLight(); nested.castShadow = true;
    const group = new THREE.Group(); group.add(nested); f.scene.add(group, nested.target);
    f.batch.matrixWorld.makeTranslation(20, 20, 0); nested.position.set(20, 20, 0);
    f.render([f.light]); f.render([f.light, nested]);
    expect(f.seen).toEqual([false, true]); expect(f.view.stats.lights).toBe(2); f.dispose();
});

test('retains the actual shadow filter footprint at the color-view boundary', () => {
    const f = fixture();
    f.batch.matrixWorld.makeTranslation(11.04, 2, 0); f.render();
    f.batch.matrixWorld.makeTranslation(11.2, 2, 0); f.render();
    expect(f.seen).toEqual([true, false]); f.dispose();
});

test('uses the prepared batches and actual light list without traversing the scene', () => {
    const f = fixture();
    f.scene.traverse = () => { throw Error('Unexpected scene scan'); };
    f.scene.traverseVisible = () => { throw Error('Unexpected visible scene scan'); };
    f.render(); expect(f.seen).toEqual([false]); f.dispose();
});

test('does not change a different scene or its stored diagnostics', () => {
    const f = fixture(); f.render();
    const stats = f.view.stats;
    f.renderer.shadowMap.render([f.light], new THREE.Scene(), f.camera);
    expect(f.seen).toEqual([false, true]); expect(f.view.stats).toBe(stats); f.dispose();
});

test('restores flags and wrapper state after an underlying shadow failure', () => {
    const f = fixture(() => { throw new Error('shadow failure'); });
    expect(() => f.render()).toThrow('shadow failure');
    expect(f.batch.castShadow).toBe(true); expect(f.view.active).toHaveLength(0); expect(f.view.depth).toBe(0); f.dispose();
});

test('nested render sees original flags and leaves the outer pass conservative', () => {
    let f, nested = false;
    f = fixture(() => { if (!nested) { nested = true; f.render(); expect(f.batch.castShadow).toBe(true); } });
    f.render(); expect(f.seen).toEqual([false, true]); expect(f.batch.castShadow).toBe(true); f.dispose();
});

test.each([
    ['unknown light', f => new THREE.PointLight()],
    ['unrecognized filter', f => { f.renderer.shadowMap.type = THREE.VSMShadowMap; return f.light; }],
    ['unknown projection', f => { f.camera.coordinateSystem = THREE.WebGPUCoordinateSystem; return f.light; }],
    ['reversed depth', f => { Object.defineProperty(f.camera, 'reversedDepth', { value: true }); return f.light; }],
    ['array camera', f => { f.camera.isArrayCamera = true; return f.light; }],
    ['invalid camera', f => { f.camera.matrixWorldInverse.elements[0] = NaN; return f.light; }],
    ['horizontal sun', f => { f.light.position.set(20, 0, 0); return f.light; }],
    ['disabled shadows', f => { f.renderer.shadowMap.enabled = false; return f.light; }],
    ['held shadow update', f => { f.renderer.shadowMap.autoUpdate = false; f.renderer.shadowMap.needsUpdate = false; return f.light; }],
    ['disabled pilot', f => { f.view.enabled = false; return f.light; }]
])('keeps original path for %s', (_, change) => {
    const f = fixture(); f.render([change(f)]); expect(f.seen).toEqual([true]); expect(f.batch.castShadow).toBe(true); f.dispose();
});

test.each([
    ['invalid bounds', f => { f.batch.boundingSphere.radius = Infinity; }],
    ['invalid world matrix', f => { f.batch.matrixWorld.elements[0] = NaN; }],
    ['non-affine matrix', f => { f.batch.matrixWorld.elements[3] = .1; }],
    ['deforming shader', f => { f.material.onBeforeCompile = () => {}; }],
    ['displacement', f => { f.material.displacementMap = {}; }],
    ['custom depth', f => { f.batch.customDepthMaterial = {}; }],
    ['custom shadow callback', f => { f.batch.onBeforeShadow = () => {}; }],
    ['custom color callback', f => { f.batch.onBeforeRender = () => {}; }],
    ['morphs', f => { f.geometry.morphAttributes.position = []; }],
    ['unbounded count', f => { f.batch.count = 3; }],
    ['unculled batch', f => { f.batch.frustumCulled = false; }],
    ['nested geometry', f => { f.batch.add(new THREE.Object3D()); }]
])('keeps original batch for %s', (_, change) => {
    const f = fixture(); change(f); f.render(); expect(f.seen).toEqual([true]); f.dispose();
});

test('refreshes current camera, light and prepared bounds each pass', () => {
    const f = fixture(); f.render();
    f.batch.boundingSphere.center.x = -100; f.render();
    f.batch.boundingSphere.center.x = 0; f.camera.position.x = 100; f.camera.lookAt(100, 0, 0); f.camera.updateMatrixWorld(); f.render();
    expect(f.seen).toEqual([false, true, true]); f.dispose();
});

test('enforces one owner and preserves later installed wrappers on disposal', () => {
    const f = fixture();
    expect(() => new ActorInstanceShadowView(f.renderer, f.scene, f.instances)).toThrow('One shadow-view owner');
    const later = () => {}; f.renderer.shadowMap.render = later;
    f.view.dispose(); expect(f.renderer.shadowMap.render).toBe(later); f.dispose();
});
