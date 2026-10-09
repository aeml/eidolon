import { createKilnArchBeam, createKilnPier } from '../src/art/FireLandmarkGeometry.js';

test.each([false, true])('kiln web/flange %s is finite, overhead and below the camera crown budget', flange => {
    const geometry = createKilnArchBeam(flange), bounds = geometry.boundingBox;
    expect(bounds.min.y).toBeGreaterThan(6.9); expect(bounds.max.y).toBeLessThan(13);
    expect(bounds.min.x).toBeGreaterThan(-10.7); expect(bounds.max.x).toBeLessThan(10.7);
    expect(bounds.min.z).toBeGreaterThan(-.6); expect(bounds.max.z).toBeLessThan(.6);
    expect([...geometry.attributes.position.array, ...geometry.attributes.normal.array].every(Number.isFinite)).toBe(true);
    expect(geometry.attributes.position.count / 3).toBeLessThan(1500);
    geometry.dispose();
});

test.each(['high', 'low'])('%s kiln piers have staggered real joints and remain inside existing solids', quality => {
    for (const [height, width] of [[8, 3], [7, 1.2], [6, 1.2], [5, 1.2]]) {
        const geometry = createKilnPier(height, width, 3, quality), copy = createKilnPier(height, width, 3, quality);
        try {
            for (const key of ['position', 'normal', 'uv', 'color']) {
                expect(geometry.attributes[key].array).toEqual(copy.attributes[key].array);
                expect([...geometry.attributes[key].array].every(Number.isFinite)).toBe(true);
            }
            const bounds = geometry.boundingBox;
            expect(bounds.min.y).toBeGreaterThan(0); expect(bounds.max.y).toBeLessThan(height);
            for (const axis of ['x', 'z']) {
                expect(bounds.min[axis]).toBeGreaterThan(-width / 2);
                expect(bounds.max[axis]).toBeLessThan(width / 2);
            }
            expect(geometry.attributes.position.count / 3).toBeLessThan(1600);
            const distinctLevels = new Set(Array.from(geometry.attributes.position.array)
                .filter((_, index) => index % 3 === 1).map(value => value.toFixed(3)));
            expect(distinctLevels.size).toBeGreaterThan(12);
            expect(geometry.attributes.color.count).toBe(geometry.attributes.position.count);
        } finally { geometry.dispose(); copy.dispose(); }
    }
});
