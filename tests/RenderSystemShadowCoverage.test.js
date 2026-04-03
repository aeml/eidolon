import * as THREE from 'three';
import { RenderSystem } from '../src/core/RenderSystem.js';

describe('RenderSystem shadow coverage', () => {
    test('tracks the directional shadow camera around the player instead of a tiny origin-bound frustum', () => {
        const renderSystem = new RenderSystem(false);

        renderSystem.updateEnvironmentLighting(new THREE.Vector3(2200, 0, -1400), 0.016);

        expect(renderSystem.keyLight.position.x).toBeGreaterThan(2000);
        expect(renderSystem.keyLight.position.z).toBeLessThan(-1150);
        expect(renderSystem.keyLight.target.position.x).toBeCloseTo(2200, 5);
        expect(renderSystem.keyLight.target.position.z).toBeCloseTo(-1400, 5);
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
        expect(renderSystem.keyLight.target.position.x).toBeCloseTo(-1900, 5);
        expect(renderSystem.keyLight.target.position.z).toBeCloseTo(900, 5);
    });
});
