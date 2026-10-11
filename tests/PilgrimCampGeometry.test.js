import * as THREE from 'three';
import { createPilgrimCanopy } from '../src/art/PilgrimCampGeometry.js';
import { createEarthLocations } from '../src/art/ProceduralEarthLocations.js';
import { RenderSystem } from '../src/core/RenderSystem.js';

test.each(['high', 'low'])('%s canopy meets its ridge supports and keeps finite outward faces', quality => {
    const geometry = createPilgrimCanopy(quality);
    try {
        const p = geometry.attributes.position, n = geometry.attributes.normal;
        expect(geometry.index.count / 3).toBeLessThanOrEqual(320);
        expect(geometry.attributes.color.count).toBe(p.count);
        expect(geometry.attributes.uv.count).toBe(p.count);
        for (let i = 0; i < p.count; i++) {
            expect([p.getX(i), p.getY(i), p.getZ(i)].every(Number.isFinite)).toBe(true);
            expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeCloseTo(1, 4);
            expect(n.getY(i)).toBeGreaterThan(0);
            if (p.getX(i) === 0) expect(p.getY(i)).toBeCloseTo(3.8, 5);
            expect(p.getY(i)).toBeGreaterThan(.36);
        }
        // Mounted at z5.8, even the front edge lies beyond the6m trail.
        expect(geometry.boundingBox.min.z + 5.8).toBeGreaterThan(3);
        expect(geometry.boundingBox.max.z + 5.8).toBeCloseTo(8.4, 5);
        expect(geometry.boundingBox.min.x).toBe(-2.5);
        expect(geometry.boundingBox.max.x).toBe(2.5);
    } finally { geometry.dispose(); }
});

test('camp canvas shares the existing opaque cloth batch and owns no maps', () => {
    const scene = createEarthLocations();
    try {
        const camp = scene.getObjectByName('earth-location:pilgrim-rest');
        const canvas = camp.getObjectByName('pilgrim-rest:cloth');
        const pennant = scene.getObjectByName('keepers-empty-house:cloth');
        expect(canvas.material.vertexColors).toBe(true);
        expect(canvas.material.transparent).toBe(false);
        expect(canvas.material.side).toBe(THREE.DoubleSide);
        expect(canvas.material.userData.worldSurfaceDetail).toBe('canvas');
        expect(canvas.material.map).toBeNull();
        expect(canvas.material.normalMap).toBeNull();
        expect(canvas.material.roughnessMap).toBeNull();
        expect(canvas.geometry.attributes.color.count).toBe(canvas.geometry.attributes.position.count);
        expect(camp.children.filter(child => child.material === canvas.material)).toHaveLength(1);
        expect(pennant.material).toBe(canvas.material);
    } finally { RenderSystem.prototype.disposeObjectResources.call({}, scene); }
});
