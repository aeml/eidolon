import * as THREE from 'three';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { EARTH_ELEVATION as field, intersectWorldElevationRay, resolveWorldElevationProfile } from '../src/data/worldElevation.js';
import { WORLD_ELEVATION } from '../src/data/worldElevation.generated.js';
import { WORLD_REGIONS } from '../src/data/worldGeography.js';
import { EARTH_LOCATIONS } from '../src/data/worldPopulation.js';
import { createRealmGroundGeometry } from '../src/art/RealmGroundGeometry.js';

function terrainMesh() {
    const mesh = new THREE.Mesh(createRealmGroundGeometry(WORLD_REGIONS.earth, .75, field), new THREE.MeshBasicMaterial());
    mesh.rotation.x = -Math.PI / 2; mesh.position.z = 200;
    mesh.updateMatrixWorld(true); return mesh;
}

test('server terrain profile explicitly selects the candidate and rejects unknown geometry', () => {
    expect(resolveWorldElevationProfile()).toBeNull();
    expect(resolveWorldElevationProfile('flat-v1')).toBeNull();
    expect(resolveWorldElevationProfile('earth-elevation-v1')).toBe(field);
    expect(resolveWorldElevationProfile('earth-elevation-rocks-v1')).toBe(field);
    expect(() => resolveWorldElevationProfile('future-terrain')).toThrow('Unsupported server terrain profile');
});

test('canonical elevation generation is current and terrain stays bounded', () => {
    expect(execFileSync(process.execPath, ['scripts/generate-world-elevation.mjs', '--check'], { encoding: 'utf8' })).toContain('8 Earth terrain forms');
    expect(field.columns).toBe(125); expect(field.rows).toBe(100);
    expect(field.maxHeight).toBeGreaterThan(15); expect(field.maxHeight).toBeLessThan(20);
    expect(field.maxGrade).toBeLessThanOrEqual(WORLD_ELEVATION.maxGrade);
    const bytes = Buffer.alloc((field.columns + 1) * (field.rows + 1) * 4);
    for (let row = 0; row <= field.rows; row++) for (let column = 0; column <= field.columns; column++) {
        bytes.writeInt32LE(Math.round(field.vertexHeight(column, row) * 1000), (row * (field.columns + 1) + column) * 4);
    }
    expect(createHash('sha256').update(bytes).digest('hex')).toBe('d30df1a45da4f962957b8c041a6d117c54919575fa4da11891e4acb333e2e570');
    expect(() => createRealmGroundGeometry(WORLD_REGIONS.water, .75, field)).toThrow('bounds');
});

test('town, landmark footprints and realm boundaries stay level; the Earth field never applies inside instances', () => {
    for (let x = -100; x <= 100; x += 10) for (let z = 100; z <= 300; z += 10) expect(field.sample(x, z)).toBe(0);
    for (const site of EARTH_LOCATIONS) {
        expect(field.sample(site.x, site.z)).toBe(0);
        for (let i = 0; i < 16; i++) expect(field.sample(site.x + Math.cos(i * Math.PI / 8) * site.radius,
            site.z + Math.sin(i * Math.PI / 8) * site.radius)).toBe(0);
    }
    for (let i = 0; i <= 50; i++) {
        const x = field.minX + (field.maxX - field.minX) * i / 50, z = field.minZ + (field.maxZ - field.minZ) * i / 50;
        for (const point of [[x, field.minZ], [x, field.maxZ], [field.minX, z], [field.maxX, z]]) expect(field.sample(...point)).toBe(0);
    }
    for (const instance of ['dungeon_test', 'casino', 'raid_test', 'arena']) expect(field.sample(-570, 410, instance)).toBe(0);
    for (const point of [[1001, 200], [0, -700], [NaN, 200], [0, Infinity]]) expect(field.sample(...point)).toBe(0);
});

test('movement height matches actual rendered triangles, including both sides of cell diagonals', () => {
    const mesh = terrainMesh(), ray = new THREE.Raycaster();
    for (const hill of WORLD_ELEVATION.hills) for (const offset of [[0, 0], [3, 7], [11, 13], [-7, -3]]) {
        const x = hill.x + offset[0], z = hill.z + offset[1];
        ray.set(new THREE.Vector3(x, 40, z), new THREE.Vector3(0, -1, 0));
        const hits = ray.intersectObject(mesh);
        expect(hits.length).toBeGreaterThan(0);
        expect(Math.abs(hits[0].point.y - field.sample(x, z))).toBeLessThan(.0001);
        expect(hits[0].face.normal.z).toBeGreaterThan(.94);
    }
    mesh.geometry.dispose(); mesh.material.dispose();
});

test('elevation picking selects the same world point as rendered terrain instead of the old y=0 projection', () => {
    const mesh = terrainMesh();
    for (const hill of WORLD_ELEVATION.hills) {
        const target = new THREE.Vector3(hill.x, field.sample(hill.x, hill.z), hill.z);
        const origin = target.clone().add(new THREE.Vector3(35, 40, 35));
        const direction = target.clone().sub(origin).normalize();
        const ray = new THREE.Raycaster(origin, direction);
        const picked = intersectWorldElevationRay(ray.ray, new THREE.Vector3());
        expect(picked).not.toBeNull();
        expect(picked.distanceTo(target)).toBeLessThan(.00001);
        expect(picked.distanceTo(ray.intersectObject(mesh)[0].point)).toBeLessThan(.0002);
        const flat = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
        if (target.y > 1) expect(picked.distanceTo(flat)).toBeGreaterThan(1);
        expect(intersectWorldElevationRay(ray.ray, new THREE.Vector3(), { instanceId: 'dungeon_test' }).distanceTo(flat)).toBeLessThan(.00001);
        const vipPlane = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -8), new THREE.Vector3());
        expect(intersectWorldElevationRay(ray.ray, new THREE.Vector3(), { instanceId: 'casino', floorHeight: 8 }).distanceTo(vipPlane)).toBeLessThan(.00001);
    }
    expect(intersectWorldElevationRay(new THREE.Ray(new THREE.Vector3(0, 10, 0), new THREE.Vector3(1, 0, 0)), new THREE.Vector3())).toBeNull();
    expect(intersectWorldElevationRay(new THREE.Ray(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, -1, 0)), new THREE.Vector3())).toBeNull();
    mesh.geometry.dispose(); mesh.material.dispose();
});
