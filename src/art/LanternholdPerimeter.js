import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { applyWorldSurfaceDetail } from './WorldSurfaceDetail.js';

// Weathered timber and iron, inside the existing fence collision envelope.
// Unbatched construction is a rendering reference, not the runtime path.
export function createLanternholdPerimeter(cx, cz, width, depth, { batched = true } = {}) {
    const root = new THREE.Group(); root.name = 'TownFence';
    const materials = {
        timber: applyWorldSurfaceDetail(new THREE.MeshStandardMaterial({ color: 0x554b3a,
            roughness: .95, vertexColors: true, shadowSide: THREE.FrontSide }), 'timber'),
        iron: new THREE.MeshStandardMaterial({ color: 0x3c4140, roughness: .66, metalness: .6, shadowSide: THREE.FrontSide }),
        amber: new THREE.MeshStandardMaterial({ color: 0xd8b67d, emissive: 0xd7963f,
            emissiveIntensity: .7, roughness: .7, shadowSide: THREE.FrontSide })
    };
    const shape = new THREE.Shape();
    shape.moveTo(-.29, 0); shape.lineTo(.29, 0); shape.lineTo(.29, 5.02);
    shape.lineTo(.035, 5.6); shape.lineTo(-.29, 5.35); shape.closePath();
    const stake = new THREE.ExtrudeGeometry(shape, { depth: .26, bevelEnabled: false, steps: 1 });
    stake.translate(0, 0, -.13);
    const geometries = {
        box: new THREE.BoxGeometry(1, 1, 1), stake,
        cap: new THREE.ConeGeometry(.5, 1, 4)
    };
    const buckets = new Map(), colliders = [];
    let sourceParts = 0, gatePosts = 0;
    const part = (geometry, material, x, y, z, sx, sy, sz, rotation = [0, 0, 0], shade = 1, name = '') => {
        const local = geometry.index ? geometry.toNonIndexed() : geometry.clone();
        if (material === 'timber') {
            const values = new Float32Array(local.attributes.position.count * 3);
            values.fill(shade); local.setAttribute('color', new THREE.BufferAttribute(values, 3));
        }
        const transform = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(sx, sy, sz));
        sourceParts++;
        if (!batched) {
            const mesh = new THREE.Mesh(local, materials[material]); mesh.name = name;
            mesh.applyMatrix4(transform); mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
            return;
        }
        const bx = Math.floor(x / 32) * 32, bz = Math.floor(z / 32) * 32;
        const key = `${material}:${bx}:${bz}`;
        if (!buckets.has(key)) buckets.set(key, { material, x: bx, z: bz, parts: [] });
        transform.elements[12] -= bx; transform.elements[14] -= bz;
        local.applyMatrix4(transform); buckets.get(key).parts.push(local);
    };
    const segment = (x, z, yaw, gate, seed) => {
        const c = Math.cos(yaw), s = Math.sin(yaw), shade = .83 + (seed % 7) * .025;
        const box = (key, dx, y, dz, w, h, d, name, tilt = 0) => part(geometries.box, key,
            x + c * dx + s * dz, y, z - s * dx + c * dz, w, h, d, [0, yaw, tilt], shade, name);
        const postHeight = gate ? 5.55 : 6.8;
        box('timber', 0, postHeight / 2, 0, .72, postHeight, .72, 'perimeter:post');
        for (const y of [1.15, gate ? 5.32 : 6.45]) box('iron', 0, y, 0, .8, .14, .8, 'perimeter:post-band');
        // Uneven chisel-cut tops and narrow gaps retain the readable open
        // silhouette while making the perimeter a constructed defensive fence.
        for (const [i, offset] of [-1.5, -.5, .5, 1.5].entries()) {
            const scale = .87 + ((seed + i * 3) % 9) * .016;
            part(geometries.stake, 'timber', x + c * offset, 0, z - s * offset,
                1, scale, 1, [0, yaw, 0], shade + i * .025, 'perimeter:split-paling');
        }
        for (const y of [1.6, 3.6]) {
            box('timber', 0, y, -.23, 4, .24, .22, 'perimeter:cross-rail');
            for (const offset of [-1.5, 1.5]) box('iron', offset, y, -.355, .12, .12, .025, 'perimeter:rail-fastening');
        }
        // The brace ends stop within the same four-metre segment and narrow
        // collision depth. No decorative beam projects across a gate opening.
        box('timber', 0, 2.6, .23, Math.hypot(3.6, 1.7), .16, .2,
            'perimeter:diagonal-brace', (seed % 2 ? 1 : -1) * Math.atan2(1.7, 3.6));
        if (gate) {
            gatePosts++;
            box('iron', 0, 5.67, 0, .86, .14, .86, 'perimeter:lantern-foot');
            box('amber', 0, 6.3, 0, .48, 1.05, .48, 'perimeter:gate-light');
            for (const dx of [-.32, .32]) for (const dz of [-.32, .32]) box('iron', dx, 6.32, dz,
                .065, 1.24, .065, 'perimeter:lantern-frame');
            box('iron', 0, 6.96, 0, .86, .1, .86, 'perimeter:lantern-crown');
            part(geometries.cap, 'iron', x, 7.25, z, 1.15, .5, 1.15, [0, Math.PI / 4, 0], 1, 'perimeter:lantern-roof');
            box('iron', 0, 7.65, 0, .09, .3, .09, 'perimeter:lantern-finial');
        } else {
            part(geometries.cap, 'timber', x, 7.3, z, 1, 1, 1, [0, Math.PI / 4, 0], shade, 'perimeter:cut-post-top');
        }
        // Preserve the old collider dimensions and iteration order exactly.
        colliders.push(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x, 4, z),
            new THREE.Vector3(Math.abs(c) > .1 ? 4.5 : 1, 8, Math.abs(s) > .1 ? 4.5 : 1)));
    };
    for (const z of [cz - depth / 2, cz + depth / 2]) {
        for (let x = cx - width / 2; x <= cx + width / 2; x += 4) {
            const offset = Math.abs(x - cx); if (offset < 10) continue;
            segment(x, z, 0, offset < 14, Math.round((x - cx + width / 2) / 4));
        }
    }
    for (const x of [cx - width / 2, cx + width / 2]) {
        for (let z = cz - depth / 2; z <= cz + depth / 2; z += 4) {
            const offset = Math.abs(z - cz); if (offset < 10) continue;
            segment(x, z, Math.PI / 2, offset < 14, Math.round((z - cz + depth / 2) / 4));
        }
    }
    for (const bucket of buckets.values()) {
        const geometry = mergeGeometries(bucket.parts, false); bucket.parts.forEach(value => value.dispose());
        geometry.computeBoundingBox(); geometry.computeBoundingSphere();
        const mesh = new THREE.Mesh(geometry, materials[bucket.material]);
        mesh.name = `perimeter:${bucket.material}`; mesh.position.set(bucket.x, 0, bucket.z);
        mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
    }
    Object.values(geometries).forEach(geometry => geometry.dispose());
    for (const [key, material] of Object.entries(materials)) {
        if (!root.children.some(mesh => mesh.material === material)) material.dispose();
        else material.name = `lanternhold-perimeter:${key}`;
    }
    root.userData.walkColliders = colliders;
    root.userData.sourceParts = sourceParts; root.userData.gatePosts = gatePosts;
    return root;
}
