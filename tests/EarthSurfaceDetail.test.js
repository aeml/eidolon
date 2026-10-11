import { sampleEarthSurface as reference } from './fixtures/earth-surface-before-thatch.js';
import * as THREE from 'three';
import { createEarthSurfaceDetail, EARTH_SURFACE_TILE_METRES, sampleEarthSurface, sampleEarthThatch } from '../src/art/EarthSurfaceDetail.js';

test('physical channels are finite, bounded and continuous across repeated tile seams', () => {
    expect(EARTH_SURFACE_TILE_METRES).toBe(8);
    for (let i = 0; i < 96; i++) {
        const x = i / 8, z = (i % 23) / 8, sample = sampleEarthSurface(x, z);
        expect(sampleEarthSurface(x + 8, z - 16)).toEqual(sample);
        expect(sample.every(value => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true);
        if (sample[1] === 0) expect(sample[3]).toBe(0); // No unattached stone relief.
        for (const [a, b] of [[sampleEarthSurface(-.000001, z), sampleEarthSurface(.000001, z)],
            [sampleEarthSurface(x, 8 - .000001), sampleEarthSurface(x, .000001)]]) {
            expect(Math.max(...a.map((value, channel) => Math.abs(value - b[channel])))).toBeLessThan(.001);
        }
    }
});

test('High and Low retain identical canonical shapes in linear owned mipmapped fields', () => {
    const high = createEarthSurfaceDetail(), low = createEarthSurfaceDetail('low'), duplicate = createEarthSurfaceDetail('low');
    try {
        const canonical = new Uint8Array(low.image.data.length);
        for (let z = 0; z < 128; z++) for (let x = 0; x < 128; x++) for (let channel = 0; channel < 4; channel++)
            canonical[(z * 128 + x) * 4 + channel] = high.image.data[(z * 2 * 256 + x * 2) * 4 + channel];
        expect(low.image.data).toEqual(canonical); expect(low.image.data).toEqual(duplicate.image.data);
        for (const texture of [high, low]) {
            expect(texture.colorSpace).toBe(THREE.NoColorSpace); expect(texture.wrapS).toBe(THREE.RepeatWrapping);
            expect(texture.wrapT).toBe(THREE.RepeatWrapping); expect(texture.generateMipmaps).toBe(true);
            expect(texture.minFilter).toBe(THREE.LinearMipmapLinearFilter);
            expect(texture.userData.tileMetres).toBe(EARTH_SURFACE_TILE_METRES);
        }
    } finally { high.dispose(); low.dispose(); duplicate.dispose(); }
});

test('stones form sparse separate islands with varied relief rather than a paving network', () => {
    const texture = createEarthSurfaceDetail(), { data, width } = texture.image;
    const active = new Set(), heights = [new Set(), new Set(), new Set()];
    for (let i = 0; i < width * width; i++) {
        if (data[i * 4 + 1] > 128) active.add(i);
        [0, 2, 3].forEach((channel, field) => heights[field].add(data[i * 4 + channel]));
    }
    expect(active.size / (width * width)).toBeGreaterThan(.015);
    expect(active.size / (width * width)).toBeLessThan(.16);
    let islands = 0, largest = 0;
    while (active.size) {
        islands++; const queue = [active.values().next().value]; active.delete(queue[0]);
        for (let at = 0; at < queue.length; at++) {
            const index = queue[at], x = index % width, z = Math.floor(index / width);
            for (const neighbor of [z * width + (x + 1) % width, z * width + (x + width - 1) % width,
                (z + 1) % width * width + x, (z + width - 1) % width * width + x]) {
                if (active.delete(neighbor)) queue.push(neighbor);
            }
        }
        largest = Math.max(largest, queue.length);
    }
    expect(islands).toBeGreaterThan(20); expect(largest / (width * width)).toBeLessThan(.012);
    heights.forEach(values => expect(values.size).toBeGreaterThan(80));
    texture.dispose();
});

test('thatch ridges cross cell and tile boundaries continuously', () => {
    for (let index = 0; index <= 96; index++) {
        const boundary = index * 4 / 9, other = (index % 23) / 8;
        for (const [a, b] of [
            [[boundary - 1e-6, other], [boundary + 1e-6, other]],
            [[other, boundary - 1e-6], [other, boundary + 1e-6]]
        ]) expect(Math.abs(sampleEarthThatch(...a) - sampleEarthThatch(...b))).toBeLessThan(.001);
    }
});

test('matted thatch only changes the registered vegetation relief channel', () => {
    let changed = 0, minimum = 1, maximum = 0;
    for (let z = 0; z < 64; z++) for (let x = 0; x < 64; x++) {
        const point = [x / 8, z / 8], before = reference(...point), after = sampleEarthSurface(...point);
        for (const channel of [0, 1, 3]) expect(after[channel]).toBe(before[channel]);
        changed += before[2] !== after[2] ? 1 : 0;
        const thatch = sampleEarthThatch(...point);
        minimum = Math.min(minimum, thatch); maximum = Math.max(maximum, thatch);
        expect(thatch).toBeGreaterThanOrEqual(0); expect(thatch).toBeLessThanOrEqual(1);
        expect(sampleEarthThatch(point[0] - 8, point[1] + 16)).toBe(thatch);
    }
    expect(changed).toBeGreaterThan(1000);
    expect(minimum).toBe(0); expect(maximum).toBeGreaterThan(.7);
});
