import * as THREE from 'three';
import { jest } from '@jest/globals';
import { createProceduralReflectionEnvironment } from '../src/art/ProceduralReflectionEnvironment.js';
import { RenderSystem } from '../src/core/RenderSystem.js';

describe('soft material reflections', () => {
    test('builds small deterministic linear radiance with a brighter sky and bounded highlights', () => {
        const first = createProceduralReflectionEnvironment();
        const second = createProceduralReflectionEnvironment();
        const { data, width, height } = first.image;
        expect([width, height]).toEqual([128, 64]);
        expect(data.byteLength).toBe(128 * 1024);
        expect(first.mapping).toBe(THREE.EquirectangularReflectionMapping);
        expect(first.colorSpace).toBe(THREE.LinearSRGBColorSpace);
        expect(data).toEqual(second.image.data);
        expect(data.every((value) => Number.isFinite(value) && value >= 0 && value <= 2.5)).toBe(true);
        const averageRow = (y) => {
            let sum = 0;
            for (let x = 0; x < width; x++) sum += data[(y * width + x) * 4];
            return sum / width;
        };
        expect(averageRow(height - 1)).toBeGreaterThan(averageRow(0) * 3);
        first.dispose();
        second.dispose();
    });

    test('keeps the same reflection map on Low and releases renderer-owned resources', () => {
        const system = new RenderSystem(false);
        const texture = system.reflectionEnvironment;
        const dispose = jest.spyOn(texture, 'dispose');
        expect(system.scene.environment).toBe(texture);
        expect(system.scene.environmentIntensity).toBe(0.65);
        system.setGraphicsQuality('low');
        expect(system.scene.environment).toBe(texture);
        system.setGraphicsQuality('high');
        expect(system.scene.environment).toBe(texture);
        system.currentLighting.ambientIntensity = 1.22;
        system.applyLightingState();
        expect(system.scene.environmentIntensity).toBeLessThan(0.45);
        expect(system.scene.environment).toBe(texture);
        system.dispose();
        expect(dispose).toHaveBeenCalledTimes(1);
        expect(system.scene.environment).toBeNull();
        expect(system.reflectionEnvironment).toBeNull();
    });
});
