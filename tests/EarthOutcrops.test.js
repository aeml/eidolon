import * as THREE from 'three';
import { EARTH_OUTCROP_SOLIDS, EARTH_OUTCROP_FORMATIONS, EARTH_OUTCROP_OUTLINE } from '../src/data/earthOutcrops.js';
import { createEarthOutcropGeometry, createEarthOutcrops } from '../src/art/EarthOutcrops.js';
import { EARTH_ELEVATION } from '../src/data/worldElevation.js';
import { EARTH_LOCATIONS, EARTH_PATHS, distanceToPath } from '../src/data/worldPopulation.js';
import { CollisionManager } from '../src/core/CollisionManager.js';

test('candidate rock bodies have finite outward faces, buried bases and explicit bounded footprints', () => {
    for (const terrain of [null, EARTH_ELEVATION]) for (const solid of EARTH_OUTCROP_SOLIDS) {
        const geometry = createEarthOutcropGeometry(solid, terrain);
        const position = geometry.attributes.position, normal = geometry.attributes.normal;
        // More modeled ledges, still fewer than 4,000 triangles for all 18
        // bodies. Draw count remains one merged mesh per formation.
        expect(position.count / 3).toBeLessThanOrEqual(206);
        expect(new Set(geometry.attributes.color.array).size).toBeGreaterThan(10);
        let upwardFaces = 0;
        for (let i = 0; i < position.count; i++) {
            expect(Number.isFinite(position.getY(i))).toBe(true);
            expect(Math.abs(position.getX(i) - solid.x)).toBeLessThanOrEqual(solid.width / 2 + .0001);
            expect(Math.abs(position.getZ(i) - solid.z)).toBeLessThanOrEqual(solid.depth / 2 + .0001);
            const x = (position.getX(i) - solid.x) / (solid.width / 2);
            const z = (position.getZ(i) - solid.z) / (solid.depth / 2);
            for (let edge = 0; edge < EARTH_OUTCROP_OUTLINE.length; edge++) {
                const [ax, az] = EARTH_OUTCROP_OUTLINE[edge];
                const [bx, bz] = EARTH_OUTCROP_OUTLINE[(edge + 1) % EARTH_OUTCROP_OUTLINE.length];
                expect((bx - ax) * (z - az) - (bz - az) * (x - ax)).toBeGreaterThanOrEqual(-.0001);
            }
            expect(Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i))).toBeCloseTo(1, 4);
            if (normal.getY(i) > .5) upwardFaces++;
        }
        expect(upwardFaces).toBeGreaterThan(0);
        // The triangulated cap has no synthetic central apex and faces up.
        for (let i = 192 * 3; i < position.count; i++) {
            expect(normal.getY(i)).toBeGreaterThan(.5);
        }
        for (let x = -solid.width / 2; x <= solid.width / 2; x++) for (let z = -solid.depth / 2; z <= solid.depth / 2; z++) {
            const ground = terrain?.sample(solid.x + x, solid.z + z) ?? 0;
            expect(geometry.boundingBox.min.y).toBeLessThan(ground);
        }
        geometry.dispose();
    }
});

test('formations preserve route and landmark clearances, with reusable local collision bounds', () => {
    const root = createEarthOutcrops({ terrainElevation: EARTH_ELEVATION });
    expect(root.children).toHaveLength(EARTH_OUTCROP_FORMATIONS.length);
    expect(root.userData.walkFootprints).toHaveLength(EARTH_OUTCROP_SOLIDS.length);
    for (const footprint of root.userData.walkFootprints) {
        const apron = Math.hypot(footprint.width / 2, footprint.depth / 2) + 3;
        for (const path of EARTH_PATHS) expect(distanceToPath(footprint.x, footprint.z, path.points))
            .toBeGreaterThan(path.width / 2 + apron);
        for (const site of EARTH_LOCATIONS) expect(Math.hypot(footprint.x - site.x, footprint.z - site.z))
            .toBeGreaterThan(site.radius + apron);
        const box = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(footprint.x, footprint.y, footprint.z),
            new THREE.Vector3(footprint.width, footprint.height, footprint.depth));
        const collision = new CollisionManager(); collision.addCollider(box);
        const ground = EARTH_ELEVATION.sample(footprint.x, footprint.z);
        const inside = new THREE.Vector3(footprint.x, ground, footprint.z);
        const resolved = collision.checkCollision(inside, 1.25);
        expect(resolved).not.toBeNull();
        expect(box.intersectsSphere(new THREE.Sphere(resolved, 1.249))).toBe(false);
    }
    const materials = new Set();
    root.children.forEach(mesh => { materials.add(mesh.material); mesh.geometry.dispose(); });
    expect(materials.size).toBe(1); materials.forEach(material => material.dispose());
});
