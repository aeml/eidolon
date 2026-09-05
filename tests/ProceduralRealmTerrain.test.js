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

    test('town stones retain their physical pattern on Low, without bright repeating marks', () => {
        const high = createProceduralTerrainTexture('town');
        const low = createProceduralTerrainTexture('town', { quality: 'low' });
        const pixel = (texture, x, y) => Array.from(texture.image.data.slice((y * texture.image.width + x) * 4, (y * texture.image.width + x) * 4 + 3));
        for (let row = 0; row < 16; row++) {
            for (let column = 0; column < 8; column++) {
                const x = (column * 32 + 16 - (row % 2) * 16 + 256) % 256;
                const y = row * 16 + 8;
                expect(pixel(low, x / 2, y / 2)).toEqual(pixel(high, x, y));
            }
        }
        const colors = Array.from(high.image.data).filter((_, index) => index % 4 !== 3);
        expect(colors.reduce((maximum, value) => Math.max(maximum, value), 0)).toBeLessThan(130);
        const stoneWidth = 198.5 / (PROCEDURAL_TERRAIN_DEFINITIONS.town.surface.repeat[0] * 8);
        expect(stoneWidth).toBeGreaterThan(0.8);
        expect(stoneWidth).toBeLessThan(1.1);
        high.dispose();
        low.dispose();
    });

    test.each(['earth', 'water', 'fire', 'air', 'ocean'])('%s surface features stay registered between texture quality levels', (key) => {
        const high = createProceduralTerrainTexture(key);
        const low = createProceduralTerrainTexture(key, { quality: 'low' });
        for (let y = 0; y < 128; y += 7) {
            for (let x = 0; x < 128; x += 7) {
                const highOffset = (y * 2 * 256 + x * 2) * 4;
                const lowOffset = (y * 128 + x) * 4;
                expect(low.image.data.slice(lowOffset, lowOffset + 4)).toEqual(high.image.data.slice(highOffset, highOffset + 4));
            }
        }
        high.dispose();
        low.dispose();
    });

    test('Gloamwood keeps subdued but varied soil without bright repeating chips', () => {
        const texture = createProceduralTerrainTexture('earth');
        const values = [];
        const colors = new Set();
        let darkest = 255;
        let brightest = 0;
        for (let offset = 0; offset < texture.image.data.length; offset += 4) {
            const [red, green, blue] = texture.image.data.slice(offset, offset + 3);
            values.push((red + green + blue) / 3);
            colors.add(`${red},${green},${blue}`);
            darkest = Math.min(darkest, red, green, blue);
            brightest = Math.max(brightest, red, green, blue);
        }
        const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
        const deviation = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
        expect(darkest).toBeGreaterThan(20);
        expect(brightest).toBeLessThan(100);
        expect(deviation).toBeGreaterThan(1.5);
        expect(colors.size).toBeGreaterThan(200);
        texture.dispose();
    });

    test.each(['town', 'earth'])('%s tile edges avoid a hard color discontinuity at texture wrapping', (key) => {
        const texture = createProceduralTerrainTexture(key);
        const { data, width } = texture.image;
        let seamDifference = 0;
        let interiorDifference = 0;
        let interiorSamples = 0;
        for (let index = 0; index < width; index++) {
            for (let channel = 0; channel < 3; channel++) {
                seamDifference += Math.abs(data[(index * width) * 4 + channel] - data[(index * width + width - 1) * 4 + channel]);
                seamDifference += Math.abs(data[index * 4 + channel] - data[((width - 1) * width + index) * 4 + channel]);
                for (let boundary = 32; boundary < width; boundary += 32) {
                    interiorDifference += Math.abs(data[(index * width + boundary) * 4 + channel] - data[(index * width + boundary - 1) * 4 + channel]);
                    interiorSamples++;
                }
                for (let boundary = 16; boundary < width; boundary += 16) {
                    interiorDifference += Math.abs(data[(boundary * width + index) * 4 + channel] - data[((boundary - 1) * width + index) * 4 + channel]);
                    interiorSamples++;
                }
            }
        }
        // Wraps may cross a stone joint. They must not jump more than ordinary
        // internal joint boundaries (allow one byte of color quantization).
        expect(seamDifference / (width * 3 * 2)).toBeLessThanOrEqual(interiorDifference / interiorSamples + 1);
        texture.dispose();
    });
});
