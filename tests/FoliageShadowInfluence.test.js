import * as THREE from 'three';
import { FoliageShadowInfluence, getDirectionalShadowInfluenceBounds, shadowInfluenceIntersectsFrustum } from '../src/core/FoliageShadowInfluence.js';
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

test('the production render finally restores caster flags even when drawing throws', () => {
    const s = fixture(); s.mesh.position.set(100, 5, 0); s.scene.updateMatrixWorld(true);
    const render = Object.create(RenderSystem.prototype);
    render.scene = s.scene; render.camera = s.camera; render.foliageShadowInfluence = s.controller;
    render.renderer = {
        info: { autoReset: true, reset() {} },
        render() { s.controller.beginFrame(s.scene, s.camera, s.light); throw new Error('fixture-draw-failure'); }
    };
    expect(() => render.render()).toThrow('fixture-draw-failure');
    expect(s.mesh.castShadow).toBe(true); expect(s.controller.omitted.size).toBe(0);
    expect(render.renderer.info.autoReset).toBe(true);
});
