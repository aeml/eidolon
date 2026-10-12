import * as THREE from 'three';
import { jest } from '@jest/globals';
import { OpaqueSkinnedShadowBatches } from '../src/core/OpaqueSkinnedShadowBatches.js';

function fixture() {
    const scene = new THREE.Scene(), root = new THREE.Group(), bone = new THREE.Bone();
    scene.add(root); root.add(bone);
    const skeleton = new THREE.Skeleton([bone]);
    const meshes = [0, 1].map(x => {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute([x, 0, 0, x + .5, 0, 0, x, .5, 0], 3));
        geometry.setAttribute('skinIndex', new THREE.Uint8BufferAttribute(new Uint8Array(12), 4));
        geometry.setAttribute('skinWeight', new THREE.Uint8BufferAttribute([255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0], 4, true));
        geometry.setIndex([0, 1, 2]);
        const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial({ map: new THREE.Texture() }));
        root.add(mesh); mesh.bind(skeleton); mesh.castShadow = true; return mesh;
    });
    const camera = new THREE.PerspectiveCamera(), light = new THREE.DirectionalLight();
    light.position.set(0, 0, 10); scene.add(light, light.target); scene.updateMatrixWorld(true);
    const lights = [light], depth = [], projected = [], colored = [];
    const casters = () => {
        const result = [];
        scene.traverseVisible(mesh => { if (mesh.isMesh && mesh.castShadow) result.push(mesh); });
        return result;
    };
    const shadowMap = { enabled: true, autoUpdate: true, needsUpdate: false, type: THREE.PCFSoftShadowMap,
        render: jest.fn(activeLights => {
            for (const current of activeLights) {
                if (current.shadow.autoUpdate === false && current.shadow.needsUpdate === false) continue;
                current.shadow.updateMatrices(current, 0); depth.push(casters());
            }
        }) };
    const renderer = { shadowMap, render: jest.fn(() => {
        projected.push(casters()); shadowMap.render(lights, scene, camera); colored.push(casters());
    }) };
    const owner = new OpaqueSkinnedShadowBatches(renderer, scene);
    expect(owner.register(root)).toBe(1);
    return { scene, root, bone, skeleton, meshes, camera, light, lights, depth, projected, colored, renderer, shadowMap, owner };
}

test('projection and color retain originals; stock shadow viewport uses one independent mapless skin', () => {
    const f = fixture(), original = f.light.shadow.updateMatrices;
    expect(Object.hasOwn(f.light.shadow, 'updateMatrices')).toBe(false);
    f.renderer.render();
    expect(f.projected).toEqual([f.meshes]); expect(f.colored).toEqual([f.meshes]);
    expect(f.depth[0]).toHaveLength(1);
    const proxy = f.depth[0][0];
    expect(proxy.isSkinnedMesh).toBe(true); expect(proxy.skeleton).toBe(f.skeleton);
    expect(proxy.geometry.index.count).toBe(6); expect(proxy.material.map).toBeNull();
    expect(Object.keys(proxy.geometry.attributes)).toEqual(['position', 'skinIndex', 'skinWeight']);
    expect(proxy.parent).toBeNull(); expect(f.meshes.every(mesh => mesh.castShadow)).toBe(true);
    expect(f.owner.lastBatches).toBe(1); expect(f.owner.lastSavedSubmissions).toBe(1);
    expect(f.light.shadow.updateMatrices).toBe(original);
    expect(Object.hasOwn(f.light.shadow, 'updateMatrices')).toBe(false); f.owner.dispose();
});

test('moving world transforms and attached bind inverses are copied from the current frame', () => {
    const f = fixture(); f.root.position.set(2, 1, -3); f.bone.rotation.y = .8;
    f.scene.updateMatrixWorld(true); f.renderer.render();
    const proxy = f.depth[0][0], first = f.meshes[0];
    expect(proxy.matrixWorld.elements).toEqual(first.matrixWorld.elements);
    expect(proxy.bindMatrixInverse.elements).toEqual(first.bindMatrixInverse.elements);
    expect(proxy.skeleton.bones[0]).toBe(f.bone); expect(f.owner.entries.size).toBe(1); f.owner.dispose();
});

test('partial shadow-frustum membership retains exact original mesh culling', () => {
    const f = fixture();
    f.meshes[0].boundingSphere = new THREE.Sphere(new THREE.Vector3(), .5);
    f.meshes[1].boundingSphere = new THREE.Sphere(new THREE.Vector3(1000, 0, 0), .5);
    f.renderer.render(); expect(f.owner.lastBatches).toBe(0); expect(f.depth).toEqual([f.meshes]); f.owner.dispose();
});

test('each directional light uses its own current viewport membership', () => {
    const f = fixture(), other = new THREE.DirectionalLight(); other.position.set(100, 0, 10);
    other.target.position.x = 100; f.scene.add(other, other.target); f.scene.updateMatrixWorld(true); f.lights.push(other);
    f.renderer.render(); expect(f.depth[0]).toHaveLength(1); expect(f.depth[1]).toEqual(f.meshes);
    expect(f.owner.lastBatches).toBe(1); expect(f.meshes.every(mesh => mesh.castShadow)).toBe(true); f.owner.dispose();
});

test.each(['nested-render', 'nested-shadow', 'throw'])('%s restores original meshes and light hooks', mode => {
    const f = fixture(), failure = new Error('original shadow failure'); let nested = false;
    const original = f.owner.originalShadow;
    original.mockImplementation(() => {
        f.light.shadow.updateMatrices(f.light, 0);
        const casters = []; f.scene.traverseVisible(mesh => { if (mesh.isMesh && mesh.castShadow) casters.push(mesh); });
        if (nested) { expect(casters).toEqual(f.meshes); return; }
        expect(casters).toHaveLength(1); expect(casters[0]).not.toBe(f.meshes[0]);
        if (mode === 'throw') throw failure;
        nested = true;
        if (mode === 'nested-render') f.renderer.render();
        else f.shadowMap.render(f.lights, f.scene, f.camera);
        expect(f.meshes.every(mesh => !mesh.castShadow)).toBe(true);
    });
    if (mode === 'throw') expect(() => f.renderer.render()).toThrow(failure); else f.renderer.render();
    expect(f.meshes.every(mesh => mesh.castShadow)).toBe(true); expect(f.owner.active).toHaveLength(0);
    expect(f.owner.depth).toBe(0); expect(Object.hasOwn(f.light.shadow, 'updateMatrices')).toBe(false);
    expect(f.colored.every(meshes => meshes.length === 2)).toBe(true); f.owner.dispose();
});

test.each(['source-geometry', 'position-version', 'index-version', 'skin-version', 'storage', 'skeleton', 'inverse', 'bind', 'detach', 'candidate-version'])('%s retires only owned geometry and material', mode => {
    const f = fixture(), entry = [...f.owner.entries][0], owned = jest.fn(), material = jest.fn(), source = jest.fn(), palette = jest.spyOn(f.skeleton, 'dispose');
    entry.proxy.geometry.addEventListener('dispose', owned); entry.proxy.material.addEventListener('dispose', material);
    f.meshes[0].geometry.addEventListener('dispose', source);
    if (mode === 'source-geometry') f.meshes[0].geometry = f.meshes[0].geometry.clone();
    if (mode === 'position-version') f.meshes[0].geometry.attributes.position.needsUpdate = true;
    if (mode === 'index-version') f.meshes[0].geometry.index.needsUpdate = true;
    if (mode === 'skin-version') f.meshes[0].geometry.attributes.skinWeight.needsUpdate = true;
    if (mode === 'storage') f.meshes[0].geometry.attributes.position.array = new Float32Array(9);
    if (mode === 'skeleton') f.meshes[0].skeleton = new THREE.Skeleton([f.bone]);
    if (mode === 'inverse') f.skeleton.boneInverses[0].elements[12] = 1;
    if (mode === 'bind') f.meshes[0].bindMatrix.elements[12] = 1;
    if (mode === 'detach') f.meshes[0].removeFromParent();
    if (mode === 'candidate-version') entry.proxy.geometry.attributes.position.needsUpdate = true;
    f.renderer.render(); expect(f.owner.entries.size).toBe(0); expect(f.owner.claimed.size).toBe(0);
    expect(owned).toHaveBeenCalledTimes(1); expect(material).toHaveBeenCalledTimes(1);
    expect(source).not.toHaveBeenCalled(); expect(palette).not.toHaveBeenCalled(); f.owner.dispose(); expect(owned).toHaveBeenCalledTimes(1);
});

test.each(['alpha', 'hidden', 'layer', 'no-shadow', 'different-side', 'morph', 'custom-depth', 'custom-callback', 'other-custom-callback', 'point-light', 'spot-light', 'custom-light-update', 'VSM', 'disabled', 'cached-map', 'cached-light'])('unsupported live %s keeps original shadow submission', mode => {
    const f = fixture(), mesh = f.meshes[0];
    if (mode === 'alpha') mesh.material.alphaTest = .5;
    if (mode === 'hidden') mesh.visible = false;
    if (mode === 'layer') mesh.layers.set(3);
    if (mode === 'no-shadow') mesh.castShadow = false;
    if (mode === 'different-side') mesh.material.side = THREE.BackSide;
    if (mode === 'morph') mesh.geometry.morphAttributes.position = [mesh.geometry.attributes.position.clone()];
    if (mode === 'custom-depth') mesh.customDepthMaterial = new THREE.MeshDepthMaterial();
    if (mode === 'custom-callback') mesh.onBeforeShadow = () => {};
    if (mode === 'other-custom-callback') { const other = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()); other.castShadow = true; other.onAfterShadow = () => {}; f.scene.add(other); }
    if (mode === 'point-light') f.lights[0] = new THREE.PointLight();
    if (mode === 'spot-light') f.lights[0] = new THREE.SpotLight();
    if (mode === 'custom-light-update') f.light.shadow.updateMatrices = () => {};
    if (mode === 'VSM') f.shadowMap.type = THREE.VSMShadowMap;
    if (mode === 'disabled') f.owner.enabled = false;
    if (mode === 'cached-map') { f.shadowMap.autoUpdate = false; f.shadowMap.needsUpdate = false; }
    if (mode === 'cached-light') { f.light.shadow.autoUpdate = false; f.light.shadow.needsUpdate = false; }
    const flags = f.meshes.map(mesh => mesh.castShadow); f.renderer.render();
    expect(f.owner.lastBatches).toBe(0); expect(f.meshes.map(mesh => mesh.castShadow)).toEqual(flags);
    expect(f.scene.children.every(child => child.name !== 'OpaqueSkinnedShadowBatch')).toBe(true); f.owner.dispose();
});

test('source disposal and repeated owner disposal release each owned resource once', () => {
    const f = fixture(), entry = [...f.owner.entries][0], geometry = jest.fn(), material = jest.fn();
    entry.proxy.geometry.addEventListener('dispose', geometry); entry.proxy.material.addEventListener('dispose', material);
    f.meshes[1].geometry.dispose(); f.owner.dispose(); f.owner.dispose();
    expect(geometry).toHaveBeenCalledTimes(1); expect(material).toHaveBeenCalledTimes(1);
    expect(f.renderer.render).toBe(f.owner.originalRender); expect(f.shadowMap.render).toBe(f.owner.originalShadow);
});

test.each(['stock', 'foreign-sort', 'before-render', 'before-shadow', 'after-shadow'])('unrelated BatchedMesh %s callback qualification', mode => {
    const f = fixture(), batch = new THREE.BatchedMesh(1, 3, 3, new THREE.MeshStandardMaterial());
    batch.castShadow = true; f.scene.add(batch);
    if (mode === 'foreign-sort') batch.setCustomSort(() => {});
    if (mode === 'before-render') batch.onBeforeRender = () => {};
    if (mode === 'before-shadow') batch.onBeforeShadow = () => {};
    if (mode === 'after-shadow') batch.onAfterShadow = () => {};
    f.renderer.render();
    expect(f.owner.lastSavedSubmissions).toBe(mode === 'stock' ? 1 : 0);
    expect(f.meshes.every(mesh => mesh.castShadow)).toBe(true);
    f.owner.dispose(); batch.dispose(); batch.material.dispose();
});

test('fullscreen composer passes preserve the last world submission count', () => {
    const f = fixture(); f.renderer.render();
    expect(f.owner.lastSavedSubmissions).toBe(1);
    f.shadowMap.render([], new THREE.Scene(), f.camera);
    expect(f.owner.lastSavedSubmissions).toBe(1);
    expect(f.owner.lastBatches).toBe(1); f.owner.dispose();
});

test('duplicate roots cannot claim sources twice and later wrappers survive disposal', () => {
    const f = fixture(); expect(f.owner.register(f.root)).toBe(0);
    const render = () => {}, shadow = () => {}; f.renderer.render = render; f.shadowMap.render = shadow;
    f.owner.dispose(); expect(f.renderer.render).toBe(render); expect(f.shadowMap.render).toBe(shadow);
});


test.each(['geometry', 'material'])('foreign proxy %s is never disposed during retirement', kind => {
    const f = fixture(), entry = [...f.owner.entries][0], original = entry[kind], owned = jest.fn();
    const foreign = kind === 'geometry' ? f.meshes[0].geometry : f.meshes[0].material, untouched = jest.fn();
    original.addEventListener('dispose', owned); foreign.addEventListener('dispose', untouched);
    entry.proxy[kind] = foreign; f.renderer.render();
    expect(f.owner.entries.size).toBe(0); expect(owned).toHaveBeenCalledTimes(1);
    expect(untouched).not.toHaveBeenCalled(); f.owner.dispose();
});

test('nested source retirement cannot reinstall a stale proxy', () => {
    const f = fixture(); let nested = false;
    f.owner.originalShadow.mockImplementation(() => {
        f.light.shadow.updateMatrices(f.light, 0);
        if (nested) { f.meshes[0].geometry.attributes.position.needsUpdate = true; return; }
        nested = true; f.renderer.render();
        expect(f.owner.active).toHaveLength(0); expect(f.meshes.every(mesh => mesh.castShadow)).toBe(true);
    });
    f.renderer.render(); expect(f.owner.entries.size).toBe(0); f.owner.dispose();
});
