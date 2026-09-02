import * as THREE from 'three';
import { EnvironmentalHazard } from '../src/entities/EnvironmentalHazard.js';
import { ACTIVE_WORLD_HAZARD_TYPES, getHazardTheme } from '../src/art/darkFantasyTheme.js';

describe('dark-fantasy environmental hazard visuals', () => {
    test.each(ACTIVE_WORLD_HAZARD_TYPES)('%s renders an exact authoritative boundary', (hazardType) => {
        const radius = 7.25;
        const hazard = new EnvironmentalHazard(
            `test-${hazardType}`,
            hazardType,
            { x: 12, y: 3, z: -9 },
            { radius }
        );

        expect(hazard.radius).toBe(radius);
        expect(hazard.visualRadius).toBe(radius);
        expect(hazard.boundaryMesh).toBeInstanceOf(THREE.Mesh);
        expect(hazard.boundaryMesh.geometry.boundingSphere.radius).toBeCloseTo(radius, 5);
        expect(hazard.boundaryMesh.userData).toEqual(expect.objectContaining({
            hazardBoundary: true,
            gameplayRadius: radius,
            themeName: getHazardTheme(hazardType).name
        }));
        expect(hazard.boundaryMesh.position.x).toBe(12);
        expect(hazard.boundaryMesh.position.y).toBeCloseTo(3.16, 5);
        expect(hazard.boundaryMesh.position.z).toBe(-9);

        const before = hazard.boundaryMesh.material.uniforms.uTime.value;
        hazard.update(0.25);
        expect(hazard.boundaryMesh.material.uniforms.uTime.value).toBeGreaterThan(before);

        hazard.dispose();
        expect(hazard.meshes).toHaveLength(0);
    });

    test('unknown hazards retain a precise, readable fallback instead of disappearing', () => {
        const hazard = new EnvironmentalHazard('unknown-hazard', 'unknown', { x: 0, z: 0 }, { radius: 4 });

        expect(hazard.theme).toBe(getHazardTheme('generic'));
        expect(hazard.boundaryMesh.geometry.boundingSphere.radius).toBeCloseTo(4, 5);
        expect(hazard.meshes.length).toBeGreaterThanOrEqual(2);

        hazard.dispose();
    });
});
