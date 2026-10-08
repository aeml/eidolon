import * as THREE from 'three';
import { jest } from '@jest/globals';
import { RenderSystem } from '../src/core/RenderSystem.js';
import { getShadowViewBounds } from '../src/core/ShadowViewCoverage.js';

describe('RenderSystem shadow coverage', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('tracks the directional shadow camera around the player instead of a tiny origin-bound frustum', () => {
        const renderSystem = new RenderSystem(false);

        renderSystem.setCameraTarget(new THREE.Vector3(2200, 0, -1400));
        renderSystem.updateEnvironmentLighting(new THREE.Vector3(2200, 0, -1400), 0.016);

        expect(renderSystem.keyLight.position.clone().sub(renderSystem.keyLight.target.position).distanceTo(
            renderSystem.shadowFollowOffset)).toBeLessThan(.00001);
        const texelSize = renderSystem.getShadowWorldTexelSize();
        expect(Math.abs(renderSystem.keyLight.target.position.x - 2200)).toBeLessThanOrEqual(texelSize / 2);
        expect(Math.abs(renderSystem.keyLight.target.position.z + 1400)).toBeLessThanOrEqual(texelSize / 2);
        expect(renderSystem.keyLight.shadow.camera.left).toBe(renderSystem.shadowViewBounds.left);
        expect(renderSystem.keyLight.shadow.camera.right).toBe(renderSystem.shadowViewBounds.right);
        expect(renderSystem.keyLight.shadow.camera.far).toBe(renderSystem.shadowViewBounds.far);
        expect(renderSystem.keyLight.shadow.camera.near).toBe(1);
        expect(renderSystem.keyLight.shadow.camera.far).toBeLessThan(1000);
        expect(renderSystem.keyLight.shadow.bias * (renderSystem.keyLight.shadow.camera.far - 1)).toBeCloseTo(-0.00014 * 1399, 8);
        expect(renderSystem.shadowCoverageRadius).toBeLessThan(280);
    });

    test('cross-lighting separates the visible faces while preserving ground illumination', () => {
        const renderSystem = new RenderSystem(false);
        const key = renderSystem.shadowFollowOffset.clone().normalize();
        const eye = renderSystem.cameraOffset.clone().normalize();
        expect(key.dot(eye)).toBeLessThan(.6);
        expect(key.x * key.z).toBeLessThan(0);
        // Similar elevation avoids darkening the entire floor to gain contrast.
        expect(key.y).toBeGreaterThan(.7); expect(key.y).toBeLessThan(.85);
        const fill = renderSystem.fillLight.position.clone().sub(renderSystem.fillLight.target.position).normalize();
        expect(fill.dot(eye)).toBeGreaterThan(.9);
        expect(renderSystem.fillLight.castShadow).toBe(false);
        expect(renderSystem.keyLight.position.clone().sub(renderSystem.keyLight.target.position).normalize().distanceTo(key)).toBeLessThan(.00001);
        renderSystem.dispose();
    });

    test.each([0, 6, 42])('fits against the actual snapped light target at elevation %s', height => {
        const renderSystem = new RenderSystem(false);
        const focus = new THREE.Vector3(2200.133, height, -1400.371);
        renderSystem.setCameraTarget(focus);
        renderSystem.updateShadowFocus(focus);
        const actualTarget = renderSystem.keyLight.target.position;
        const expected = getShadowViewBounds(renderSystem.camera, renderSystem.cameraOffset,
            renderSystem.shadowFollowOffset, renderSystem.cameraTarget.clone().sub(actualTarget));
        expect(renderSystem.shadowViewBounds).toEqual(expected);
        expect(actualTarget.y).toBe(0);
        expect(renderSystem.keyLight.position.clone().sub(actualTarget).distanceTo(
            renderSystem.shadowFollowOffset)).toBeLessThan(.00001);
        const shadowCamera = renderSystem.keyLight.shadow.camera;
        shadowCamera.position.copy(renderSystem.keyLight.position);
        shadowCamera.lookAt(actualTarget);
        shadowCamera.updateMatrixWorld(true);
        renderSystem.camera.updateMatrixWorld(true);
        for (const x of [-1, 1]) for (const y of [-1, 1]) for (const receiverHeight of [-8, 0, 64]) {
            const ray = new THREE.Raycaster();
            ray.setFromCamera(new THREE.Vector2(x, y), renderSystem.camera);
            const receiver = ray.ray.intersectPlane(new THREE.Plane(
                new THREE.Vector3(0, 1, 0), -receiverHeight), new THREE.Vector3());
            expect(receiver).not.toBeNull();
            // Preserve the full receiver volume and off-screen incoming casters,
            // not just the ground directly beneath the elevated hero.
            for (const advance of [0, 60]) {
                const projected = receiver.clone().addScaledVector(
                    renderSystem.shadowFollowOffset.clone().normalize(), advance).project(shadowCamera);
                for (const component of ['x', 'y', 'z']) expect(Math.abs(projected[component])).toBeLessThan(1);
            }
        }
        renderSystem.dispose();
    });

    test('uses filtered shadow maps and keeps shadows updating while the light follows the player', () => {
        const renderSystem = new RenderSystem(false);

        expect(renderSystem.renderer.shadowMap.type).toBe(THREE.PCFSoftShadowMap);
        expect(renderSystem.renderer.shadowMap.enabled).toBe(true);
        expect(renderSystem.renderer.shadowMap.autoUpdate).toBe(true);
        expect(renderSystem.renderer.shadowMap.needsUpdate).toBe(true);
        expect(renderSystem.keyLight.shadow.autoUpdate).toBe(true);
        expect(renderSystem.keyLight.shadow.mapSize.width).toBeGreaterThanOrEqual(4096);
        expect(renderSystem.keyLight.shadow.radius).toBeGreaterThanOrEqual(4);
        expect(renderSystem.keyLight.shadow.bias).toBeLessThanOrEqual(-0.0001);
        expect(renderSystem.keyLight.shadow.normalBias).toBeGreaterThanOrEqual(0.04);
        expect(renderSystem.keyLight.shadow.camera.left).toBe(renderSystem.shadowViewBounds.left);
        expect(renderSystem.keyLight.shadow.camera.right).toBe(renderSystem.shadowViewBounds.right);
        expect(renderSystem.keyLight.shadow.normalBias).toBeGreaterThanOrEqual(0.03);
    });

    test('refreshes shadow frustum after graphics quality changes', () => {
        const renderSystem = new RenderSystem(false);
        renderSystem.setCameraTarget(new THREE.Vector3(-1900, 0, 900));
        renderSystem.updateEnvironmentLighting(new THREE.Vector3(-1900, 0, 900), 0.016);

        renderSystem.setGraphicsQuality('high');

        expect(renderSystem.keyLight.castShadow).toBe(true);
        expect(renderSystem.renderer.shadowMap.type).toBe(THREE.PCFSoftShadowMap);
        expect(renderSystem.keyLight.shadow.mapSize.width).toBeGreaterThanOrEqual(2048);
        expect(renderSystem.keyLight.shadow.camera.left).toBe(renderSystem.shadowViewBounds.left);
        expect(renderSystem.keyLight.shadow.camera.right).toBe(renderSystem.shadowViewBounds.right);
        const texelSize = renderSystem.getShadowWorldTexelSize();
        expect(Math.abs(renderSystem.keyLight.target.position.x + 1900)).toBeLessThanOrEqual(texelSize / 2);
        expect(Math.abs(renderSystem.keyLight.target.position.z - 900)).toBeLessThanOrEqual(texelSize / 2);
    });

    test('refits immediately when zoom changes without waiting for player movement', () => {
        const renderSystem = new RenderSystem(false);
        renderSystem.setZoom(5);
        const near = renderSystem.shadowCoverageRadius;
        const closeFar = renderSystem.keyLight.shadow.camera.far;
        renderSystem.setZoom(30);
        expect(renderSystem.shadowCoverageRadius).toBeGreaterThan(near);
        expect(renderSystem.keyLight.shadow.camera.right).toBe(renderSystem.shadowViewBounds.right);
        expect(renderSystem.keyLight.shadow.camera.far).toBeGreaterThan(closeFar);
        expect(renderSystem.getShadowWorldTexelSize()).toBe(renderSystem.shadowCoverageRadius * 2 / 4096);
        renderSystem.dispose();
    });

    test('setupLights removes reparented old lights and old directional targets before installing replacements', () => {
        const renderSystem = new RenderSystem(false);
        const oldAmbient = renderSystem.ambientLight;
        const oldKey = renderSystem.keyLight;
        const oldFill = renderSystem.fillLight;
        const oldTarget = renderSystem.keyLight.target;
        const otherParent = new THREE.Group();

        renderSystem.scene.remove(oldAmbient);
        renderSystem.scene.remove(oldKey);
        renderSystem.scene.remove(oldFill);
        renderSystem.scene.remove(oldTarget);
        otherParent.add(oldAmbient);
        otherParent.add(oldKey);
        otherParent.add(oldFill);
        otherParent.add(oldTarget);

        renderSystem.setupLights();

        expect(otherParent.children).toHaveLength(0);
        expect(renderSystem.ambientLight).not.toBe(oldAmbient);
        expect(renderSystem.keyLight).not.toBe(oldKey);
        expect(renderSystem.fillLight).not.toBe(oldFill);
        expect(renderSystem.keyLight.target).not.toBe(oldTarget);
        expect(renderSystem.scene.children).toContain(renderSystem.ambientLight);
        expect(renderSystem.scene.children).toContain(renderSystem.keyLight);
        expect(renderSystem.scene.children).toContain(renderSystem.fillLight);
        expect(renderSystem.scene.children).toContain(renderSystem.keyLight.target);
    });

    test('dispose removes reparented particle overlay from its current parent before disposing resources', () => {
        const renderSystem = new RenderSystem(false);
        renderSystem.initRealmParticles();
        const particleMesh = renderSystem._pMesh;
        const otherParent = new THREE.Group();
        const geometryDispose = jest.spyOn(particleMesh.geometry, 'dispose');
        const materialDispose = jest.spyOn(particleMesh.material, 'dispose');

        renderSystem.environmentGroup.remove(particleMesh);
        otherParent.add(particleMesh);

        renderSystem.dispose();

        expect(otherParent.children).toHaveLength(0);
        expect(geometryDispose).toHaveBeenCalledTimes(1);
        expect(materialDispose).toHaveBeenCalledTimes(1);
        expect(renderSystem._pMesh).toBeNull();
    });

    test('camera punch stays disabled until players opt in', () => {
        const renderSystem = new RenderSystem(false);
        const baseline = renderSystem.camera.position.clone();

        renderSystem.setCameraTarget(new THREE.Vector3(0, 0, 0));
        renderSystem.applyCameraPunch({ intensity: 1, duration: 0.25, vertical: 1, horizontal: 1 });

        expect(renderSystem.cameraPunch).toBeNull();
        expect(renderSystem.camera.position.x).toBeCloseTo(baseline.x, 6);
        expect(renderSystem.camera.position.y).toBeCloseTo(baseline.y, 6);
    });

    test('camera punch resumes when players enable it with softened scaling', () => {
        const renderSystem = new RenderSystem(false);
        jest.spyOn(performance, 'now').mockReturnValue(1000);

        renderSystem.setCameraShakeEnabled(true);
        renderSystem.applyCameraPunch({ intensity: 1, duration: 0.25, vertical: 1, horizontal: 1 });

        expect(renderSystem.cameraPunch).toEqual(expect.objectContaining({
            intensity: 0.175,
            duration: 0.14,
            vertical: 0.55,
            horizontal: 0.3
        }));
    });

    test('camera punch lasts its duration in seconds, decays and returns exactly to the camera target', () => {
        const renderSystem = new RenderSystem(false);
        const now = jest.spyOn(performance, 'now').mockReturnValue(1000);
        renderSystem.setCameraTarget(new THREE.Vector3(30, 0, -20));
        const baseline = renderSystem.camera.position.clone();
        renderSystem.setCameraShakeEnabled(true);
        renderSystem.applyCameraPunch({ intensity: 1, duration: 0.25, vertical: 1, horizontal: 1 });

        now.mockReturnValue(1035);
        renderSystem.updateCamera();
        expect(renderSystem.cameraPunch).not.toBeNull();
        expect(renderSystem.camera.position.distanceTo(baseline)).toBeGreaterThan(0.01);
        expect(renderSystem.camera.position.distanceTo(baseline)).toBeLessThan(0.35);

        now.mockReturnValue(1139);
        renderSystem.updateCamera();
        expect(renderSystem.cameraPunch).not.toBeNull();
        expect(renderSystem.camera.position.distanceTo(baseline)).toBeLessThan(0.01);

        now.mockReturnValue(1141);
        renderSystem.updateCamera();
        expect(renderSystem.cameraPunch).toBeNull();
        expect(renderSystem.camera.position.equals(baseline)).toBe(true);
    });

    test('snaps shadow focus to the shadow texel grid to reduce jitter on thin geometry while moving', () => {
        const renderSystem = new RenderSystem(false);

        const texelSize = renderSystem.getShadowWorldTexelSize();
        const insideSameTexelOffset = texelSize * 0.2;

        const start = new THREE.Vector3(Math.round(125 / texelSize) * texelSize, 0, Math.round(-43 / texelSize) * texelSize);
        renderSystem.setCameraTarget(start);
        renderSystem.updateEnvironmentLighting(start, 0.016);
        const firstTargetX = renderSystem.keyLight.target.position.x;
        const firstTargetZ = renderSystem.keyLight.target.position.z;
        const firstLightX = renderSystem.keyLight.position.x;
        const firstLightZ = renderSystem.keyLight.position.z;

        const moved = start.clone().add(new THREE.Vector3(insideSameTexelOffset, 0, -insideSameTexelOffset));
        renderSystem.setCameraTarget(moved);
        renderSystem.updateEnvironmentLighting(moved, 0.016);

        expect(renderSystem.keyLight.target.position.x).toBeCloseTo(firstTargetX, 6);
        expect(renderSystem.keyLight.target.position.z).toBeCloseTo(firstTargetZ, 6);
        expect(renderSystem.keyLight.position.x).toBeCloseTo(firstLightX, 6);
        expect(renderSystem.keyLight.position.z).toBeCloseTo(firstLightZ, 6);
    });
});
