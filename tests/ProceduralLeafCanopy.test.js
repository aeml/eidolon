import { createLeafCanopyGeometry } from '../src/art/ProceduralLeafCanopy.js';

test.each(['high', 'low'])('%s gives every unchanged blade a stable tapered detail coordinate', quality => {
    const first = createLeafCanopyGeometry(quality), second = createLeafCanopyGeometry(quality);
    try {
        expect(first.attributes.uv).toBeDefined();
        expect(first.attributes.uv.count).toBe(first.attributes.position.count);
        expect(first.attributes.uv.array).toEqual(second.attributes.uv.array);
        expect(first.attributes.uv.array.every(value => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true);
        const verticesPerLeaf = quality === 'low' ? 6 : 12;
        for (let start = 0; start < first.attributes.uv.count; start += verticesPerLeaf) {
            const coordinates = Array.from(first.attributes.uv.array.slice(start * 2, (start + verticesPerLeaf) * 2));
            expect(coordinates).toContain(0);
            expect(coordinates).toContain(1);
            expect(new Set(coordinates).size).toBeGreaterThan(3);
        }
    } finally { first.dispose(); second.dispose(); }
});

test('all 256 tapered leaves remain deterministic and bounded in 1024 opaque triangles', () => {
    const first = createLeafCanopyGeometry(), second = createLeafCanopyGeometry();
    expect(first.attributes.position.array).toEqual(second.attributes.position.array);
    expect(first.attributes.color.array).toEqual(second.attributes.color.array);
    expect(first.attributes.position.count / 3).toBe(1024);
    expect(first.attributes.color.count).toBe(first.attributes.position.count);
    expect(first.attributes.normal.array.every(Number.isFinite)).toBe(true);
    for (const component of ['x', 'y', 'z']) {
        expect(first.boundingBox.min[component]).toBeGreaterThan(-1.55);
        expect(first.boundingBox.max[component]).toBeLessThan(1.55);
    }
    expect(Math.max(...first.attributes.color.array) - Math.min(...first.attributes.color.array)).toBeGreaterThan(.3);
    first.dispose(); second.dispose();
});
