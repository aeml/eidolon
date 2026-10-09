import { Vector3, CatmullRomCurve3 } from 'three';
import { createTaperedRoot, createGroveArchStone, createGrovePierCourse, createGroveThresholdStone } from '../src/art/EarthLandmarkGeometry.js';

test.each(['high', 'low'])('organic roots taper within their old radius at %s quality', quality => {
    const points = [[14, -.35, 4], [10, 3, 2], [9, 8, 0], [5, 12, 0], [1, 15.8, 0]];
    const curve = new CatmullRomCurve3(points.map(point => new Vector3(...point)));
    const geometry = createTaperedRoot(points, .85, quality);
    const position = geometry.attributes.position, radial = quality === 'low' ? 6 : 10, segments = quality === 'low' ? 12 : 24;
    for (let ring = 0; ring <= segments; ring++) {
        const center = curve.getPointAt(ring / segments);
        for (let side = 0; side <= radial; side++) {
            const distance = new Vector3().fromBufferAttribute(position, ring * (radial + 1) + side).distanceTo(center);
            expect(distance).toBeLessThanOrEqual(.85001);
            if (ring === segments) expect(distance).toBeLessThan(.031);
        }
    }
    expect([...geometry.attributes.normal.array].every(Number.isFinite)).toBe(true);
    expect(geometry.boundingSphere.radius).toBeLessThan(20);
    geometry.dispose();
});

test('thirteen beveled vault stones remain overhead with a clear hero-height passage', () => {
    let triangles = 0;
    for (let index = 0; index < 13; index++) {
        const geometry = createGroveArchStone(index); geometry.computeBoundingBox();
        expect(geometry.boundingBox.min.y).toBeGreaterThan(7.9);
        expect(geometry.boundingBox.max.y).toBeLessThan(14);
        expect(geometry.boundingBox.min.x).toBeGreaterThan(-9.6);
        expect(geometry.boundingBox.max.x).toBeLessThan(9.6);
        expect([...geometry.attributes.position.array].every(Number.isFinite)).toBe(true);
        expect(geometry.attributes.normal.count).toBe(geometry.attributes.position.count);
        expect(geometry.attributes.color.count).toBe(geometry.attributes.position.count);
        triangles += geometry.attributes.position.count / 3;
        geometry.dispose();
    }
    expect(triangles).toBeLessThan(1000);
});

test('vault faces follow the elliptical opening instead of cutting flat chords across it', () => {
    const geometry = createGroveArchStone(3), position = geometry.attributes.position;
    const angles = new Set();
    for (let i = 0; i < position.count; i++) {
        const x = position.getX(i), y = (position.getY(i) - 8) / .55;
        const radius = Math.hypot(x, y);
        // Inspect the front/back flat face vertices, not bevel-offset corners.
        if (radius > 9.3 && radius < 9.5) angles.add(Math.atan2(y, x).toFixed(3));
    }
    expect(angles.size).toBeGreaterThanOrEqual(3);
    expect(angles.has((3.5 / 13 * Math.PI).toFixed(3))).toBe(true);
    geometry.dispose();
});

test('carved opening lips are finite, face both ways and stay inside the original vault depth', () => {
    const geometry = createGroveArchStone(4); geometry.computeBoundingBox();
    expect(geometry.boundingBox.min.z).toBeGreaterThanOrEqual(-1.961);
    expect(geometry.boundingBox.max.z).toBeLessThanOrEqual(1.961);
    const position = geometry.attributes.position, normal = geometry.attributes.normal;
    const front = [], back = [];
    for (let i = 0; i < position.count; i++) {
        const radius = Math.hypot(position.getX(i), (position.getY(i) - 8) / .55);
        if (radius < 6.60 || radius > 6.94) continue;
        if (position.getZ(i) < -1.93) front.push(normal.getZ(i));
        if (position.getZ(i) > 1.93) back.push(normal.getZ(i));
    }
    expect(front.length).toBeGreaterThan(0); expect(back.length).toBeGreaterThan(0);
    expect(front.some(z => z < -.5)).toBe(true); expect(back.some(z => z > .5)).toBe(true);
    geometry.dispose();
});

test('worn masonry is deterministic and keeps useful UVs and unit face normals', () => {
    for (const create of [() => createGroveArchStone(4), () => createGrovePierCourse(2)]) {
        const geometry = create(), repeat = create();
        expect(geometry.attributes.position.array).toEqual(repeat.attributes.position.array);
        expect(geometry.attributes.color.array).toEqual(repeat.attributes.color.array);
        expect(geometry.attributes.uv.count).toBe(geometry.attributes.position.count);
        for (let i = 0; i < geometry.attributes.normal.count; i++) {
            const length = new Vector3().fromBufferAttribute(geometry.attributes.normal, i).length();
            expect(length).toBeCloseTo(1, 4);
        }
        geometry.dispose(); repeat.dispose();
    }
});

test('worn pier courses stay within the original authoritative pillar solid', () => {
    for (let index = 0; index < 6; index++) {
        const geometry = createGrovePierCourse(index); geometry.computeBoundingBox();
        const { min, max } = geometry.boundingBox;
        expect(min.x).toBeGreaterThanOrEqual(-1.5); expect(max.x).toBeLessThanOrEqual(1.5);
        expect(min.y).toBeGreaterThanOrEqual(-.00001); expect(max.y).toBeLessThanOrEqual(8);
        expect(min.z).toBeGreaterThanOrEqual(-2); expect(max.z).toBeLessThanOrEqual(2);
        expect(geometry.attributes.color.count).toBe(geometry.attributes.position.count);
        expect(new Set([...geometry.attributes.color.array].map(value => value.toFixed(2))).size).toBeGreaterThan(5);
        expect(geometry.attributes.position.count / 3).toBeLessThan(200);
        geometry.dispose();
    }
});

test('threshold fragments are finite, upward-facing, bounded and flush', () => {
    for (let seed = 0; seed < 70; seed++) {
        const geometry = createGroveThresholdStone(seed); geometry.computeBoundingBox();
        expect(Math.abs(geometry.boundingBox.min.y)).toBeLessThan(.0001);
        expect(Math.abs(geometry.boundingBox.max.y)).toBeLessThan(.0001);
        expect(geometry.boundingBox.min.x).toBeGreaterThan(-1.16);
        expect(geometry.boundingBox.max.x).toBeLessThan(1.16);
        expect([...geometry.attributes.position.array].every(Number.isFinite)).toBe(true);
        expect([...geometry.attributes.color.array].every(value => Number.isFinite(value) && value > 0 && value < 1.2)).toBe(true);
        for (let i = 0; i < geometry.attributes.normal.count; i++) expect(geometry.attributes.normal.getY(i)).toBeCloseTo(1);
        geometry.dispose();
    }
});
