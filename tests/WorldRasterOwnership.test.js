import { jest } from '@jest/globals';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createQualityRasterCache } from '../src/art/QualityRasterCache.js';
import { createEarthSurfaceDetail } from '../src/art/EarthSurfaceDetail.js';
import { createTownCompositionMask, sampleLanternholdGround } from '../src/art/TownGroundComposition.js';
import { createEarthCompositionMask, createForestFloorDetail } from '../src/art/EarthGroundComposition.js';
import { createLanternholdPavingMaps } from '../src/art/LanternholdPaving.js';
import { WORLD_REGIONS } from '../src/data/worldGeography.js';

const factories = { createEarthSurfaceDetail, createTownCompositionMask, createEarthCompositionMask, createForestFloorDetail };
const reference = JSON.parse(readFileSync(new URL('./fixtures/world-raster-reference.json', import.meta.url)));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

for (const row of reference.filter(row => !row.channel)) test(`${row.name} ${row.quality}: exact pre-cache bytes survive other owners mutating and retiring`, () => {
    const first = factories[row.name](row.quality), second = factories[row.name](row.quality);
    expect(first).not.toBe(second); expect(first.source).not.toBe(second.source);
    expect(first.image.data.buffer).not.toBe(second.image.data.buffer);
    expect(first.image.data.byteLength).toBe(row.bytes); expect(hash(first.image.data)).toBe(row.sha256);
    let retired = 0; second.addEventListener('dispose', () => retired++);
    first.image.data.fill(0); first.dispose();
    expect(retired).toBe(0); expect(hash(second.image.data)).toBe(row.sha256);
    const returning = factories[row.name](row.quality);
    expect(hash(returning.image.data)).toBe(row.sha256);
    expect(returning.image.data.buffer).not.toBe(second.image.data.buffer);
    second.dispose(); returning.dispose(); expect(retired).toBe(1);
});

for (const quality of ['high', 'low']) test(`${quality}: bounded town stamps retain the analytic field at every pixel`, () => {
    const texture = createTownCompositionMask(quality), { width: size, data } = texture.image, region = WORLD_REGIONS.town;
    const expected = new Uint8Array(data.length);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const sample = sampleLanternholdGround(region.minX + x / size * (region.maxX - region.minX),
            region.minZ + y / size * (region.maxZ - region.minZ));
        [sample.paving, sample.traffic, sample.damp, sample.hearth].forEach((value, channel) => {
            expected[(y * size + x) * 4 + channel] = Math.round(value * 255);
        });
    }
    expect(Buffer.compare(data, expected)).toBe(0); texture.dispose();
});

test('quality aliases cannot grow CPU storage and every upload buffer is independent', () => {
    const rasterize = jest.fn(size => new Uint8Array(size * size * 4).fill(123));
    const cache = createQualityRasterCache(8, 4, rasterize);
    const a = cache('high'); a.data.fill(0);
    for (const quality of ['low', 'high', undefined, '', 'medium', 'ultra', 'low']) {
        const field = cache(quality);
        expect(field.size).toBe(quality === 'low' ? 4 : 8);
        expect(field.data.every(value => value === 123)).toBe(true);
        field.data.fill(0);
    }
    expect(rasterize.mock.calls).toEqual([[8], [4]]);
});

for (const quality of ['high', 'low']) test(`${quality}: court albedo and physical channels retain exact bytes and independent owners`, () => {
    const first = createLanternholdPavingMaps(quality), second = createLanternholdPavingMaps(quality);
    for (const row of reference.filter(row => row.quality === quality && row.channel)) {
        expect(hash(first[row.channel].image.data)).toBe(row.sha256);
        expect(first[row.channel].image.data.byteLength).toBe(row.bytes);
        first[row.channel].image.data.fill(0); first[row.channel].dispose();
        expect(hash(second[row.channel].image.data)).toBe(row.sha256);
    }
    const returning = createLanternholdPavingMaps(quality);
    for (const row of reference.filter(row => row.quality === quality && row.channel)) {
        expect(hash(returning[row.channel].image.data)).toBe(row.sha256);
        expect(returning[row.channel].image.data.buffer).not.toBe(second[row.channel].image.data.buffer);
        returning[row.channel].dispose(); second[row.channel].dispose();
    }
});
