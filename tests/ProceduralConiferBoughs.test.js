import { Vector3 } from 'three';
import { createConiferBoughGeometry } from '../src/art/ProceduralConiferBoughs.js';

test.each(['high', 'low'])('%s needle sprays have fuller projected coverage without adding triangles', quality => {
    const geometry = createConiferBoughGeometry(quality), duplicate = createConiferBoughGeometry(quality);
    try {
        const position = geometry.attributes.position, normal = geometry.attributes.normal;
        expect(position.count / 3).toBe(quality === 'high' ? 840 : 420);
        expect(position.array).toEqual(duplicate.attributes.position.array);
        expect(geometry.attributes.color.array).toEqual(duplicate.attributes.color.array);
        expect(normal.count).toBe(position.count);
        expect(geometry.boundingBox.min.y).toBeGreaterThan(-1.8);
        expect(geometry.boundingBox.max.y).toBeLessThan(1.7);
        expect(geometry.boundingSphere.radius).toBeLessThan(2.6);
        let coverage = 0;
        for (let i = 0; i < position.count; i += 3) {
            const a = new Vector3().fromBufferAttribute(position, i);
            const b = new Vector3().fromBufferAttribute(position, i + 1);
            const c = new Vector3().fromBufferAttribute(position, i + 2);
            coverage += Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)) / 2;
        }
        // This is projected fan area (overlap retained), not an opacity or
        // screen-pixel claim. The old narrow sprays total about14.49 square m.
        expect(coverage).toBeGreaterThan(18);
        for (let i = 0; i < normal.count; i++) {
            expect(new Vector3().fromBufferAttribute(normal, i).length()).toBeCloseTo(1, 5);
        }
        for (const axis of ['x', 'z']) {
            expect(geometry.boundingBox.min[axis]).toBeGreaterThan(-2);
            expect(geometry.boundingBox.max[axis]).toBeLessThan(2);
        }
    } finally { geometry.dispose(); duplicate.dispose(); }
});

test('Low retains every High outer spray and deterministic droop; only the interior fold is omitted', () => {
    const high = createConiferBoughGeometry(), low = createConiferBoughGeometry('low');
    try {
        for (let spray = 0; spray < 420; spray++) {
            expect(high.attributes.position.array.slice(spray * 18, spray * 18 + 9))
                .toEqual(low.attributes.position.array.slice(spray * 9, spray * 9 + 9));
            expect(high.attributes.color.array.slice(spray * 18, spray * 18 + 9))
                .toEqual(low.attributes.color.array.slice(spray * 9, spray * 9 + 9));
            const rootY = low.attributes.position.getY(spray * 3), tipY = low.attributes.position.getY(spray * 3 + 2);
            expect(rootY - tipY).toBeGreaterThan(.06);
        }
    } finally { high.dispose(); low.dispose(); }
});
