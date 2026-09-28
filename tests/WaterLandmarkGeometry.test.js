import { createTideRibStone, createWreckPlank, wreckHullHalfWidth } from '../src/art/WaterLandmarkGeometry.js';

test.each(['high', 'low'])('%s wreck planks remain finite and inside the old hull solid', quality => {
    expect(wreckHullHalfWidth(6)).toBeLessThan(wreckHullHalfWidth(0));
    for (const side of [-1, 1]) for (let band = 0; band < 3; band++) {
        const geometry = createWreckPlank(side, band, -6, 6, quality), bounds = geometry.boundingBox;
        expect(bounds.min.x).toBeGreaterThan(-2.75); expect(bounds.max.x).toBeLessThan(2.75);
        expect(bounds.min.z).toBeGreaterThanOrEqual(-6.5); expect(bounds.max.z).toBeLessThanOrEqual(6.5);
        expect(bounds.min.y).toBeGreaterThan(0); expect(bounds.max.y).toBeLessThan(3);
        expect([...geometry.attributes.position.array, ...geometry.attributes.normal.array].every(Number.isFinite)).toBe(true);
        expect(geometry.index.count / 3).toBeLessThan(110);
        geometry.dispose();
    }
});

test('carved tide ribs are finite, stay overhead and fit the gameplay crown budget', () => {
    let triangles = 0;
    for (let i = 0; i < 15; i++) {
        const geometry = createTideRibStone(i), bounds = geometry.boundingBox;
        expect(bounds.min.y).toBeGreaterThan(6.9);
        expect(bounds.max.y).toBeLessThan(13);
        expect(bounds.min.x).toBeGreaterThan(-10.8); expect(bounds.max.x).toBeLessThan(10.8);
        expect(bounds.min.z).toBeGreaterThan(-.6); expect(bounds.max.z).toBeLessThan(.6);
        expect([...geometry.attributes.position.array, ...geometry.attributes.normal.array].every(Number.isFinite)).toBe(true);
        triangles += geometry.attributes.position.count / 3;
        geometry.dispose();
    }
    expect(triangles).toBeLessThan(2500);
});
