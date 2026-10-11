import * as THREE from 'three';
import { ActorShadowInfluence } from '../src/art/ActorShadowInfluence.js';
import { ActorInstanceBatches } from '../src/art/ActorInstanceBatches.js';

function fixture() {
    const scene = new THREE.Scene(), group = new THREE.Group(); scene.add(group);
    const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, .1, 200);
    camera.up.set(0, 0, -1); camera.position.set(0, 100, 0); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
    const light = new THREE.DirectionalLight(); light.position.set(50, 100, 0); light.castShadow = true; scene.add(light, light.target);
    const root = new THREE.Group(); root.userData.proceduralEnemyFamily = true; group.add(root);
    const geometry = new THREE.BoxGeometry(2, 2, 2), material = new THREE.MeshStandardMaterial();
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(100, 5, 0); mesh.castShadow = true; root.add(mesh);
    const renderer = { shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap }, capabilities: { maxTextureSize: 4096 } };
    const filter = new ActorShadowInfluence(scene, [scene, group]);
    const begin = (batches = []) => { scene.updateMatrixWorld(true); filter.beginFrame(renderer, scene, camera, batches); };
    return { scene, group, root, mesh, geometry, material, camera, light, renderer, filter, begin };
}

test('only shadow flags are frame-owned; originals, visible color and incoming raised shadows remain intact', () => {
    const f = fixture(), data = f.geometry.attributes.position.array.slice();
    f.begin(); expect(f.mesh.castShadow).toBe(false); expect(f.mesh.visible).toBe(true);
    f.filter.endFrame(); expect(f.mesh.castShadow).toBe(true);
    f.mesh.position.set(18, 30, 0); f.begin(); expect(f.mesh.castShadow).toBe(true);
    f.mesh.position.set(0, 5, 0); f.begin(); expect(f.mesh.castShadow).toBe(true);
    expect(f.geometry.attributes.position.array).toEqual(data); expect(f.geometry.boundingBox).toBeNull(); f.filter.dispose();
});

test('current animated parents and updated source attributes invalidate immediately', () => {
    const f = fixture(); f.begin(); expect(f.mesh.castShadow).toBe(false); f.filter.endFrame();
    f.root.position.x = -100; f.begin(); expect(f.mesh.castShadow).toBe(true);
    f.root.position.x = 0;
    const position = f.geometry.attributes.position;
    for (let i = 0; i < position.count; i++) position.setX(i, position.getX(i) - 100);
    position.needsUpdate = true; f.begin(); expect(f.mesh.castShadow).toBe(true);
    const replacement = position.clone();
    for (let i = 0; i < replacement.count; i++) replacement.setX(i, replacement.getX(i) + 100);
    f.geometry.setAttribute('position', replacement); f.begin(); expect(f.mesh.castShadow).toBe(false); f.filter.dispose();
});

test.each(['nested-point', 'horizontal', 'unknown-filter', 'invalid-map', 'array-camera', 'invalid-camera', 'override-material'])('%s conservatively keeps original shadows', kind => {
    const f = fixture();
    if (kind === 'nested-point') { const parent = new THREE.Group(), point = new THREE.PointLight(); point.castShadow = true; f.scene.add(parent); parent.add(point); }
    if (kind === 'horizontal') f.light.position.y = 0;
    if (kind === 'unknown-filter') f.renderer.shadowMap.type = THREE.VSMShadowMap;
    if (kind === 'invalid-map') f.light.shadow.mapSize.x = 0;
    if (kind === 'array-camera') f.camera.isArrayCamera = true;
    if (kind === 'invalid-camera') f.camera.projectionMatrix.elements[0] = NaN;
    if (kind === 'override-material') f.scene.overrideMaterial = new THREE.MeshBasicMaterial();
    f.begin(); expect(f.mesh.castShadow).toBe(true); expect(f.filter.omitted).toHaveLength(0); f.filter.dispose();
});

test.each(['skinned', 'morph', 'displacement', 'custom-depth', 'custom-shader', 'custom-render', 'material-render', 'always-visible', 'invalid-position', 'child'])('%s deformation or draw contract falls back', kind => {
    const f = fixture();
    if (kind === 'skinned') f.mesh.isSkinnedMesh = true;
    if (kind === 'morph') f.geometry.morphAttributes.position = [f.geometry.attributes.position.clone()];
    if (kind === 'displacement') f.material.displacementMap = new THREE.Texture();
    if (kind === 'custom-depth') f.mesh.customDepthMaterial = new THREE.MeshDepthMaterial();
    if (kind === 'custom-shader') f.material.onBeforeCompile = () => {};
    if (kind === 'custom-render') f.mesh.onBeforeShadow = () => {};
    if (kind === 'material-render') f.material.onBeforeRender = () => {};
    if (kind === 'always-visible') f.mesh.frustumCulled = false;
    if (kind === 'invalid-position') f.geometry.attributes.position.array[0] = NaN;
    if (kind === 'child') f.mesh.add(new THREE.Group());
    f.begin(); expect(f.mesh.castShadow).toBe(true); f.filter.dispose();
});

test('actual current float32 instance matrices and count bound each whole shadow batch', () => {
    const f = fixture(), batch = new THREE.InstancedMesh(f.geometry, f.material, 2);
    batch.castShadow = true; f.scene.add(batch);
    batch.setMatrixAt(0, new THREE.Matrix4().makeTranslation(100, 5, 0));
    batch.setMatrixAt(1, new THREE.Matrix4().makeTranslation(102, 5, 0));
    f.begin([batch]); expect(batch.castShadow).toBe(false); f.filter.endFrame();
    batch.setMatrixAt(1, new THREE.Matrix4().makeTranslation(18, 30, 0));
    f.begin([batch]); expect(batch.castShadow).toBe(true);
    batch.count = 1; f.begin([batch]); expect(batch.castShadow).toBe(false); f.filter.endFrame();
    batch.setMatrixAt(0, new THREE.Matrix4().makeTranslation(0, 5, 0));
    f.begin([batch]); expect(batch.castShadow).toBe(true);
    batch.setMatrixAt(0, new THREE.Matrix4().set(NaN, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1));
    f.begin([batch]); expect(batch.castShadow).toBe(true); f.filter.dispose();
});

test('streamed roots and retirement release listeners and restore flags exactly once', () => {
    const f = fixture(); f.begin(); expect(f.filter.roots.size).toBe(1);
    f.filter.endFrame(); f.root.removeFromParent(); expect(f.filter.roots.size).toBe(0);
    f.group.add(f.root); f.begin(); expect(f.filter.roots.size).toBe(1); expect(f.mesh.castShadow).toBe(false);
    f.filter.dispose(); f.filter.dispose(); expect(f.mesh.castShadow).toBe(true); expect(f.filter.roots.size).toBe(0);
    f.root.removeFromParent(); f.group.add(f.root); f.begin(); expect(f.filter.roots.size).toBe(0);
});

test('batch owner restores shadow flags on normal return, clear and filtering exception', () => {
    const f = fixture(), instances = new ActorInstanceBatches(f.scene, [f.scene, f.group]);
    instances.shadowFilter = f.filter;
    f.scene.updateMatrixWorld(true); instances.beginFrame(f.renderer, f.camera);
    expect(f.mesh.castShadow).toBe(false); instances.endFrame(); expect(f.mesh.castShadow).toBe(true);
    instances.beginFrame(f.renderer, f.camera); instances.clear(); expect(f.mesh.castShadow).toBe(true);
    const begin = f.filter.beginFrame.bind(f.filter);
    f.filter.beginFrame = (...args) => { begin(...args); throw Error('filter-failure'); };
    expect(() => instances.beginFrame(f.renderer, f.camera)).toThrow('filter-failure');
    expect(f.mesh.castShadow).toBe(true); expect(instances.hidden).toHaveLength(0); expect(instances.group.visible).toBe(false);
    instances.shadowFilter = null; f.filter.dispose(); instances.dispose();
});
