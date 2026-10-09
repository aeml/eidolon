import { createHorizonRing, createWindVaneNeedle } from '../src/art/AirLandmarkGeometry.js';

test.each(['high', 'low'])('%s instrument bands are finite, thin and fit an overhead crown', quality => {
    for (const radius of [4.5, 3.9, 3.3]) {
        const geometry = createHorizonRing(radius, quality), bounds = geometry.boundingBox;
        expect([...geometry.attributes.position.array, ...geometry.attributes.normal.array].every(Number.isFinite)).toBe(true);
        expect(bounds.min.z).toBeGreaterThan(-.1); expect(bounds.max.z).toBeLessThan(.1);
        expect(bounds.min.y + 8).toBeGreaterThan(3.4);
        expect(bounds.max.y + 8).toBeLessThan(12.6);
        expect(geometry.attributes.position.count / 3).toBeLessThan(1400);
        geometry.dispose();
    }
});

test('weathercock has a rolled thin edge, balanced tail and pointer within the existing overhead envelope', () => {
    const geometry = createWindVaneNeedle(), bounds = geometry.boundingBox;
    try {
        for (const attribute of ['position', 'normal', 'uv'])
            expect([...geometry.attributes[attribute].array].every(Number.isFinite)).toBe(true);
        expect(bounds.min.x).toBeGreaterThan(-2.75);
        expect(bounds.max.x).toBeLessThan(2.75);
        expect(bounds.max.x).toBeGreaterThan(2.6);
        expect(bounds.min.x).toBeLessThan(-2.1);
        expect(bounds.min.y + 7).toBeGreaterThan(6.4);
        expect(bounds.max.y + 7).toBeLessThan(7.6);
        expect(bounds.max.z - bounds.min.z).toBeLessThan(.15);
        expect(geometry.attributes.position.count / 3).toBeLessThan(250);
        for (let i = 0; i < geometry.attributes.normal.count; i++)
            expect(Math.hypot(...geometry.attributes.normal.array.slice(i * 3, i * 3 + 3))).toBeCloseTo(1, 5);
    } finally { geometry.dispose(); }
});
