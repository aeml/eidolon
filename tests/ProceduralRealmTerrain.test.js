import * as THREE from 'three';
import {
    PROCEDURAL_TERRAIN_DEFINITIONS,
    createProceduralTerrainMaterial,
    createProceduralTerrainTexture,
    getProceduralTerrainMetrics
} from '../src/art/ProceduralRealmTerrain.js';
import { getRegionTheme } from '../src/art/darkFantasyTheme.js';

const TERRAIN_KEYS = Object.freeze(['earth', 'town', 'water', 'fire', 'air', 'ocean', 'sky']);

describe('procedural dark-fantasy realm terrain', () => {
    test('declares an intentional and unique identity for every production surface', () => {
        expect(Object.keys(PROCEDURAL_TERRAIN_DEFINITIONS)).toEqual(TERRAIN_KEYS);
        expect(new Set(Object.values(PROCEDURAL_TERRAIN_DEFINITIONS).map((entry) => entry.id)).size)
            .toBe(TERRAIN_KEYS.length);

        for (const [key, definition] of Object.entries(PROCEDURAL_TERRAIN_DEFINITIONS)) {
            expect(definition.id).toMatch(/^[a-z0-9-]+$/);
            expect(definition.label.length).toBeGreaterThan(8);
            expect(definition.motif.length).toBeGreaterThan(24);
            expect(definition.surface.repeat).toHaveLength(2);
            expect(definition.surface.repeat.every((value) => Number.isFinite(value) && value > 0)).toBe(true);
            if (!['ocean', 'sky'].includes(key)) {
                expect(definition.region).toBe(key);
                expect(getRegionTheme(key).palette).toBeTruthy();
            }
        }
    });

    test.each(['high', 'low'])('builds deterministic code-generated %s textures for every surface', (quality) => {
        const signatures = new Set();

        for (const key of TERRAIN_KEYS) {
            const expectedResolution = key === 'sky'
                ? (quality === 'low' ? 256 : 512)
                : (quality === 'low' ? 128 : 256);
            const first = createProceduralTerrainTexture(key, { quality });
            const second = createProceduralTerrainTexture(key, { quality });
            const metrics = getProceduralTerrainMetrics(first);
            const repeatedMetrics = getProceduralTerrainMetrics(second);

            expect(first).toBeInstanceOf(THREE.DataTexture);
            expect(first.image.data).toBeInstanceOf(Uint8Array);
            expect(first.image.data).toHaveLength(expectedResolution * expectedResolution * 4);
            expect(metrics).toEqual(expect.objectContaining({
                key,
                id: PROCEDURAL_TERRAIN_DEFINITIONS[key].id,
                region: PROCEDURAL_TERRAIN_DEFINITIONS[key].region,
                motif: PROCEDURAL_TERRAIN_DEFINITIONS[key].motif,
                quality,
                resolution: expectedResolution,
                codeGenerated: true
            }));
            expect(metrics.signature).toMatch(/^[0-9a-f]{8}$/);
            expect(repeatedMetrics.signature).toBe(metrics.signature);
            expect(Array.from(first.image.data).every(Number.isFinite)).toBe(true);
            signatures.add(metrics.signature);
            first.dispose();
            second.dispose();
        }

        expect(signatures.size).toBe(TERRAIN_KEYS.length);
    });

    test('materials preserve the declared surface contract without changing gameplay geometry', () => {
        for (const key of TERRAIN_KEYS.filter((entry) => entry !== 'sky')) {
            const definition = PROCEDURAL_TERRAIN_DEFINITIONS[key];
            const material = createProceduralTerrainMaterial(key);

            expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
            expect(material.map).toBeInstanceOf(THREE.DataTexture);
            expect(material.map.repeat.toArray()).toEqual(definition.surface.repeat);
            expect(material.roughness).toBe(definition.surface.roughness);
            expect(material.metalness).toBe(definition.surface.metalness);
            expect(material.userData).toEqual(expect.objectContaining({
                proceduralTerrain: true,
                terrainKey: key,
                terrainId: definition.id,
                motif: definition.motif
            }));
            material.map.dispose();
            material.dispose();
        }
    });

    test('fails closed for unknown terrain identities', () => {
        expect(createProceduralTerrainTexture('unknown')).toBeNull();
        expect(createProceduralTerrainMaterial('unknown')).toBeNull();
        expect(getProceduralTerrainMetrics(new THREE.Texture())).toBeNull();
    });
});
