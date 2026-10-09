import * as THREE from 'three';
import { createLanternholdTentCanvas, createLanternholdTentFrame } from '../src/art/LanternholdTentGeometry.js';

test('two grounded posts support the ridge inside the original tent envelope', () => {
    const frame = createLanternholdTentFrame();
    try {
        expect(frame.index.count / 3).toBe(36);
        expect(frame.boundingBox.min.y).toBeCloseTo(.02, 6);
        expect(frame.boundingBox.max.y).toBeCloseTo(2.51, 6);
        expect(frame.boundingBox.min.z).toBeCloseTo(-1.45, 6);
        expect(frame.boundingBox.max.z).toBeCloseTo(1.45, 6);
        expect(frame.groups).toHaveLength(0);
    } finally { frame.dispose(); }
});

test.each([false, true])('static tent canvas retains its old footprint, finite unit normals and bounded cost (entrance=%s)', entrance => {
    const geometry = createLanternholdTentCanvas({ entrance });
    try {
        expect(geometry.index.count / 3).toBe(entrance ? 240 : 564);
        expect(geometry.groups).toHaveLength(0);
        expect(geometry.boundingBox.min.y).toBeGreaterThan(0);
        expect(geometry.boundingBox.max.y).toBeLessThanOrEqual(2.520001);
        for (const coordinate of ['x', 'z']) {
            expect(geometry.boundingBox.min[coordinate]).toBeGreaterThanOrEqual(-1.470001);
            expect(geometry.boundingBox.max[coordinate]).toBeLessThanOrEqual(1.470001);
        }
        for (const attribute of Object.values(geometry.attributes))
            expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true);
        const p = geometry.attributes.position, n = geometry.attributes.normal;
        for (let i = 0; i < p.count; i++) {
            expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeCloseTo(1, 5);
            if (entrance) expect(Math.abs(p.getX(i))).toBeGreaterThanOrEqual(.119999);
        }
        const vertices = geometry.index.array, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
        for (let i = 0; i < vertices.length; i += 3) {
            a.fromBufferAttribute(p, vertices[i]); b.fromBufferAttribute(p, vertices[i + 1]); c.fromBufferAttribute(p, vertices[i + 2]);
            expect(b.sub(a).cross(c.sub(a)).length()).toBeGreaterThan(1e-6);
        }
        if (!entrance) for (let i = 0; i < 2 * 9 * 13; i++) expect(n.getY(i)).toBeGreaterThan(.25);
    } finally { geometry.dispose(); }
});
