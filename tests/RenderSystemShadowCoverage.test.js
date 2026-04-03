import * as THREE from 'three';
import { RenderSystem } from '../src/core/RenderSystem.js';

describe('RenderSystem shadow coverage', () => {
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
        expect(renderSystem.keyLight.shadow.mapSize.width).toBeGreaterThanOrEqual(2048);
        expect(renderSystem.keyLight.shadow.radius).toBeGreaterThanOrEqual(3);
        expect(renderSystem.keyLight.shadow.bias).toBeLessThanOrEqual(-0.0001);
        expect(renderSystem.keyLight.shadow.normalBias).toBeGreaterThanOrEqual(0.04);
        expect(renderSystem.keyLight.shadow.camera.left).toBeLessThanOrEqual(-260);
        expect(renderSystem.keyLight.shadow.camera.right).toBeGreaterThanOrEqual(240);
        expect(renderSystem.keyLight.shadow.normalBias).toBeGreaterThanOrEqual(0.03);
    });

    test('refreshes shadow frustum after graphics quality changes', () => {
        const renderSystem = new RenderSystem(false);
        renderSystem.updateEnvironmentLighting(new THREE.Vector3(-1900, 0, 900), 0.016);

        renderSystem.setGraphicsQuality('medium');

        expect(renderSystem.keyLight.castShadow).toBe(true);
        expect(renderSystem.keyLight.shadow.camera.left).toBeLessThanOrEqual(-240);
        expect(renderSystem.keyLight.shadow.camera.right).toBeGreaterThanOrEqual(240);
        const texelSize = renderSystem.getShadowWorldTexelSize();
        expect(Math.abs(renderSystem.keyLight.target.position.x + 1900)).toBeLessThanOrEqual(texelSize / 2);
        expect(Math.abs(renderSystem.keyLight.target.position.z - 900)).toBeLessThanOrEqual(texelSize / 2);
    });

    test('snaps shadow focus to the shadow texel grid to reduce jitter on thin geometry while moving', () => {
        const renderSystem = new RenderSystem(false);

        renderSystem.updateEnvironmentLighting(new THREE.Vector3(125.11, 0, -43.08), 0.016);
        const firstTargetX = renderSystem.keyLight.target.position.x;
        const firstTargetZ = renderSystem.keyLight.target.position.z;
        const firstLightX = renderSystem.keyLight.position.x;
        const firstLightZ = renderSystem.keyLight.position.z;

        renderSystem.updateEnvironmentLighting(new THREE.Vector3(125.19, 0, -43.12), 0.016);

        expect(renderSystem.keyLight.target.position.x).toBeCloseTo(firstTargetX, 6);
        expect(renderSystem.keyLight.target.position.z).toBeCloseTo(firstTargetZ, 6);
        expect(renderSystem.keyLight.position.x).toBeCloseTo(firstLightX, 6);
        expect(renderSystem.keyLight.position.z).toBeCloseTo(firstLightZ, 6);
    });
});
