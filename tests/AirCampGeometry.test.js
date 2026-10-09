import { createAirBedroll } from '../src/art/AirCampGeometry.js';

test.each(['high', 'low'])('%s abandoned bedroll is folded, finite and grounded in its original footprint', quality => {
    const geometry = createAirBedroll(quality), bounds = geometry.boundingBox;
    try {
        for (const attribute of ['position', 'normal', 'uv', 'color'])
            expect([...geometry.attributes[attribute].array].every(Number.isFinite)).toBe(true);
        expect(Math.min(...geometry.attributes.color.array)).toBeGreaterThan(.2);
        expect(Math.max(...geometry.attributes.color.array)).toBeLessThan(.6);
        expect(bounds.min.x).toBeGreaterThanOrEqual(-1.3);
        expect(bounds.max.x).toBeLessThanOrEqual(1.3);
        expect(bounds.min.z).toBeGreaterThanOrEqual(-2);
        expect(bounds.max.z).toBeLessThanOrEqual(2);
        expect(bounds.min.y).toBeGreaterThanOrEqual(0);
        expect(bounds.min.y).toBeLessThan(.051);
        expect(bounds.max.y).toBeGreaterThan(.3);
        expect(bounds.max.y).toBeLessThan(.4);
        expect(geometry.attributes.position.count / 3).toBeLessThan(quality === 'low' ? 200 : 500);
        for (let i = 0; i < geometry.attributes.normal.count; i++)
            expect(Math.hypot(...geometry.attributes.normal.array.slice(i * 3, i * 3 + 3))).toBeCloseTo(1, 5);
    } finally { geometry.dispose(); }
});
