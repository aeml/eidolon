import * as THREE from 'three';
import { jest } from '@jest/globals';
import { ActorInstanceView } from '../src/art/ActorInstanceView.js';
import { ActorInstanceBatches } from '../src/art/ActorInstanceBatches.js';

function fixture() {
    const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-10, 10, 10, -10, .1, 200);
    camera.up.set(0, 0, -1); camera.position.set(0, 100, 0); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
    const light = new THREE.DirectionalLight(); light.position.set(50, 100, 0); light.castShadow = true; scene.add(light, light.target);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshStandardMaterial());
    mesh.position.set(100, 5, 0); mesh.castShadow = true; scene.add(mesh);
    const renderer = { shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap }, capabilities: { maxTextureSize: 4096 } };
    const view = new ActorInstanceView();
    const begin = () => { scene.updateMatrixWorld(true); view.beginFrame(renderer, scene, camera); };
    return { scene, camera, light, mesh, renderer, view, begin };
}

test('visible geometry and an offscreen incoming shadow stay, distant full influence rejects without source edits', () => {
    const f = fixture(), geometry = f.mesh.geometry, positions = geometry.attributes.position.array.slice();
    f.begin(); expect(f.view.rejects(f.mesh)).toBe(true);
    f.mesh.position.set(0, 5, 0); f.begin(); expect(f.view.rejects(f.mesh)).toBe(false);
    f.mesh.position.set(18, 30, 0); f.begin();
    expect(f.view.frustum.intersectsBox(new THREE.Box3().setFromBufferAttribute(geometry.attributes.position).applyMatrix4(f.mesh.matrixWorld))).toBe(false);
    expect(f.view.rejects(f.mesh)).toBe(false);
    expect(f.mesh.geometry).toBe(geometry); expect(geometry.attributes.position.array).toEqual(positions);
    expect(geometry.boundingBox).toBeNull(); expect(f.mesh.visible).toBe(true); expect(f.mesh.castShadow).toBe(true);
});

test('current parent/camera transforms and every casting directional light are authoritative', () => {
    const f = fixture(), parent = new THREE.Group(); f.scene.add(parent); parent.add(f.mesh);
    f.begin(); expect(f.view.rejects(f.mesh)).toBe(true);
    parent.position.x = -100; f.begin(); expect(f.view.rejects(f.mesh)).toBe(false);
    parent.position.x = 0; f.camera.position.x = 100; f.camera.updateMatrixWorld(true); f.begin(); expect(f.view.rejects(f.mesh)).toBe(false);
    f.camera.position.x = 0; f.camera.updateMatrixWorld(true);
    const second = new THREE.DirectionalLight(); second.position.set(800, 100, 0); second.castShadow = true;
    f.scene.add(second, second.target); f.begin(); expect(f.view.rejects(f.mesh)).toBe(false);
    second.castShadow = false; f.begin(); expect(f.view.rejects(f.mesh)).toBe(true);
});

test.each(['point', 'nested-point', 'horizontal', 'unknown-filter', 'invalid-map', 'unknown-renderer'])('%s illumination conservatively retains casters, while noncasters still use the actual view', kind => {
    const f = fixture();
    if (kind === 'point' || kind === 'nested-point') {
        const point = new THREE.PointLight(); point.castShadow = true;
        if (kind === 'nested-point') { const group = new THREE.Group(); f.scene.add(group); group.add(point); }
        else f.scene.add(point);
    }
    if (kind === 'horizontal') f.light.position.set(100, 0, 0);
    if (kind === 'unknown-filter') f.renderer.shadowMap.type = THREE.VSMShadowMap;
    if (kind === 'invalid-map') f.light.shadow.mapSize.x = 0;
    if (kind === 'unknown-renderer') f.renderer.shadowMap = null;
    f.begin(); expect(f.view.rejects(f.mesh)).toBe(false);
    f.mesh.castShadow = false; expect(f.view.rejects(f.mesh)).toBe(true);
});

test('disabled shadows skip the light scan and retain filter-padded geometry at the camera edge', () => {
    const f = fixture(); f.renderer.shadowMap.enabled = false; f.begin();
    expect(f.view.stats.lightScanNodes).toBe(0); expect(f.view.rejects(f.mesh)).toBe(true);
    f.mesh.position.set(11.00005, 5, 0); f.begin(); expect(f.view.rejects(f.mesh)).toBe(false);
});

test.each(['reversed-depth', 'array-camera', 'override-material'])('%s view conservatively retains the ordinary path', kind => {
    const f = fixture();
    if (kind === 'reversed-depth') Object.defineProperty(f.camera, 'reversedDepth', { value: true });
    if (kind === 'array-camera') f.camera.isArrayCamera = true;
    if (kind === 'override-material') f.scene.overrideMaterial = new THREE.MeshBasicMaterial();
    f.begin(); expect(f.view.rejects(f.mesh)).toBe(false);
});

test('filtering the first member preserves the original leaf-based origin across root cell edges', () => {
    const f = fixture(); f.mesh.removeFromParent();
    for (const [rootX, leafX] of [[31.5, 1], [-31.5, -1]]) {
        const root = new THREE.Group(); root.userData.proceduralHumanoid = true; root.position.set(rootX, 5, 0);
        const part = new THREE.Mesh(f.mesh.geometry, f.mesh.material); part.position.x = leafX; root.add(part); f.scene.add(root);
    }
    const instances = new ActorInstanceBatches(f.scene);
    f.camera.position.x = -32.5; f.camera.updateMatrixWorld(true); f.scene.updateMatrixWorld(true);
    try {
        instances.beginFrame(f.renderer, f.camera);
        const source = [...instances.batches.values()][0];
        const matrix = new THREE.Matrix4(); source.getMatrixAt(1, matrix);
        const origin = source.matrixWorld.clone(); instances.endFrame(); instances.viewFilter = f.view;
        instances.beginFrame(f.renderer, f.camera);
        const candidate = [...instances.batches.values()][0], retained = new THREE.Matrix4(); candidate.getMatrixAt(0, retained);
        expect(candidate.count).toBe(1); expect(candidate.matrixWorld.equals(origin)).toBe(true);
        expect(retained.equals(matrix)).toBe(true); expect(origin.elements[12]).toBe(64);
    } finally { instances.dispose(); f.view.dispose(); }
});

test('private local bounds reuse unchanged source data and immediately follow version/attribute replacement', () => {
    const f = fixture(); f.begin(); expect(f.view.rejects(f.mesh)).toBe(true); expect(f.view.stats.boundsBuilt).toBe(1);
    f.begin(); expect(f.view.rejects(f.mesh)).toBe(true); expect(f.view.stats.boundsBuilt).toBe(0);
    const position = f.mesh.geometry.attributes.position;
    for (let i = 0; i < position.count; i++) position.setX(i, position.getX(i) - 100);
    position.needsUpdate = true; f.begin(); expect(f.view.rejects(f.mesh)).toBe(false); expect(f.view.stats.boundsBuilt).toBe(1);
    const replacement = position.clone();
    for (let i = 0; i < replacement.count; i++) replacement.setX(i, replacement.getX(i) + 100);
    f.mesh.geometry.setAttribute('position', replacement); f.begin(); expect(f.view.rejects(f.mesh)).toBe(true);
    expect(f.mesh.geometry.boundingBox).toBeNull();
});

test('settled rigid world bounds are reused while direct matrix writes remain immediate', () => {
    const f = fixture(); f.begin(); expect(f.view.rejects(f.mesh)).toBe(true);
    const apply = jest.spyOn(THREE.Box3.prototype, 'applyMatrix4');
    try {
        f.begin(); expect(f.view.rejects(f.mesh)).toBe(true); expect(apply).not.toHaveBeenCalled();
        f.mesh.matrixWorld.makeTranslation(0, 5, 0);
        expect(f.view.rejects(f.mesh)).toBe(false); expect(apply).toHaveBeenCalledTimes(1);
        f.mesh.matrixWorld.makeTranslation(100, 5, 0);
        expect(f.view.rejects(f.mesh)).toBe(true); expect(apply).toHaveBeenCalledTimes(2);
        f.mesh.matrixWorld.elements[0] = 1e308;
        f.mesh.matrixWorld.elements[4] = 1e308;
        expect(f.view.rejects(f.mesh)).toBe(false);
        f.mesh.matrixWorld.makeTranslation(100, 5, 0);
        expect(f.view.rejects(f.mesh)).toBe(true);
    } finally { apply.mockRestore(); f.view.dispose(); }
});

test('shared geometry retains independent world bounds through reparenting and source replacement', () => {
    const f = fixture(), second = new THREE.Mesh(f.mesh.geometry, f.mesh.material), parent = new THREE.Group();
    second.position.set(0, 5, 0); second.castShadow = true; f.scene.add(second, parent);
    f.begin(); expect(f.view.rejects(f.mesh)).toBe(true); expect(f.view.rejects(second)).toBe(false);
    parent.position.x = -100; parent.add(f.mesh); f.begin();
    expect(f.view.rejects(f.mesh)).toBe(false); expect(f.view.rejects(second)).toBe(false);
    parent.position.x = 0; f.begin(); expect(f.view.rejects(f.mesh)).toBe(true);
    const replacement = f.mesh.geometry.attributes.position.clone();
    for (let i = 0; i < replacement.count; i++) replacement.setX(i, replacement.getX(i) - 100);
    f.mesh.geometry.setAttribute('position', replacement); f.begin();
    expect(f.view.rejects(f.mesh)).toBe(false); expect(f.view.rejects(second)).toBe(true);
    f.view.dispose();
});

test.each(['displacement', 'custom-depth', 'custom-render', 'custom-shader', 'morph', 'skinned', 'child', 'always-visible', 'invalid-position', 'projective'])('%s geometry keeps its normal rendering path', kind => {
    const f = fixture();
    if (kind === 'displacement') f.mesh.material.displacementMap = new THREE.Texture();
    if (kind === 'custom-depth') f.mesh.customDepthMaterial = new THREE.MeshDepthMaterial();
    if (kind === 'custom-render') f.mesh.onBeforeRender = () => {};
    if (kind === 'custom-shader') f.mesh.material.onBeforeCompile = () => {};
    if (kind === 'morph') f.mesh.geometry.morphAttributes.position = [f.mesh.geometry.attributes.position.clone()];
    if (kind === 'skinned') f.mesh.isSkinnedMesh = true;
    if (kind === 'child') f.mesh.add(new THREE.Group());
    if (kind === 'always-visible') f.mesh.frustumCulled = false;
    if (kind === 'invalid-position') f.mesh.geometry.attributes.position.array[0] = NaN;
    f.begin();
    if (kind === 'projective') f.mesh.matrixWorld.elements[3] = .1;
    expect(f.view.rejects(f.mesh)).toBe(false);
});

test('instance ownership restores culled leaves, preserves a single retained instance shader, and catches filter failures', () => {
    const f = fixture(); f.mesh.removeFromParent();
    const roots = [0, 25].map(x => {
        const root = new THREE.Group(); root.userData.proceduralHumanoid = true;
        const part = new THREE.Mesh(f.mesh.geometry, f.mesh.material); part.castShadow = true;
        root.position.set(x, 5, 0); root.add(part); f.scene.add(root); return { root, part };
    });
    const instances = new ActorInstanceBatches(f.scene); instances.viewFilter = f.view;
    try {
        f.scene.updateMatrixWorld(true); instances.beginFrame(f.renderer, f.camera);
        expect(f.view.stats.culled).toBe(1);
        expect(instances.batches.size).toBe(1); expect([...instances.batches.values()][0].count).toBe(1);
        expect(roots.every(({ part }) => !part.visible)).toBe(true);
        instances.endFrame(); expect(roots.every(({ part }) => part.visible)).toBe(true);
        const reject = jest.spyOn(f.view, 'rejects').mockImplementationOnce(() => true).mockImplementationOnce(() => { throw Error('filter-failure'); });
        expect(() => instances.beginFrame(f.renderer, f.camera)).toThrow('filter-failure'); reject.mockRestore();
        expect(roots.every(({ part }) => part.visible)).toBe(true); expect(instances.hidden).toHaveLength(0);
        instances.viewFilter = null; instances.beginFrame(f.renderer, f.camera); expect([...instances.batches.values()][0].count).toBe(2);
    } finally { instances.dispose(); f.view.dispose(); }
    expect(roots.every(({ part }) => part.visible)).toBe(true);
});
