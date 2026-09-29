import { createLeafCanopyGeometry } from '../src/art/ProceduralLeafCanopy.js';

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
