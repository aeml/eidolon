import { sampleTownStreetStone } from '../src/art/TownStreetStone.js';

test('street courses close over the canonical tile with finite chipped slabs and short cleaves', () => {
    const widths = new Set(), heights = new Set();
    let fractures = 0;
    for (let y = 0; y < 256; y += 3) for (let x = 0; x < 256; x += 3) {
        const point = sampleTownStreetStone(x, y);
        expect(sampleTownStreetStone(x + 256, y - 256)).toEqual(point);
        expect(Object.values(point).every(Number.isFinite)).toBe(true);
        expect(point.fracture).toBeGreaterThanOrEqual(0);
        expect(point.fracture).toBeLessThanOrEqual(1);
        expect(point.row).toBeLessThan(8); expect(point.column).toBeLessThan(6);
        widths.add(point.width); heights.add(point.height);
        if (point.fracture > 0) fractures++;
    }
    expect(widths.size).toBeGreaterThan(3); expect(heights.size).toBeGreaterThan(4);
    expect(fractures).toBeGreaterThan(0);
});

test('High and Low street footprints share exactly the same canonical inputs', () => {
    for (let y = 0; y < 128; y += 5) for (let x = 0; x < 128; x += 5)
        expect(sampleTownStreetStone(x, y, 128)).toEqual(sampleTownStreetStone(x * 2, y * 2));
});

test('street slabs are human-sized flagstones at the existing town material repeat', () => {
    const metresPerTexel = 198.5 / 28 / 256;
    for (let y = 0; y < 256; y += 7) for (let x = 0; x < 256; x += 7) {
        const point = sampleTownStreetStone(x, y);
        expect(point.width * metresPerTexel).toBeGreaterThan(.95);
        expect(point.width * metresPerTexel).toBeLessThan(1.5);
        expect(point.height * metresPerTexel).toBeGreaterThan(.7);
        expect(point.height * metresPerTexel).toBeLessThan(1.1);
    }
});
