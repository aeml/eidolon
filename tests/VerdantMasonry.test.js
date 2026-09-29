import { sampleVerdantMasonry } from '../src/art/VerdantMasonry.js';

test.each([false, true])('Verdant masonry is periodic, bounded and non-emissive (wall=%s)', wall => {
    let totalGreenExcess = 0, samples = 0;
    const colors = new Set(), heights = new Set();
    for (let y = .125; y < 64; y += 1.25) for (let x = .375; x < 64; x += 1.25) {
        const a = sampleVerdantMasonry(x, y, wall);
        expect(sampleVerdantMasonry(x + 64, y - 64, wall)).toEqual(a);
        expect(a.emissive).toBe(0);
        expect(a.color.every(v => Number.isInteger(v) && v >= 0 && v <= 255)).toBe(true);
        expect(a.relief).toBeGreaterThanOrEqual(.35);
        expect(a.relief).toBeLessThan(.53);
        expect(a.roughness).toBeGreaterThan(.82);
        expect(a.roughness).toBeLessThanOrEqual(.98);
        totalGreenExcess += a.color[1] - a.color[0]; samples++;
        colors.add(a.color.join(',')); heights.add(a.relief.toFixed(3));
    }
    expect(totalGreenExcess / samples).toBeLessThan(6);
    expect(colors.size).toBeGreaterThan(30);
    expect(heights.size).toBeGreaterThan(20);
});
