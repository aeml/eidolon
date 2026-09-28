import { Vector3, CatmullRomCurve3 } from 'three';
import { createTaperedRoot, createGroveArchStone, createGrovePierCourse } from '../src/art/EarthLandmarkGeometry.js';

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
        triangles += geometry.attributes.position.count / 3;
        geometry.dispose();
    }
    expect(triangles).toBeLessThan(1000);
});

test('worn pier courses stay within the original authoritative pillar solid', () => {
    for (let index = 0; index < 6; index++) {
        const geometry = createGrovePierCourse(index); geometry.computeBoundingBox();
        const { min, max } = geometry.boundingBox;
        expect(min.x).toBeGreaterThanOrEqual(-1.5); expect(max.x).toBeLessThanOrEqual(1.5);
        expect(min.y).toBeGreaterThanOrEqual(-.00001); expect(max.y).toBeLessThanOrEqual(8);
        expect(min.z).toBeGreaterThanOrEqual(-2); expect(max.z).toBeLessThanOrEqual(2);
        geometry.dispose();
    }
});
