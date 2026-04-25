import * as THREE from 'three';
import { jest } from '@jest/globals';
import { RenderSystem } from '../src/core/RenderSystem.js';

describe('RenderSystem shadow coverage', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test('tracks the directional shadow camera around the player instead of a tiny origin-bound frustum', () => {
        const renderSystem = new RenderSystem(false);

        renderSystem.updateEnvironmentLighting(new THREE.Vector3(2200, 0, -1400), 0.016);

        expect(renderSystem.keyLight.position.x).toBeGreaterThan(2000);
        expect(renderSystem.keyLight.position.z).toBeLessThan(-1150);
        const texelSize = renderSystem.getShadowWorldTexelSize();
        expect(Math.abs(renderSystem.keyLight.target.position.x - 2200)).toBeLessThanOrEqual(texelSize / 2);
        expect(Math.abs(renderSystem.keyLight.target.position.z + 1400)).toBeLessThanOrEqual(texelSize / 2);
        expect(renderSystem.keyLight.shadow.camera.left).toBeLessThanOrEqual(-240);
        expect(renderSystem.keyLight.shadow.camera.right).toBeGreaterThanOrEqual(240);
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
        expect(renderSystem.keyLight.shadow.camera.left).toBeLessThanOrEqual(-260);
        expect(renderSystem.keyLight.shadow.camera.right).toBeGreaterThanOrEqual(240);
        expect(renderSystem.keyLight.shadow.normalBias).toBeGreaterThanOrEqual(0.03);
    });

    test('refreshes shadow frustum after graphics quality changes', () => {
        const renderSystem = new RenderSystem(false);
        renderSystem.updateEnvironmentLighting(new THREE.Vector3(-1900, 0, 900), 0.016);

        renderSystem.setGraphicsQuality('high');

        expect(renderSystem.keyLight.castShadow).toBe(true);
        expect(renderSystem.renderer.shadowMap.type).toBe(THREE.PCFSoftShadowMap);
        expect(renderSystem.keyLight.shadow.mapSize.width).toBeGreaterThanOrEqual(2048);
        expect(renderSystem.keyLight.shadow.camera.left).toBeLessThanOrEqual(-240);
        expect(renderSystem.keyLight.shadow.camera.right).toBeGreaterThanOrEqual(240);
        const texelSize = renderSystem.getShadowWorldTexelSize();
        expect(Math.abs(renderSystem.keyLight.target.position.x + 1900)).toBeLessThanOrEqual(texelSize / 2);
        expect(Math.abs(renderSystem.keyLight.target.position.z - 900)).toBeLessThanOrEqual(texelSize / 2);
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

        renderSystem.setCameraShakeEnabled(true);
        renderSystem.applyCameraPunch({ intensity: 1, duration: 0.25, vertical: 1, horizontal: 1 });

        expect(renderSystem.cameraPunch).toEqual(expect.objectContaining({
            intensity: 0.35,
            duration: 0.14,
            vertical: 0.55,
            horizontal: 0.3
        }));
    });

    test('snaps shadow focus to the shadow texel grid to reduce jitter on thin geometry while moving', () => {
        const renderSystem = new RenderSystem(false);

        const texelSize = renderSystem.getShadowWorldTexelSize();
        const insideSameTexelOffset = texelSize * 0.2;

        renderSystem.updateEnvironmentLighting(new THREE.Vector3(125.11, 0, -43.08), 0.016);
        const firstTargetX = renderSystem.keyLight.target.position.x;
        const firstTargetZ = renderSystem.keyLight.target.position.z;
        const firstLightX = renderSystem.keyLight.position.x;
        const firstLightZ = renderSystem.keyLight.position.z;

        renderSystem.updateEnvironmentLighting(new THREE.Vector3(125.11 + insideSameTexelOffset, 0, -43.08 - insideSameTexelOffset), 0.016);

        expect(renderSystem.keyLight.target.position.x).toBeCloseTo(firstTargetX, 6);
        expect(renderSystem.keyLight.target.position.z).toBeCloseTo(firstTargetZ, 6);
        expect(renderSystem.keyLight.position.x).toBeCloseTo(firstLightX, 6);
        expect(renderSystem.keyLight.position.z).toBeCloseTo(firstLightZ, 6);
    });
});
