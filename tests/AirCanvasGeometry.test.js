import * as THREE from 'three';
import { createAirWindbreakSail } from '../src/art/AirCanvasGeometry.js';
import { createElementalLocations } from '../src/art/ProceduralElementalLocations.js';
import { RenderSystem } from '../src/core/RenderSystem.js';

test.each(['high', 'low'])('%s sail folds, normals and seams stay finite inside the existing frame', quality => {
    const geometry = createAirWindbreakSail(quality, 1), same = createAirWindbreakSail(quality, 1);
    expect(geometry.attributes.position.array).toEqual(same.attributes.position.array);
    expect(geometry.attributes.color.array).toEqual(same.attributes.color.array);
    expect(geometry.boundingBox.min.x).toBe(-7); expect(geometry.boundingBox.max.x).toBe(7);
    expect(geometry.boundingBox.min.y).toBeGreaterThanOrEqual(-1.75); expect(geometry.boundingBox.max.y).toBeLessThanOrEqual(1.75);
    expect(geometry.boundingBox.max.z).toBeGreaterThan(.1); expect(geometry.boundingBox.max.z).toBeLessThan(.25);
    expect(geometry.index.count / 3).toBe(quality === 'low' ? 96 : 384);
    const p = geometry.attributes.position, n = geometry.attributes.normal, colors = geometry.attributes.color;
    for (let i = 0; i < p.count; i++) {
        if (![p.getX(i), p.getY(i), p.getZ(i), colors.getX(i), colors.getY(i), colors.getZ(i)].every(Number.isFinite)) throw new Error('invalid canvas');
        expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeCloseTo(1, 4);
        if (Math.abs(p.getX(i)) === 7 || Math.abs(p.getY(i)) === 1.75) expect(Math.abs(p.getZ(i))).toBeLessThan(1e-10);
    }
    const posed = new THREE.Mesh(geometry);
    posed.position.set(12, 3, 0); posed.rotation.set(0, Math.PI / 2, -.1);
    const bounds = new THREE.Box3().setFromObject(posed);
    expect(bounds.min.x).toBeGreaterThan(11.65); expect(bounds.max.x).toBeLessThan(12.35);
    expect(new Set(colors.array).size).toBeGreaterThan(20);
    posed.material.dispose(); geometry.dispose(); same.dispose();
});

test('camp canvases share one scene-owned material and keep unchanged High/Low walking footprints', () => {
    const high = createElementalLocations('air'), low = createElementalLocations('air', { quality: 'low' });
    expect(high.userData.walkFootprints).toEqual(low.userData.walkFootprints);
    for (const scene of [high, low]) {
        const sails = [];
        scene.traverse(part => { if (part.name.endsWith(':canvas')) sails.push(part); });
        expect(sails).toHaveLength(2); expect(sails[0].material).toBe(sails[1].material);
        expect(sails[0].material.vertexColors).toBe(true); expect(sails[0].material.transparent).toBe(false);
        expect(sails[0].material.side).toBe(THREE.DoubleSide);
        for (const sail of sails) expect(sail.geometry.attributes.color.count).toBe(sail.geometry.attributes.position.count);
        RenderSystem.prototype.disposeObjectResources.call({}, scene);
    }
});

test.each(['high', 'low'])('%s mounted windbreak corners meet the actual frame rather than floating above it', quality => {
    const scene = createElementalLocations('air', { quality });
    try {
        for (const name of ['couriers-exchange:canvas', 'weatherkeepers-bivouac:canvas']) {
            const canvas = scene.getObjectByName(name);
            expect(canvas).toBeDefined();
            const positions = canvas.geometry.attributes.position;
            const hasCorner = (x, y, z) => {
                for (let i = 0; i < positions.count; i++) {
                    if (Math.abs(positions.getX(i) - x) < 1e-5 &&
                        Math.abs(positions.getY(i) - y) < 1e-5 &&
                        Math.abs(positions.getZ(i) - z) < 1e-5) return true;
                }
                return false;
            };
            // These are the baked local positions of the two existing5m
            // posts/top spar. Corners at1.5m keep the original open lower bay.
            for (const x of [-12, 12]) for (const z of [-7, 7]) {
                expect(hasCorner(x, 5, z)).toBe(true);
                expect(hasCorner(x, 1.5, z)).toBe(true);
            }
        }
    } finally { RenderSystem.prototype.disposeObjectResources.call({}, scene); }
});
