import * as THREE from 'three';
import { createLanternholdPavingMaps, sampleLanternholdPaving } from '../src/art/LanternholdPaving.js';

test('court is bounded, non-emissive stonework with unchanged scale across quality', () => {
    const high = createLanternholdPavingMaps(), low = createLanternholdPavingMaps('low');
    expect(high.color.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(high.surface.colorSpace).toBe(THREE.NoColorSpace);
    for (const key of ['color', 'surface']) {
        expect(high[key].image.data.byteLength).toBe(512 * 512 * 4);
        expect(low[key].image.data.byteLength).toBe(256 * 256 * 4);
        for (let y = 0; y < 256; y += 7) for (let x = 0; x < 256; x += 7) {
            const a = (y * 256 + x) * 4, b = (y * 2 * 512 + x * 2) * 4;
            expect(low[key].image.data.slice(a, a + 4)).toEqual(high[key].image.data.slice(b, b + 4));
        }
        // Clamped outer texels must never paint a stripe outside the court.
        if (key === 'color') for (let i = 0; i < 512; i++) {
            for (const at of [i, 511 * 512 + i, i * 512, i * 512 + 511])
                expect(high.color.image.data[at * 4 + 3]).toBe(0);
        }
    }
    for (let i = 0; i < high.surface.image.data.length; i += 4) {
        const d = high.surface.image.data;
        const length = Math.hypot(d[i] / 255 * 2 - 1, d[i+1] / 255 * 2 - 1, d[i+2] / 255 * 2 - 1);
        if (Math.abs(length - 1) > Math.sqrt(3) / 255) throw new Error('non-unit normal');
        if (d[i+3] < 195 || d[i+3] > 245) throw new Error('invalid roughness');
    }
    for (const maps of [high, low]) Object.values(maps).forEach(texture => texture.dispose());
    expect(sampleLanternholdPaving(16, 0).coverage).toBe(0);
    expect(sampleLanternholdPaving(3, 4).coverage).toBe(1);
    // The relaid court is a square, not a circular disk or outer target ring.
    // Its quiet rectangular edges blend into the connected court mask.
    expect(sampleLanternholdPaving(12, 12).coverage).toBe(1);
});

test('flagstone joints retain human-scale courses and finite relief across the court', () => {
    let joints = 0, wasJoint = false;
    for (let x = -12; x < 12; x += .025) {
        const sample = sampleLanternholdPaving(x, 6.6);
        const joint = sample.height < .01;
        if (joint && !wasJoint) joints++;
        wasJoint = joint;
        expect(sample.height).toBeGreaterThanOrEqual(0);
        expect(sample.height).toBeLessThan(.045);
        expect(sample.color.every(v => Number.isFinite(v) && v >= 0 && v <= 255)).toBe(true);
    }
    // Around 1–2m per slab, not several-metre wedge-shaped courses.
    expect(joints).toBeGreaterThanOrEqual(12);
    expect(joints).toBeLessThanOrEqual(22);
});
