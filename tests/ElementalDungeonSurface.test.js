import { sampleElementalDungeonSurface } from '../src/art/ElementalDungeonSurface.js';
import { createProceduralDungeonInteriorKit } from '../src/art/ProceduralDungeonInteriors.js';

const families = ['molten_core', 'tempest_spire', 'abyssal_well', 'umbral_nexus'];
const palette = { shadow: [7, 19, 27], ground: [16, 43, 55], midtone: [44, 72, 86], accent: [90, 190, 220] };

describe('elemental dungeon masonry', () => {
    test.each(families)('%s is periodic with restrained relief, roughness and floor light', type => {
        for (const wall of [false, true]) for (const [x, y] of [[0, 0], [-.25, 63.9], [12, 18], [33.5, 32], [48, 48]]) {
            const sample = sampleElementalDungeonSurface(x, y, type, wall, palette);
            const repeated = sampleElementalDungeonSurface(x + 128, y - 64, type, wall, palette);
            expect(repeated.color).toEqual(sample.color);
            for (const key of ['emissive', 'relief', 'roughness', 'mark', 'bevel']) {
                expect(Number.isFinite(sample[key])).toBe(true);
                expect(repeated[key]).toBeCloseTo(sample[key], 12);
            }
            expect(sample.relief).toBeGreaterThanOrEqual(.4);
            expect(sample.relief).toBeLessThanOrEqual(.464);
            expect(sample.roughness).toBeGreaterThan(.82);
            expect(sample.roughness).toBeLessThanOrEqual(.97);
            if (!wall) expect(sample.emissive).toBeLessThanOrEqual(.025);
        }
    });

    test('tide paint changes color, not physical relief or polish', () => {
        const altered = { ...palette, accent: [255, 20, 0] };
        const a = sampleElementalDungeonSurface(0, 32, 'abyssal_well', false, palette);
        const b = sampleElementalDungeonSurface(0, 32, 'abyssal_well', false, altered);
        expect(a.mark).toBeGreaterThan(0);
        expect(a.color).not.toEqual(b.color);
        expect(a.relief).toBe(b.relief); expect(a.roughness).toBe(b.roughness);
        // Neighbouring relief is also pigment-independent, so finite
        // differences cannot turn a bright inscription into a normal ridge.
        for (const [x, y] of [[-.25, 32], [.25, 32], [0, 31.75], [0, 32.25]]) {
            expect(sampleElementalDungeonSurface(x, y, 'abyssal_well', false, palette).relief)
                .toBe(sampleElementalDungeonSurface(x, y, 'abyssal_well', false, altered).relief);
        }
    });

    test.each(families)('%s shares all maps, keeps Low at eight64px maps and registers High samples', type => {
        const high = createProceduralDungeonInteriorKit(type), low = createProceduralDungeonInteriorKit(type, { quality: 'low' });
        expect(high.surfaceQuality).toBe('high'); expect(low.surfaceQuality).toBe('low');
        let highBytes = 0, lowBytes = 0;
        for (const surface of ['floor', 'wall']) {
            const material = quality => quality[`${surface}Material`](24, 24);
            const a = material(high), b = material(low);
            expect(material(high)).toBe(a); expect(material(low)).toBe(b);
            const resized = high[`${surface}Material`](48, 48);
            for (const map of ['map', 'emissiveMap', 'normalMap', 'roughnessMap']) {
                expect(a[map].image.width).toBe(256); expect(b[map].image.width).toBe(64);
                expect(resized[map].image).toBe(a[map].image);
                highBytes += a[map].image.data.byteLength; lowBytes += b[map].image.data.byteLength;
                for (const [x, y] of [[0, 0], [10, 10], [32, 32], [63, 63]]) {
                    const pixel = (texture, px, py) => Array.from(texture.image.data.slice(
                        (py * texture.image.width + px) * 4, (py * texture.image.width + px) * 4 + 4));
                    if (map === 'normalMap') {
                        // Different footprints, same canonical-domain slope
                        // strength: High must not quarter the physical relief.
                        for (const [material, step] of [[a, .25], [b, 1]]) {
                            const height = (dx, dy) => sampleElementalDungeonSurface(x + dx, y + dy, type, surface === 'wall', palette).relief;
                            const nx = (height(-step, 0) - height(step, 0)) * 1.5 / step;
                            const ny = (height(0, -step) - height(0, step)) * 1.5 / step;
                            const length = Math.hypot(nx, ny, 1);
                            expect(pixel(material[map], x / step, y / step))
                                .toEqual([...([nx, ny, 1].map(value => Math.round((value / length * .5 + .5) * 255))), 255]);
                        }
                    } else expect(pixel(a[map], x * 4, y * 4)).toEqual(pixel(b[map], x, y));
                }
            }
        }
        expect(high.metrics().surfaceTextures).toBe(8); expect(low.metrics().surfaceTextures).toBe(8);
        expect(highBytes).toBe(2097152); expect(lowBytes).toBe(131072);
    });

    test('unsupported families fail explicitly; Medium uses High and Verdant retains its existing resolution', () => {
        expect(() => sampleElementalDungeonSurface(0, 0, 'unknown', false, palette)).toThrow(TypeError);
        expect(createProceduralDungeonInteriorKit('molten_core', { quality: 'medium' }).floorMaterial(24, 24).map.image.width).toBe(256);
        expect(createProceduralDungeonInteriorKit('verdant_bastion_catacombs', { quality: 'low' }).floorMaterial(24, 24).map.image.width).toBe(256);
    });
});
