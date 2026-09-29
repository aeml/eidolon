import { createBastionPavingFragment, createBastionMarkerCap } from '../src/art/BastionForecourtGeometry.js';

test('buried paving has finite upward-facing surfaces and bounded, varied broken edges', () => {
    const sizes = new Set();
    for (let seed = 0; seed < 32; seed++) {
        const geometry = createBastionPavingFragment(seed);
        geometry.computeBoundingBox();
        const { position, normal, color, uv } = geometry.attributes;
        expect(position.count).toBe(24);
        expect(normal.count).toBe(position.count);
        expect(color.count).toBe(position.count);
        expect(uv.count).toBe(position.count);
        expect([...position.array, ...normal.array, ...color.array].every(Number.isFinite)).toBe(true);
        for (let i = 0; i < position.count; i++) {
            expect(position.getY(i)).toBe(0);
            expect(Math.abs(position.getX(i))).toBeLessThan(1);
            expect(Math.abs(position.getZ(i))).toBeLessThan(.84);
            expect(normal.getY(i)).toBeCloseTo(1);
        }
        sizes.add(geometry.boundingBox.max.x.toFixed(3));
        expect(new Set(color.array).size).toBeGreaterThan(12);
        geometry.dispose();
    }
    expect(sizes.size).toBeGreaterThan(24);
});

test('marker caps are low carved slabs with no detached or extreme geometry', () => {
    for (const seed of [-7, -6, -5, 7, 8, 9]) {
        const geometry = createBastionMarkerCap(seed);
        geometry.computeBoundingBox();
        expect([...geometry.attributes.position.array].every(Number.isFinite)).toBe(true);
        expect(geometry.boundingBox.min.y).toBeCloseTo(-.09);
        expect(geometry.boundingBox.max.y).toBeCloseTo(.39);
        expect(geometry.boundingBox.min.x).toBeGreaterThan(-1);
        expect(geometry.boundingBox.max.x).toBeLessThan(1);
        expect(geometry.boundingBox.min.z).toBeGreaterThan(-1);
        expect(geometry.boundingBox.max.z).toBeLessThan(1);
        expect(geometry.attributes.color.count).toBe(geometry.attributes.position.count);
        geometry.dispose();
    }
});
