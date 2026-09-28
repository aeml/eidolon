import { createKilnArchBeam } from '../src/art/FireLandmarkGeometry.js';

test.each([false, true])('kiln web/flange %s is finite, overhead and below the camera crown budget', flange => {
    const geometry = createKilnArchBeam(flange), bounds = geometry.boundingBox;
    expect(bounds.min.y).toBeGreaterThan(6.9); expect(bounds.max.y).toBeLessThan(13);
    expect(bounds.min.x).toBeGreaterThan(-10.7); expect(bounds.max.x).toBeLessThan(10.7);
    expect(bounds.min.z).toBeGreaterThan(-.6); expect(bounds.max.z).toBeLessThan(.6);
    expect([...geometry.attributes.position.array, ...geometry.attributes.normal.array].every(Number.isFinite)).toBe(true);
    expect(geometry.attributes.position.count / 3).toBeLessThan(1500);
    geometry.dispose();
});
