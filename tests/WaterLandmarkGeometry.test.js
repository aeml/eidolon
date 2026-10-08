import { createTideRibStone, createTideRibPier, createWreckPlank, wreckHullHalfWidth, createWreckRib,
    createTornWreckSail } from '../src/art/WaterLandmarkGeometry.js';

test.each(['high', 'low'])('%s wreck planks remain finite and inside the old hull solid', quality => {
    expect(wreckHullHalfWidth(6)).toBeLessThan(wreckHullHalfWidth(0));
    for (const side of [-1, 1]) for (let band = 0; band < 3; band++) {
        const geometry = createWreckPlank(side, band, -6, 6, quality), bounds = geometry.boundingBox;
        expect(bounds.min.x).toBeGreaterThan(-2.75); expect(bounds.max.x).toBeLessThan(2.75);
        expect(bounds.min.z).toBeGreaterThanOrEqual(-6.5); expect(bounds.max.z).toBeLessThanOrEqual(6.5);
        expect(bounds.min.y).toBeGreaterThan(0); expect(bounds.max.y).toBeLessThan(3);
        expect([...geometry.attributes.position.array, ...geometry.attributes.normal.array].every(Number.isFinite)).toBe(true);
        expect(geometry.attributes.color.count).toBe(geometry.attributes.position.count);
        expect(new Set([...geometry.attributes.color.array].map(v => v.toFixed(3))).size).toBeGreaterThan(10);
        expect(geometry.index.count / 3).toBeLessThan(110);
        geometry.dispose();
    }
});

test('layered Tide Rib supports stay inside the original solid with bounded closed bevelled courses', () => {
    const a = createTideRibPier(), b = createTideRibPier();
    expect(a.attributes.position.array).toEqual(b.attributes.position.array);
    for (const attribute of Object.values(a.attributes)) expect([...attribute.array].every(Number.isFinite)).toBe(true);
    expect(a.boundingBox.min.x).toBeGreaterThanOrEqual(-1.5); expect(a.boundingBox.max.x).toBeLessThanOrEqual(1.5);
    expect(a.boundingBox.min.z).toBeGreaterThanOrEqual(-1.5); expect(a.boundingBox.max.z).toBeLessThanOrEqual(1.5);
    expect(a.boundingBox.min.y).toBeGreaterThanOrEqual(0); expect(a.boundingBox.max.y).toBeLessThanOrEqual(7.4);
    expect(a.attributes.position.count / 3).toBeLessThan(650);
    expect(new Set(Array.from(a.attributes.position.array).filter((_v, i) => i % 3 === 1).map(v => v.toFixed(2))).size).toBeGreaterThan(20);
    expect(a.attributes.normal.count).toBe(a.attributes.position.count);
    expect(a.attributes.uv.count).toBe(a.attributes.position.count);
    expect(a.userData.tideMarkDepths).toEqual([1.3, 1.29, 1.25, 1.23, 1.21, 1.22, 1.45]);
    a.dispose(); b.dispose();
});

test.each(['high', 'low'])('%s squared ship ribs fit the unchanged hull footprint', quality => {
    for (const along of [-5, -3, -1, 1, 3, 5]) {
        const rib = createWreckRib(along, quality), { min, max } = rib.boundingBox;
        expect(min.x).toBeGreaterThan(-2.75); expect(max.x).toBeLessThan(2.75);
        expect(min.y).toBeGreaterThan(0); expect(max.y).toBeLessThan(3);
        expect(min.z).toBeGreaterThan(-6.5); expect(max.z).toBeLessThan(6.5);
        for (const attribute of Object.values(rib.attributes)) expect([...attribute.array].every(Number.isFinite)).toBe(true);
        expect(rib.attributes.color.count).toBe(rib.attributes.position.count);
        expect(rib.attributes.position.count / 3).toBeLessThan(160);
        rib.dispose();
    }
});

test('torn sail has folded lighting normals, a ragged foot and deterministic repairs', () => {
    const a = createTornWreckSail(), b = createTornWreckSail();
    expect([...a.attributes.position.array]).toEqual([...b.attributes.position.array]);
    expect(a.boundingBox.min.x).toBeGreaterThanOrEqual(-2); expect(a.boundingBox.max.x).toBeLessThanOrEqual(2);
    expect(a.boundingBox.min.y).toBeGreaterThanOrEqual(-2.5); expect(a.boundingBox.max.y).toBeLessThanOrEqual(2.5);
    const foot = Array.from({ length: 13 }, (_, i) => a.attributes.position.getY(i));
    expect(Math.max(...foot) - Math.min(...foot)).toBeGreaterThan(1);
    expect(a.boundingBox.max.z - a.boundingBox.min.z).toBeGreaterThan(.3);
    expect(new Set([...a.attributes.normal.array].map(v => v.toFixed(3))).size).toBeGreaterThan(10);
    expect(a.attributes.color.count).toBe(a.attributes.position.count);
    expect(a.index.count / 3).toBeLessThan(300);
    a.dispose(); b.dispose();
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
