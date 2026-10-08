import * as THREE from 'three';
import { createHash } from 'node:crypto';
import { EARTH_OUTCROP_SOLIDS, EARTH_OUTCROP_FORMATIONS, EARTH_OUTCROP_OUTLINE } from '../src/data/earthOutcrops.js';
import { createEarthOutcropGeometry, createEarthOutcrops } from '../src/art/EarthOutcrops.js';
import { EARTH_ELEVATION } from '../src/data/worldElevation.js';
import { EARTH_LOCATIONS, EARTH_PATHS, distanceToPath } from '../src/data/worldPopulation.js';
import { CollisionManager } from '../src/core/CollisionManager.js';

test('upper rock clefts retain the buried recipe and use the existing bounded surfaces', () => {
    const solid = EARTH_OUTCROP_SOLIDS[0];
    const first = createEarthOutcropGeometry(solid, EARTH_ELEVATION);
    const repeated = createEarthOutcropGeometry(solid, EARTH_ELEVATION);
    const changed = createEarthOutcropGeometry({ ...solid, seed: solid.seed + 19 }, EARTH_ELEVATION);
    try {
        expect(first.attributes.position.array).toEqual(repeated.attributes.position.array);
        expect(first.attributes.position.count / 3).toBe(206);
        // Exact first96 buried/base vertices captured from b58ae673 before
        // the upper-silhouette edit; no change to the existing solid's foot.
        const base = first.attributes.position.array.subarray(0, 16 * 6 * 3);
        expect(createHash('sha256').update(Buffer.from(base.buffer, base.byteOffset, base.byteLength)).digest('hex'))
            .toBe('1c3bf6af567d162c1a2bc6855ca22530c698da6132f24a2d9493832fb8c12616');
        // The upper boundary has an inward cleft, not only collinear points
        // on a scaled octagon. Cap remains planar and upward; the general
        // footprint/outward-face assertions below cover every formation.
        const position = first.attributes.position;
        const capStart = 192 * 3;
        const top = new Map();
        for (let i = capStart; i < position.count; i++) {
            top.set(`${position.getX(i)},${position.getZ(i)}`, [position.getX(i), position.getZ(i)]);
        }
        expect(top.size).toBe(16);
        const cap = [...top.values()].map(([x, z]) => [
            (x - solid.x) / (solid.width / 2), (z - solid.z) / (solid.depth / 2)
        ]).sort((a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
        const clefts = cap.map(([x, z], i) => {
            const [ax, az] = cap[(i + cap.length - 1) % cap.length];
            const [bx, bz] = cap[(i + 1) % cap.length];
            return ((bx - ax) * (z - az) - (bz - az) * (x - ax)) / Math.hypot(bx - ax, bz - az);
        });
        expect(Math.max(...clefts)).toBeGreaterThan(.02);
        // A narrower broad crown breaks the box-like silhouette without a
        // synthetic centre apex; both physical footprint dimensions retain
        // all sixteen cap boundary vertices and existing triangulation.
        for (const axis of [0, 1]) {
            const extent = Math.max(...cap.map(p => p[axis])) - Math.min(...cap.map(p => p[axis]));
            expect(extent / 2).toBeLessThan(.5);
        }
        expect(first.attributes.position.array).not.toEqual(changed.attributes.position.array);
    } finally { first.dispose(); repeated.dispose(); changed.dispose(); }
});

test('seeded cleaved crowns vary their geological plane without adding surfaces', () => {
    const solid = EARTH_OUTCROP_SOLIDS[0];
    const geometries = [solid, { ...solid, seed: solid.seed + 19 }]
        .map(recipe => createEarthOutcropGeometry(recipe, EARTH_ELEVATION));
    try {
        const crowns = geometries.map(geometry => {
            const normal = geometry.attributes.normal, sum = new THREE.Vector3();
            for (let i = 192 * 3; i < normal.count; i++) {
                sum.add(new THREE.Vector3().fromBufferAttribute(normal, i));
            }
            return sum.normalize();
        });
        expect(crowns[0].dot(crowns[1])).toBeLessThan(.9995);
        for (const geometry of geometries) expect(geometry.attributes.position.count / 3).toBe(206);
        for (const crown of crowns) expect(crown.y).toBeGreaterThan(.9);
    } finally { geometries.forEach(geometry => geometry.dispose()); }
});

test('weathered rock shoulders have continuous vertex lighting without rounding sharp cleaves', () => {
    const geometry = createEarthOutcropGeometry(EARTH_OUTCROP_SOLIDS[0], EARTH_ELEVATION);
    try {
        const position = geometry.attributes.position, normal = geometry.attributes.normal;
        const shared = new Map(), minimumDot = Math.cos(Math.PI / 4);
        const point = i => new THREE.Vector3().fromBufferAttribute(position, i);
        const face = i => new THREE.Vector3().subVectors(point(i + 1), point(i))
            .cross(new THREE.Vector3().subVectors(point(i + 2), point(i))).normalize();
        for (let quad = 0; quad < 192 * 3; quad += 6) {
            const original = face(quad).add(face(quad + 3)).normalize();
            for (let i = quad; i < quad + 6; i++) {
                const key = `${position.getX(i)},${position.getY(i)},${position.getZ(i)}`;
                if (!shared.has(key)) shared.set(key, []);
                shared.get(key).push({ original, current: new THREE.Vector3().fromBufferAttribute(normal, i) });
            }
        }
        let continuousPairs = 0, sharpPairs = 0;
        for (const normals of shared.values()) {
            const gentle = normals.every(a => normals.every(b => a.original.dot(b.original) > minimumDot));
            for (let i = 0; i < normals.length; i++) for (let j = i + 1; j < normals.length; j++) {
                const before = normals[i].original.dot(normals[j].original);
                const after = normals[i].current.dot(normals[j].current);
                if (gentle && before < .998) { expect(after).toBeGreaterThan(.998); continuousPairs++; }
                if (before < .5) { expect(after).toBeLessThan(.97); sharpPairs++; }
            }
        }
        expect(continuousPairs).toBeGreaterThan(0); expect(sharpPairs).toBeGreaterThan(0);
    } finally { geometry.dispose(); }
});

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
