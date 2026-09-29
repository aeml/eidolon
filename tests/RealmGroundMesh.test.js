import * as THREE from 'three';
import { createRealmGroundMesh } from '../src/art/RealmGroundMesh.js';
import { createRealmGroundGeometry } from '../src/art/RealmGroundGeometry.js';
import { WORLD_REGIONS } from '../src/data/worldGeography.js';
import { EARTH_ELEVATION as field } from '../src/data/worldElevation.js';

function triangles(geometry) {
    const result = [], attributes = Object.values(geometry.attributes);
    for (let i = 0; i < geometry.index.count; i += 3) {
        const values = [];
        for (let corner = 0; corner < 3; corner++) {
            const vertex = geometry.index.getX(i + corner);
            for (const attribute of attributes) for (let c = 0; c < attribute.itemSize; c++) {
                values.push(attribute.array[vertex * attribute.itemSize + c]);
            }
        }
        result.push(values.join(','));
    }
    return result;
}

test('raised terrain partitions every original triangle exactly once with unchanged winding, normals and UVs', () => {
    const material = new THREE.MeshBasicMaterial(), source = createRealmGroundGeometry(WORLD_REGIONS.earth, .75, field);
    const root = createRealmGroundMesh(WORLD_REGIONS.earth, material, field);
    expect(root.userData.tiledRealmGround).toBe(true);
    expect(root.children.length).toBeGreaterThan(100);
    expect(root.children.length).toBeLessThan(300);
    const partitioned = [];
    for (const tile of root.children) {
        expect(tile.material).toBe(material);
        expect(tile.receiveShadow).toBe(true);
        expect(tile.castShadow).toBe(false);
        expect(tile.frustumCulled).toBe(true);
        expect(tile.geometry.boundingSphere.radius).toBeLessThan(110);
        partitioned.push(...triangles(tile.geometry));
    }
    expect(partitioned.sort()).toEqual(triangles(source).sort());
    source.dispose(); root.traverse(o => o.geometry?.dispose()); material.dispose();
});

test('tile seams, slopes and realm gate patches retain the canonical raycast surface', () => {
    const material = new THREE.MeshBasicMaterial(), root = createRealmGroundMesh(WORLD_REGIONS.earth, material, field);
    root.rotation.x = -Math.PI / 2; root.position.z = 200; root.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    for (const [x, z] of [[340, 159], [470, 200], [600, 260], [128, -256], [256.01, 328.01], [0, -599.9], [999.9, 200]]) {
        ray.set(new THREE.Vector3(x, 40, z), new THREE.Vector3(0, -1, 0));
        const hits = ray.intersectObject(root);
        expect(hits.length).toBeGreaterThan(0);
        for (const hit of hits) expect(hit.point.y).toBeCloseTo(field.sample(x, z), 4);
    }
    root.traverse(o => o.geometry?.dispose()); material.dispose();
});

test('flat production realms retain a single mesh and material', () => {
    const material = new THREE.MeshBasicMaterial();
    for (const region of Object.values(WORLD_REGIONS)) {
        const mesh = createRealmGroundMesh(region, material);
        expect(mesh.isMesh).toBe(true); expect(mesh.children).toHaveLength(0);
        expect(mesh.material).toBe(material); mesh.geometry.dispose();
    }
    material.dispose();
});
