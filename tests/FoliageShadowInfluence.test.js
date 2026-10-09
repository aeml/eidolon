import * as THREE from 'three';
import { jest } from '@jest/globals';
import { FoliageShadowInfluence, getDirectionalShadowInfluenceBounds, getShadowFilterWorldPadding, shadowInfluenceIntersectsFrustum } from '../src/core/FoliageShadowInfluence.js';
import { SHADOW_RECEIVER_MIN_HEIGHT } from '../src/core/ShadowViewCoverage.js';
import { RenderSystem } from '../src/core/RenderSystem.js';

function fixture() {
    const scene = new THREE.Scene(), group = new THREE.Group();
    group.userData = { proceduralFoliage: true, region: 'earth' };
    scene.add(group);
    const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, .1, 200);
    camera.up.set(0, 0, -1); camera.position.set(0, 100, 0); camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    const light = new THREE.DirectionalLight();
    light.position.set(50, 100, 0); scene.add(light, light.target);
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshStandardMaterial(), 1);
    mesh.setMatrixAt(0, new THREE.Matrix4()); mesh.computeBoundingBox();
    mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
    return { scene, group, mesh, camera, light, controller: new FoliageShadowInfluence() };
}

test('unchanged qualified bounds are reused but parent transforms and live bound edits immediately invalidate them', () => {
    const s = fixture(); s.mesh.position.set(100, 5, 0); s.scene.updateMatrixWorld(true);
    const transform = jest.spyOn(THREE.Box3.prototype, 'applyMatrix4');
    try {
        const frame = () => { s.controller.beginFrame(s.scene, s.camera, s.light); s.controller.endFrame(); };
        frame(); expect(transform).toHaveBeenCalledTimes(1);
        frame(); expect(transform).toHaveBeenCalledTimes(1);
        s.group.position.x = -100; s.scene.updateMatrixWorld(true);
        s.controller.beginFrame(s.scene, s.camera, s.light);
        expect(transform).toHaveBeenCalledTimes(2); expect(s.mesh.castShadow).toBe(true); s.controller.endFrame();
        s.mesh.boundingBox.translate(new THREE.Vector3(100, 0, 0));
        s.controller.beginFrame(s.scene, s.camera, s.light);
        expect(transform).toHaveBeenCalledTimes(3); expect(s.mesh.castShadow).toBe(false); s.controller.endFrame();
        s.mesh.boundingBox = new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
        s.controller.beginFrame(s.scene, s.camera, s.light);
        expect(transform).toHaveBeenCalledTimes(4); expect(s.mesh.castShadow).toBe(true); s.controller.endFrame();
    } finally { transform.mockRestore(); s.controller.dispose(); }
});

test('unchanged cached bounds reuse validity without copying or rechecking the box each frame', () => {
    const s = fixture(); s.mesh.position.set(100, 5, 0); s.scene.updateMatrixWorld(true);
    s.controller.beginFrame(s.scene, s.camera, s.light); s.controller.endFrame();
    const validity = jest.spyOn(THREE.Box3.prototype, 'isEmpty');
    const copy = jest.spyOn(THREE.Box3.prototype, 'copy');
    try {
        s.controller.beginFrame(s.scene, s.camera, s.light);
        expect(s.mesh.castShadow).toBe(false);
        expect(validity).not.toHaveBeenCalled(); expect(copy).not.toHaveBeenCalled();
        s.controller.endFrame();
        s.mesh.boundingBox.max.y = 400;
        s.controller.beginFrame(s.scene, s.camera, s.light);
        expect(validity).toHaveBeenCalled(); expect(copy).toHaveBeenCalled();
        expect(s.mesh.castShadow).toBe(true);
    } finally { validity.mockRestore(); copy.mockRestore(); s.controller.dispose(); }
});

test.each(['empty', 'infinite', 'nan', 'matrix'])('invalid %s bounds stay conservative and recover immediately', kind => {
    const s = fixture(); s.mesh.position.set(100, 5, 0); s.scene.updateMatrixWorld(true);
    const frame = expected => {
        s.controller.beginFrame(s.scene, s.camera, s.light);
        expect(s.mesh.castShadow).toBe(expected); s.controller.endFrame();
    };
    frame(false);
    if (kind === 'empty') s.mesh.boundingBox.makeEmpty();
    if (kind === 'infinite') s.mesh.boundingBox.max.x = Infinity;
    if (kind === 'nan') s.mesh.boundingBox.min.z = NaN;
    if (kind === 'matrix') s.mesh.matrixWorld.elements[0] = NaN;
    frame(true); frame(true);
    s.mesh.computeBoundingBox(); s.scene.updateMatrixWorld(true);
    frame(false); s.controller.dispose();
});

test.each([false, true])('scalar and multi-material live wind changes remain authoritative (ground cover: %s)', groundCover => {
    const s = fixture(); s.mesh.position.set(100, 5, 0); s.scene.updateMatrixWorld(true);
    if (groundCover) {
        s.group.userData = { earthUnderstory: true }; s.mesh.castShadow = false;
        s.mesh.userData.windBoundsIncluded = true;
    }
    const a = s.mesh.material, b = new THREE.MeshStandardMaterial();
    a.userData.woodlandWind = groundCover; b.userData.woodlandWind = groundCover;
    const frame = eligible => {
        s.controller.beginFrame(s.scene, s.camera, s.light);
        expect(groundCover ? !s.mesh.visible : !s.mesh.castShadow).toBe(eligible);
        s.controller.endFrame();
    };
    frame(true);
    s.mesh.material = [a, b]; frame(true);
    b.userData.woodlandWind = !groundCover; frame(false);
    b.userData.woodlandWind = groundCover; frame(true);
    a.userData.woodlandWind = !groundCover; frame(false);
    s.mesh.material = b; frame(true);
    if (groundCover) { s.mesh.add(new THREE.Group()); frame(false); }
    s.controller.dispose(); b.dispose();
});

test('stationary ground-cover decisions skip repeated frustum work but immediately follow camera and bounds', () => {
    const s = fixture(); s.group.userData = { earthUnderstory: true }; s.mesh.castShadow = false;
    s.mesh.userData.windBoundsIncluded = true; s.mesh.material.userData.woodlandWind = true;
    s.mesh.position.set(100, 5, 0); s.scene.updateMatrixWorld(true);
    const frame = () => { s.controller.beginFrame(s.scene, s.camera, null); s.controller.endFrame(); };
    frame();
    const intersect = jest.spyOn(s.controller.viewFrustum, 'intersectsBox');
    try {
        frame(); frame(); expect(intersect).not.toHaveBeenCalled();
        s.camera.position.x = 100; s.camera.updateMatrixWorld(true);
        s.controller.beginFrame(s.scene, s.camera, null);
        expect(s.mesh.visible).toBe(true); expect(intersect).toHaveBeenCalledTimes(1); s.controller.endFrame();
        s.mesh.boundingBox.translate(new THREE.Vector3(100, 0, 0));
        s.controller.beginFrame(s.scene, s.camera, null);
        expect(s.mesh.visible).toBe(false); expect(intersect).toHaveBeenCalledTimes(2); s.controller.endFrame();
        s.mesh.position.x = 0; s.scene.updateMatrixWorld(true);
        s.controller.beginFrame(s.scene, s.camera, null);
        expect(s.mesh.visible).toBe(true); expect(intersect).toHaveBeenCalledTimes(3); s.controller.endFrame();
        s.camera.zoom = .5; s.camera.updateProjectionMatrix(); frame();
        expect(intersect).toHaveBeenCalledTimes(4);
    } finally { intersect.mockRestore(); s.controller.dispose(); }
});

test('stationary shadow decisions skip plane math and invalidate on live light/filter/camera inputs', () => {
    const s = fixture(); s.mesh.position.set(30, 5, 0); s.scene.updateMatrixWorld(true);
    const frame = (expected, type = THREE.PCFSoftShadowMap) => {
        s.controller.beginFrame(s.scene, s.camera, s.light, type);
        expect(s.mesh.castShadow).toBe(expected); s.controller.endFrame();
    };
    frame(false);
    const normals = s.controller.frustum.planes.map(plane => plane.normal);
    let reads = 0;
    for (const normal of normals) {
        let x = normal.x;
        Object.defineProperty(normal, 'x', { configurable: true, enumerable: true,
            get() { reads++; return x; }, set(value) { x = value; } });
    }
    try {
        frame(false); frame(false); expect(reads).toBe(0);
        s.light.position.x = 500; s.scene.updateMatrixWorld(true); frame(true);
        expect(reads).toBeGreaterThan(0); reads = 0;
        frame(true); expect(reads).toBe(0);
        s.light.position.x = 50; s.scene.updateMatrixWorld(true); frame(false);
        s.light.shadow.bias = 1; frame(true);
        s.light.shadow.bias = 0; frame(false);
        frame(true, THREE.VSMShadowMap); frame(false);
        s.camera.position.x = 30; s.camera.updateMatrixWorld(true); frame(true);
        s.camera.position.x = 0; s.camera.updateMatrixWorld(true); frame(false);
        s.mesh.boundingBox.max.y = 100; frame(true);
        reads = 0; frame(true); expect(reads).toBe(0);
    } finally {
        for (const normal of normals) {
            const x = normal.x;
            Object.defineProperty(normal, 'x', { configurable: true, enumerable: true, writable: true, value: x });
        }
        s.controller.dispose();
    }
});

test('detaching a registered root through an unwatched container restores its owned matrix hooks', () => {
    const s = fixture(), wrapper = new THREE.Group(); s.scene.add(wrapper); wrapper.add(s.group);
    const original = s.group.updateMatrixWorld;
    const controller = new FoliageShadowInfluence(s.scene, [s.scene]);
    expect(s.group.updateMatrixWorld).not.toBe(original);
    wrapper.remove(s.group); controller.beginFrame(s.scene, s.camera, s.light);
    expect(s.group.updateMatrixWorld).toBe(original); expect(controller.matrixRestorers.size).toBe(0);
    controller.dispose(); s.controller.dispose();
});

test('registered foliage roots avoid scanning unrelated actors and retain add/remove/visibility ownership', () => {
    const s = fixture(), background = new THREE.Group(); s.scene.add(background);
    for (let index = 0; index < 200; index++) background.add(new THREE.Group());
    const wrapper = new THREE.Group(); s.scene.add(wrapper);
    const controller = new FoliageShadowInfluence(s.scene, [s.scene, wrapper]);
    const visited = [];
    const original = controller.visit;
    controller.visit = object => { visited.push(object); original(object); };
    s.mesh.position.set(100, 5, 0); s.scene.updateMatrixWorld(true);
    controller.beginFrame(s.scene, s.camera, s.light);
    expect(visited).toEqual([s.group, s.mesh]); expect(s.mesh.castShadow).toBe(false);
    controller.endFrame();
    const extra = new THREE.Group(); extra.userData = { proceduralFoliage: true, region: 'earth' };
    const caster = s.mesh.clone(); extra.add(caster); s.scene.add(extra); s.scene.updateMatrixWorld(true);
    visited.length = 0; controller.beginFrame(s.scene, s.camera, s.light);
    expect(visited).toContain(caster); expect(caster.castShadow).toBe(false); controller.endFrame();
    wrapper.add(extra); wrapper.visible = false;
    visited.length = 0; controller.beginFrame(s.scene, s.camera, s.light);
    expect(visited).not.toContain(caster); expect(caster.castShadow).toBe(true); controller.endFrame();
    wrapper.visible = true;
    visited.length = 0; controller.beginFrame(s.scene, s.camera, s.light);
    expect(visited).toContain(caster); expect(caster.castShadow).toBe(false); controller.endFrame();
    extra.removeFromParent();
    visited.length = 0; controller.beginFrame(s.scene, s.camera, s.light);
    expect(visited).not.toContain(caster); controller.endFrame();
    s.scene.add(extra); s.scene.updateMatrixWorld(true);
    controller.beginFrame(s.scene, s.camera, s.light); expect(caster.castShadow).toBe(false);
    controller.dispose(); expect(s.mesh.castShadow).toBe(true); expect(caster.castShadow).toBe(true);
    expect(controller.roots.size).toBe(0); controller.dispose();
});

test('filter padding includes complete texel footprint, depth and normal bias without changing the shadow map', () => {
    const shadow = new THREE.DirectionalLight().shadow;
    Object.assign(shadow.camera, { left: -100, right: 100, bottom: -200, top: 200, near: 1, far: 1001 });
    shadow.mapSize.set(1000, 2000); shadow.radius = 4.5; shadow.bias = -.0001; shadow.normalBias = .05;
    for (const type of [THREE.BasicShadowMap, THREE.PCFShadowMap, THREE.PCFSoftShadowMap]) {
        expect(getShadowFilterWorldPadding(shadow, type)).toBeCloseTo(Math.hypot(.2, .2) * 5.5 + .1 + .05 + .0001, 10);
    }
    expect(shadow.mapSize.toArray()).toEqual([1000, 2000]); expect(shadow.radius).toBe(4.5);
});

test('clamped hardware and existing smaller render targets increase the retained filter margin', () => {
    const shadow = new THREE.DirectionalLight().shadow;
    shadow.mapSize.set(4096, 4096);
    const requested = getShadowFilterWorldPadding(shadow);
    const clamped = getShadowFilterWorldPadding(shadow, THREE.PCFSoftShadowMap, 1024);
    expect(clamped).toBeGreaterThan(requested);
    shadow.map = { width: 512, height: 512 };
    expect(getShadowFilterWorldPadding(shadow, THREE.PCFSoftShadowMap, 1024)).toBeGreaterThan(clamped);
});

test('unknown filters, invalid maps and non-orthographic lights conservatively retain their casters', () => {
    const s = fixture(); s.mesh.position.set(100, 5, 0); s.scene.updateMatrixWorld(true);
    expect(getShadowFilterWorldPadding(s.light.shadow, THREE.VSMShadowMap)).toBeNull();
    s.controller.beginFrame(s.scene, s.camera, s.light, THREE.VSMShadowMap); expect(s.mesh.castShadow).toBe(true);
    s.light.shadow.mapSize.x = 0;
    expect(getShadowFilterWorldPadding(s.light.shadow)).toBeNull();
    s.controller.beginFrame(s.scene, s.camera, s.light); expect(s.mesh.castShadow).toBe(true);
    s.light.shadow.mapSize.x = 512; s.light.shadow.camera = new THREE.PerspectiveCamera();
    expect(getShadowFilterWorldPadding(s.light.shadow)).toBeNull();
});

test.each([new THREE.Vector3(1, 2, 1), new THREE.Vector3(-1, 2, -1)])('swept bounds contain every sampled caster ray, not just its ground footprint', sun => {
    const caster = new THREE.Box3(new THREE.Vector3(-3, 2, -7), new THREE.Vector3(5, 31, 4));
    const bounds = getDirectionalShadowInfluenceBounds(caster, sun, new THREE.Box3());
    for (const x of [-3, 1, 5]) for (const y of [2, 12, 31]) for (const z of [-7, 0, 4]) {
        const point = new THREE.Vector3(x, y, z);
        const distance = (y - SHADOW_RECEIVER_MIN_HEIGHT) / sun.y;
        for (const fraction of [0, .25, .5, .75, 1]) {
            const receiver = point.clone().addScaledVector(sun, -distance * fraction);
            expect(bounds.clone().expandByScalar(1e-8).containsPoint(receiver)).toBe(true);
        }
    }
});

test('an off-screen tall caster keeps shadows that travel into the visible view', () => {
    const s = fixture(); s.mesh.position.set(18, 30, 0); s.scene.updateMatrixWorld(true);
    const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(s.camera.projectionMatrix, s.camera.matrixWorldInverse));
    expect(frustum.intersectsBox(s.mesh.boundingBox.clone().applyMatrix4(s.mesh.matrixWorld))).toBe(false);
    s.controller.beginFrame(s.scene, s.camera, s.light);
    expect(s.mesh.castShadow).toBe(true);
    s.controller.endFrame();
});

test('the separating-plane test retains every sampled ray that reaches the actual view', () => {
    const s = fixture();
    const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(s.camera.projectionMatrix, s.camera.matrixWorldInverse));
    let visibleRays = 0, rejected = 0;
    for (const sun of [new THREE.Vector3(-3, 5, 2), new THREE.Vector3(2, 5, -3)]) {
        for (const x of [-60, -25, 0, 25, 60]) for (const z of [-60, -25, 0, 25, 60]) {
            const box = new THREE.Box3(new THREE.Vector3(x - 2, 1, z - 2), new THREE.Vector3(x + 2, 35, z + 2));
            const intersects = shadowInfluenceIntersectsFrustum(box, sun, frustum);
            if (!intersects) rejected++;
            for (const height of [1, 12, 35]) for (const fraction of [0, .25, .5, .75, 1]) {
                const point = new THREE.Vector3(x, height, z).addScaledVector(sun, -(height - SHADOW_RECEIVER_MIN_HEIGHT) / sun.y * fraction);
                if (frustum.containsPoint(point)) { visibleRays++; expect(intersects).toBe(true); }
            }
        }
    }
    expect(visibleRays).toBeGreaterThan(0); expect(rejected).toBeGreaterThan(0);
});

test('only irrelevant shadow submission is omitted and every flag is restored after the frame', () => {
    const s = fixture(); s.mesh.position.set(100, 5, 0); s.scene.updateMatrixWorld(true);
    const geometry = s.mesh.geometry, positions = geometry.attributes.position.array.slice();
    const instances = s.mesh.instanceMatrix.array.slice();
    s.controller.beginFrame(s.scene, s.camera, s.light);
    expect(s.mesh.castShadow).toBe(false); expect(s.mesh.visible).toBe(true);
    expect(s.mesh.receiveShadow).toBe(true); expect(s.controller.omitted.size).toBe(1);
    expect(s.mesh.geometry).toBe(geometry); expect(geometry.attributes.position.array).toEqual(positions);
    expect(s.mesh.instanceMatrix.array).toEqual(instances);
    s.controller.endFrame(); expect(s.mesh.castShadow).toBe(true); expect(s.controller.omitted.size).toBe(0);
    s.mesh.position.set(0, 5, 0); s.scene.updateMatrixWorld(true);
    s.controller.beginFrame(s.scene, s.camera, s.light); expect(s.mesh.castShadow).toBe(true);
    s.controller.endFrame();
});

test('unknown, moving, non-Earth and originally noncasting objects are never opted into culling', () => {
    const s = fixture(); s.mesh.position.set(100, 5, 0); s.scene.updateMatrixWorld(true);
    for (const setup of [
        () => { s.group.userData.region = 'water'; },
        () => { s.group.userData.region = 'earth'; s.mesh.boundingBox = null; },
        () => { s.mesh.computeBoundingBox(); s.mesh.material.userData.woodlandWind = true; },
        () => { s.mesh.material.userData.woodlandWind = false; s.mesh.castShadow = false; }
    ]) {
        setup(); const original = s.mesh.castShadow;
        s.controller.beginFrame(s.scene, s.camera, s.light);
        expect(s.mesh.castShadow).toBe(original); expect(s.controller.omitted.size).toBe(0);
        s.controller.endFrame(); expect(s.mesh.castShadow).toBe(original);
    }
});

test('disabled culling and horizontal illumination conservatively retain all original casters', () => {
    const s = fixture(); s.mesh.position.set(100, 5, 0); s.scene.updateMatrixWorld(true);
    s.controller.enabled = false; s.controller.beginFrame(s.scene, s.camera, s.light);
    expect(s.mesh.castShadow).toBe(true);
    s.controller.enabled = true; s.light.position.set(100, 0, 0); s.scene.updateMatrixWorld(true);
    s.controller.beginFrame(s.scene, s.camera, s.light); expect(s.mesh.castShadow).toBe(true);
    s.controller.endFrame();
});

test('a new frame restores an interrupted frame before considering current visibility', () => {
    const s = fixture(); s.mesh.position.set(100, 5, 0); s.scene.updateMatrixWorld(true);
    s.controller.beginFrame(s.scene, s.camera, s.light); expect(s.mesh.castShadow).toBe(false);
    s.group.visible = false;
    s.controller.beginFrame(s.scene, s.camera, s.light); expect(s.mesh.castShadow).toBe(true);
    expect(s.controller.omitted.size).toBe(0); s.controller.endFrame();
});

test.each([false, true])('production render finally restores scene flags even when drawing throws (ground cover: %s)', groundCover => {
    const s = fixture(); s.mesh.position.set(100, 5, 0); s.scene.updateMatrixWorld(true);
    if (groundCover) {
        s.group.userData = { earthUnderstory: true }; s.mesh.castShadow = false;
        s.mesh.userData.windBoundsIncluded = true; s.mesh.material.userData.woodlandWind = true;
    }
    const render = Object.create(RenderSystem.prototype);
    render.scene = s.scene; render.camera = s.camera; render.foliageShadowInfluence = s.controller;
    render.renderer = {
        info: { autoReset: true, reset() {} },
        render() { s.controller.beginFrame(s.scene, s.camera, s.light); throw new Error('fixture-draw-failure'); }
    };
    expect(() => render.render()).toThrow('fixture-draw-failure');
    expect(s.mesh.castShadow).toBe(!groundCover); expect(s.mesh.visible).toBe(true);
    expect(s.controller.omitted.size).toBe(0); expect(s.controller.hidden.size).toBe(0);
    expect(render.renderer.info.autoReset).toBe(true);
});

test('noncasting ground cover uses complete wind bounds even when shadows are disabled and restores visibility', () => {
    const s = fixture(); s.group.userData = { earthUnderstory: true };
    s.mesh.userData.windBoundsIncluded = true; s.mesh.castShadow = false;
    s.mesh.material.userData.woodlandWind = true;
    s.mesh.position.set(100, 5, 0); s.scene.updateMatrixWorld(true);
    s.controller.beginFrame(s.scene, s.camera, null);
    expect(s.mesh.visible).toBe(false); expect(s.mesh.castShadow).toBe(false);
    expect(s.controller.hidden.size).toBe(1);
    s.controller.endFrame(); expect(s.mesh.visible).toBe(true); expect(s.mesh.castShadow).toBe(false);
    expect(s.controller.hidden.size).toBe(0);
    s.mesh.position.set(0, 5, 0); s.scene.updateMatrixWorld(true);
    s.controller.beginFrame(s.scene, s.camera, null); expect(s.mesh.visible).toBe(true);
    s.controller.endFrame();
});

test('unqualified wind bounds and explicitly disabled frustum culling stay untouched', () => {
    const s = fixture(); s.group.userData = { earthUnderstory: true }; s.mesh.castShadow = false;
    s.mesh.material.userData.woodlandWind = true; s.mesh.position.set(100, 5, 0); s.scene.updateMatrixWorld(true);
    s.controller.beginFrame(s.scene, s.camera, null); expect(s.mesh.visible).toBe(true);
    s.mesh.userData.windBoundsIncluded = true; s.mesh.frustumCulled = false;
    s.controller.beginFrame(s.scene, s.camera, null); expect(s.mesh.visible).toBe(true);
    expect(s.controller.hidden.size).toBe(0); s.controller.endFrame();
});
