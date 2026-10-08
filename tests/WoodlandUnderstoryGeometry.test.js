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

test('sedge forms varied curved leaf clusters at the existing eighty-triangle cost', () => {
    const geometry = createWoodlandUnderstoryGeometry('sedge');
    try {
        const p = geometry.attributes.position;
        expect(p.count / 3).toBe(80);
        let projectedArea = 0;
        const widths = [];
        let rolledSections = 0;
        for (let i = 0; i < p.count; i += 3) {
            projectedArea += Math.abs((p.getX(i + 1) - p.getX(i)) * (p.getZ(i + 2) - p.getZ(i))
                - (p.getZ(i + 1) - p.getZ(i)) * (p.getX(i + 2) - p.getX(i))) / 2;
        }
        for (let blade = 0; blade < 16; blade++) {
            // Three bent sections, five triangles per blade; its broadest
            // section is at t=1/3, not a wide triangular base at the soil.
            const section = blade * 15 + 6;
            widths.push(Math.hypot(p.getX(section + 1) - p.getX(section), p.getZ(section + 1) - p.getZ(section)));
            if (Math.abs(p.getY(section + 1) - p.getY(section)) > .01) rolledSections++;
            expect(p.getY(blade * 15)).toBe(0);
            const tip = blade * 15 + 14;
            expect(p.getY(tip)).toBeLessThan(.1);
        }
        expect(Math.max(...widths) / Math.min(...widths)).toBeGreaterThan(1.7);
        expect(rolledSections).toBeGreaterThanOrEqual(12);
        // Sum includes overlapping leaves. Not a screen-coverage assertion.
        expect(projectedArea).toBeGreaterThan(.9);
    } finally { geometry.dispose(); }
});
