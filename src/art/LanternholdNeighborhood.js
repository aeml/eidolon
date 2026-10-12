import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LANTERNHOLD_HOMES, LANTERNHOLD_HOME_SCALE } from '../data/lanternholdNeighborhood.js';
import { applyWorldSurfaceDetail } from './WorldSurfaceDetail.js';
import { createLappedSlateRoof, createRoofEndInfill } from './LanternholdRoofGeometry.js';

// A single shared construction, material-batched across the residential wards.
// Wall collisions follow the closed cabin, independently of its roof/doorstep.
export function createLanternholdNeighborhood(cx = 0, cz = 200, { perInstanceFrustum = false } = {}) {
    const root = new THREE.Group(); root.name = 'Lanternhold residential wards';
    root.userData.walkFootprints = [];
    root.userData.instanceCount = LANTERNHOLD_HOMES.length;
    root.userData.drawMeshCount = 6;
    const materials = {
        stone: applyWorldSurfaceDetail(new THREE.MeshStandardMaterial({ color: 0x6c6658, roughness: .96 }), 'weathered-masonry'),
        timber: applyWorldSurfaceDetail(new THREE.MeshStandardMaterial({ color: 0x50402f, roughness: .93 }), 'timber'),
        frame: applyWorldSurfaceDetail(new THREE.MeshStandardMaterial({ color: 0x2c231d, roughness: .96 }), 'timber'),
        roof: applyWorldSurfaceDetail(new THREE.MeshStandardMaterial({ color: 0x424a50, roughness: .9, vertexColors: true }), 'fieldstone'),
        iron: new THREE.MeshStandardMaterial({ color: 0x3b3d3c, metalness: .65, roughness: .6 }),
        window: new THREE.MeshStandardMaterial({ color: 0xc49b63, emissive: 0xc0843f, emissiveIntensity: .45, roughness: .65 })
    };
    const batches = new Map();
    const part = (geometry, key, position, rotation = [0, 0, 0]) => {
        const baked = geometry.index ? geometry.toNonIndexed() : geometry.clone(); geometry.dispose();
        baked.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...position),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(1, 1, 1)));
        baked.scale(LANTERNHOLD_HOME_SCALE, LANTERNHOLD_HOME_SCALE, LANTERNHOLD_HOME_SCALE);
        if (!batches.has(key)) batches.set(key, []);
        batches.get(key).push(baked);
    };
    const box = (key, size, position, rotation) => part(new THREE.BoxGeometry(...size), key, position, rotation);
    box('stone', [6.3, .35, 5.3], [0, .18, 0]);
    // Individual vertical boards leave narrow dark construction seams. The
    // framing and flush foundation ground these small permanent dwellings.
    for (let i = 0; i < 12; i++) {
        const x = -2.75 + i * .5;
        box('timber', [.48, 3.1, .16], [x, 1.9, -2.42]);
        if (Math.abs(x) > .8) box('timber', [.48, 3.1, .16], [x, 1.9, 2.42]);
    }
    for (const x of [-2.92, 2.92]) {
        for (let i = 0; i < 10; i++) box('timber', [.16, 3.1, .48], [x, 1.9, -2.25 + i * .5]);
        for (const z of [-2.4, 0, 2.4]) box('frame', [.24, 3.3, .24], [x, 1.95, z]);
        for (const y of [.46, 3.4]) box('frame', [.24, .22, 5.1], [x, y, 0]);
        part(createRoofEndInfill(5, .1, 1.55), 'timber', [x, 3.45, 0]);
    }
    for (const z of [-2.45, 2.45]) for (const y of [.46, 3.4]) box('frame', [6.1, .22, .24], [0, y, z]);
    const slope = Math.atan2(1.55, 2.85), length = Math.hypot(1.55, 2.85);
    for (const side of [-1, 1]) part(createLappedSlateRoof(6.8, length), 'roof',
        [0, 4.2, side * 1.425], [side * slope, 0, 0]);
    box('frame', [6.9, .2, .23], [0, 5.05, 0]);
    box('frame', [1.65, 2.9, .2], [0, 1.78, 2.5]);
    for (let i = 0; i < 5; i++) box('timber', [.27, 2.65, .08], [-.56 + i * .28, 1.7, 2.62]);
    for (const y of [.85, 2.5]) box('iron', [1.25, .08, .035], [0, y, 2.68]);
    box('iron', [.09, .2, .1], [.43, 1.65, 2.72]);
    box('stone', [2.0, .12, .65], [0, .07, 2.85]);
    for (const x of [-1.9, 1.9]) {
        box('frame', [1.1, 1.35, .16], [x, 2.1, 2.54]);
        box('window', [.8, 1.05, .03], [x, 2.1, 2.64]);
        box('frame', [.06, 1.1, .08], [x, 2.1, 2.69]);
        box('frame', [.85, .07, .08], [x, 2.1, 2.69]);
        box('timber', [.4, 1.3, .12], [x + (x < 0 ? -.74 : .74), 2.1, 2.57]);
    }
    const matrix = new THREE.Matrix4();
    for (const [key, geometries] of batches) {
        const geometry = mergeGeometries(geometries, false); geometries.forEach(g => g.dispose());
        const mesh = perInstanceFrustum ? new THREE.BatchedMesh(LANTERNHOLD_HOMES.length,
            geometry.attributes.position.count, 0, materials[key]) :
            new THREE.InstancedMesh(geometry, materials[key], LANTERNHOLD_HOMES.length);
        const geometryId = perInstanceFrustum ? mesh.addGeometry(geometry) : null;
        if (perInstanceFrustum) { mesh.perObjectFrustumCulled = true; mesh.sortObjects = false; geometry.dispose(); }
        mesh.name = `residential-shacks:${key}`; mesh.castShadow = key !== 'window'; mesh.receiveShadow = true;
        LANTERNHOLD_HOMES.forEach((home, i) => {
            matrix.makeRotationY(home.rotation); matrix.setPosition(cx + home.x, .025, cz + home.z - 200);
            const instanceId = perInstanceFrustum ? mesh.addInstance(geometryId) : i;
            mesh.setMatrixAt(instanceId, matrix);
            if (['timber', 'roof'].includes(key)) mesh.setColorAt(instanceId, new THREE.Color().setScalar(.9 + (i * 7 % 9) * .024));
        });
        if (!perInstanceFrustum) mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingBox(); mesh.computeBoundingSphere(); root.add(mesh);
    }
    root.userData.walkFootprints = LANTERNHOLD_HOMES.map(home => ({ x: cx + home.x, z: cz + home.z - 200,
        width: 6.1 * LANTERNHOLD_HOME_SCALE, depth: 5 * LANTERNHOLD_HOME_SCALE,
        height: 5.2 * LANTERNHOLD_HOME_SCALE, rotation: home.rotation }));
    return root;
}
