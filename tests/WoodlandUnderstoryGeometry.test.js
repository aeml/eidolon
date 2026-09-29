import { createWoodlandUnderstoryGeometry } from '../src/art/WoodlandUnderstoryGeometry.js';

test.each(['bracken', 'sedge'])('%s has a low spreading silhouette, deterministic colors and a bounded instance cost', kind => {
    const geometry = createWoodlandUnderstoryGeometry(kind);
    const copy = createWoodlandUnderstoryGeometry(kind);
    expect(geometry.attributes.position.array).toEqual(copy.attributes.position.array);
    expect(geometry.attributes.color.array).toEqual(copy.attributes.color.array);
    const { position, color, normal } = geometry.attributes;
    expect(position.count).toBe(color.count); expect(position.count).toBe(normal.count);
    expect(position.count / 3).toBeLessThanOrEqual(450);
    const bounds = geometry.boundingBox;
    expect(bounds.min.y).toBeGreaterThanOrEqual(0);
    expect(bounds.max.y * 1.4).toBeLessThan(1.05);
    expect(bounds.max.x - bounds.min.x).toBeGreaterThan(1.4);
    expect(bounds.max.z - bounds.min.z).toBeGreaterThan(1.4);
    for (let i = 0; i < position.count; i++) {
        expect(Math.hypot(position.getX(i), position.getZ(i)) * 1.4).toBeLessThan(2.2);
        expect(Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i))).toBeCloseTo(1, 5);
    }
    geometry.dispose(); copy.dispose();
});

test('unknown vegetation does not silently become a generic plant', () => {
    expect(() => createWoodlandUnderstoryGeometry('missing')).toThrow('Unknown woodland cover');
});
