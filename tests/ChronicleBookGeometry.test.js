import { createChronicleBookGeometry } from '../src/art/ChronicleBookGeometry.js';

test('folded evidence pages are deterministic, finite and inside the existing book', () => {
    const first = createChronicleBookGeometry(), second = createChronicleBookGeometry();
    try {
        for (const key of ['pages', 'ink']) {
            const geometry = first[key], p = geometry.attributes.position, n = geometry.attributes.normal;
            expect(p.array).toEqual(second[key].attributes.position.array);
            expect([...p.array, ...n.array].every(Number.isFinite)).toBe(true);
            expect(geometry.boundingBox.min.x).toBeGreaterThan(-.58);
            expect(geometry.boundingBox.max.x).toBeLessThan(.58);
            expect(geometry.boundingBox.min.z).toBeGreaterThan(-.39);
            expect(geometry.boundingBox.max.z).toBeLessThan(.39);
            expect(geometry.boundingBox.min.y).toBeGreaterThan(-.04);
            expect(geometry.boundingBox.max.y).toBeLessThan(.08);
            for (let i = 0; i < n.count; i++) expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeCloseTo(1, 4);
        }
        expect(first.pages.attributes.position.count / 3).toBe(128);
        expect(first.ink.attributes.position.count / 3).toBe(32);
        expect(Math.min(...Array.from(first.ink.attributes.normal.array).filter((_, i) => i % 3 === 1))).toBeGreaterThan(.9);
        expect(new Set(Array.from(first.pages.attributes.position.array).filter((_, i) => i % 3 === 1)).size).toBeGreaterThan(10);
    } finally { Object.values(first).forEach(g => g.dispose()); Object.values(second).forEach(g => g.dispose()); }
});

test('curved paper lighting is continuous across triangles but leaves stack edges sharp', () => {
    const surfaces = createChronicleBookGeometry(), shared = new Map();
    try {
        const p = surfaces.pages.attributes.position, n = surfaces.pages.attributes.normal;
        for (let i = 0; i < p.count; i++) {
            const key = `${p.getX(i)},${p.getY(i)},${p.getZ(i)}`;
            if (!shared.has(key)) shared.set(key, []);
            shared.get(key).push([n.getX(i), n.getY(i), n.getZ(i)]);
        }
        let continuous = 0, sharp = 0;
        for (const normals of shared.values()) {
            const top = normals.filter(n => n[1] > .9), edges = normals.filter(n => Math.abs(n[1]) < .1);
            if (top.length > 1) { top.forEach(n => expect(n).toEqual(top[0])); continuous++; }
            if (top.length && edges.length) sharp++;
        }
        expect(continuous).toBeGreaterThan(20); expect(sharp).toBeGreaterThan(10);
    } finally { Object.values(surfaces).forEach(g => g.dispose()); }
});
