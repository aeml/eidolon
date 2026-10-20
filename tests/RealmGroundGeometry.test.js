import * as THREE from 'three';
import { createRealmGroundGeometry } from '../src/art/RealmGroundGeometry.js';
import { WORLD_REGIONS } from '../src/data/worldGeography.js';

test.each(Object.keys(WORLD_REGIONS))('%s keeps continuous UVs and upward faces within narrow fence footings', id => {
    const region = WORLD_REGIONS[id], geometry = createRealmGroundGeometry(region);
    const pos = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
    const width = region.maxX - region.minX, depth = region.maxZ - region.minZ;
    for (let i = 0; i < pos.count; i++) {
        expect(Math.abs(pos.getX(i))).toBeLessThanOrEqual(width / 2 + .75);
        expect(Math.abs(pos.getY(i))).toBeLessThanOrEqual(depth / 2 + .75);
        expect(pos.getZ(i)).toBe(0);
        expect(geometry.getAttribute('normal').getZ(i)).toBe(1);
        expect(uv.getX(i)).toBeCloseTo(pos.getX(i) / (width - 1.5) + .5, 6);
        expect(uv.getY(i)).toBeCloseTo(pos.getY(i) / (depth - 1.5) + .5, 6);
    }
    expect(geometry.groups).toHaveLength(0); // One material/draw, including gate patches.
    geometry.dispose();
});

test('both sides of shared gates and closed walls have ground without overlapping realms', () => {
    const material = new THREE.MeshBasicMaterial();
    const floors = Object.values(WORLD_REGIONS).filter(r => r.id !== 'town').map(region => {
        const mesh = new THREE.Mesh(createRealmGroundGeometry(region), material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set((region.minX + region.maxX) / 2, 0, (region.minZ + region.maxZ) / 2);
        mesh.updateMatrixWorld(true); return mesh;
    });
    const ray = new THREE.Raycaster();
    for (const [x, z, axis] of [[0, -600, 'z'], [-1000, 200, 'x'], [1000, 200, 'x']]) {
        for (const offset of [-1, -.5, -.05, .05, .5, 1]) {
            ray.set(new THREE.Vector3(x + (axis === 'x' ? offset : 0), 20, z + (axis === 'z' ? offset : 0)), new THREE.Vector3(0, -1, 0));
            expect(new Set(ray.intersectObjects(floors).map(hit => hit.object)).size).toBe(1);
        }
        // Closed wall footings have the same continuous, single-owner ground.
        for (const offset of [-.5, .5]) {
            ray.set(new THREE.Vector3(x + (axis === 'z' ? 40 : offset), 20, z + (axis === 'x' ? 40 : offset)), new THREE.Vector3(0, -1, 0));
            expect(new Set(ray.intersectObjects(floors).map(hit => hit.object)).size).toBe(1);
        }
    }
    floors.forEach(mesh => mesh.geometry.dispose()); material.dispose();
});

// Interior points beneath closed walls used to reveal the ocean through the
// 0.75m inset. Check every side independently, not just the open gateways.
test.each(['earth', 'water', 'fire', 'air'])('%s ground covers both sides of exterior footings and meets shared borders', id => {
    const exterior = { earth: ['south'], water: ['north', 'west', 'east'], fire: ['north', 'south', 'west'], air: ['north', 'south', 'east'] };
    const region = WORLD_REGIONS[id], material = new THREE.MeshBasicMaterial();
    const mesh = new THREE.Mesh(createRealmGroundGeometry(region), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((region.minX + region.maxX) / 2, 0, (region.minZ + region.maxZ) / 2);
    mesh.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    try {
        for (const wall of region.walls) {
            const vertical = wall.side === 'west' || wall.side === 'east';
            const minimum = wall.side === 'west' || wall.side === 'north';
            const edge = vertical ? (minimum ? region.minX : region.maxX) : (minimum ? region.minZ : region.maxZ);
            const along = (vertical ? region.minZ : region.minX) + 40;
            for (const distance of [.05, .35, .7]) {
                const inside = edge + (minimum ? distance : -distance);
                ray.set(new THREE.Vector3(vertical ? inside : along, 20, vertical ? along : inside), new THREE.Vector3(0, -1, 0));
                expect(ray.intersectObject(mesh)).toHaveLength(1);
            }
            const outside = edge + (minimum ? -.05 : .05);
            ray.set(new THREE.Vector3(vertical ? outside : along, 20, vertical ? along : outside), new THREE.Vector3(0, -1, 0));
            expect(ray.intersectObject(mesh).length > 0).toBe(exterior[id].includes(wall.side));
            const beyond = edge + (minimum ? -1 : 1);
            ray.set(new THREE.Vector3(vertical ? beyond : along, 20, vertical ? along : beyond), new THREE.Vector3(0, -1, 0));
            expect(ray.intersectObject(mesh)).toHaveLength(0);
        }
    } finally { mesh.geometry.dispose(); material.dispose(); }
});

test('exterior footings at concave realm corners have exactly one ground owner', () => {
    const material = new THREE.MeshBasicMaterial();
    const floors = ['earth', 'water', 'fire', 'air'].map(id => {
        const r = WORLD_REGIONS[id], mesh = new THREE.Mesh(createRealmGroundGeometry(r), material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set((r.minX + r.maxX) / 2, 0, (r.minZ + r.maxZ) / 2);
        mesh.updateMatrixWorld(true); return mesh;
    });
    const ray = new THREE.Raycaster();
    try {
        for (const edgeX of [-1000, 1000]) for (const edgeZ of [-600, 1000]) {
            for (const dx of [-.35, .35]) for (const dz of [-.35, .35]) {
                ray.set(new THREE.Vector3(edgeX + dx, 20, edgeZ + dz), new THREE.Vector3(0, -1, 0));
                expect(new Set(ray.intersectObjects(floors).map(hit => hit.object)).size).toBe(1);
            }
        }
    } finally { floors.forEach(mesh => mesh.geometry.dispose()); material.dispose(); }
});
