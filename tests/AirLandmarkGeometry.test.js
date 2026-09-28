import { createHorizonRing } from '../src/art/AirLandmarkGeometry.js';

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
