import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { applyWorldSurfaceDetail } from './WorldSurfaceDetail.js';
import { LANTERNHOLD_ROAD_CART } from '../data/lanternholdApproach.js';

// An abandoned household wagon, not loot or a second quest interaction. Its
// packed bedding and loose canvas connect town's refugee camps to the road.
export function createLanternholdRoadCart({ quality = 'high', terrainElevation = null } = {}) {
    const root = new THREE.Group(); root.name = 'Lanternhold stranded supply cart';
    const ground = terrainElevation?.sample(LANTERNHOLD_ROAD_CART.x, LANTERNHOLD_ROAD_CART.z) ?? 0;
    root.position.set(LANTERNHOLD_ROAD_CART.x, ground, LANTERNHOLD_ROAD_CART.z);
    const materials = {
        wood: applyWorldSurfaceDetail(new THREE.MeshStandardMaterial({ color: 0x68543c, roughness: .96 }), 'timber'),
        iron: new THREE.MeshStandardMaterial({ color: 0x3e4441, metalness: .65, roughness: .7 }),
        canvas: new THREE.MeshStandardMaterial({ color: 0x9b9277, roughness: 1, side: THREE.DoubleSide }),
        cloth: new THREE.MeshStandardMaterial({ color: 0x5c6956, roughness: 1 })
    };
    const batches = new Map(), radial = quality === 'low' ? 12 : 20;
    const part = (geometry, key, x, y, z, rotation = [0, 0, 0]) => {
        const transformed = geometry.index ? geometry.toNonIndexed() : geometry.clone(); geometry.dispose();
        transformed.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(1, 1, 1)));
        if (!batches.has(key)) batches.set(key, []);
        batches.get(key).push(transformed);
    };
    const box = (key, x, y, z, w, h, d, rotation) => part(new THREE.BoxGeometry(w, h, d), key, x, y, z, rotation);
    // Visible gaps between planks, braced corners and iron fastenings keep the
    // wagon from reading as an anonymous solid box at the normal camera scale.
    for (let i = 0; i < 7; i++) box('wood', -.99 + i * .33, 1.25, 0, .3, .16, 3.7);
    for (const x of [-1.18, 1.18]) {
        for (let row = 0; row < 3; row++) box('wood', x, 1.5 + row * .27, 0, .12, .23, 3.8);
        for (const z of [-1.76, 1.76]) {
            box('wood', x, 1.67, z, .23, 1.18, .2);
            box('iron', x * 1.09, 1.67, z, .045, 1.1, .18);
        }
        // Draw shafts remain within their explicit narrow solids.
        box('wood', x * .65, .91, -3.12, .14, .2, 2.55);
    }
    for (const z of [-1.86, 1.86]) for (let row = 0; row < 3; row++) box('wood', 0, 1.5 + row * .27, z, 2.3, .23, .12);
    for (const z of [-1.22, 1.22]) {
        box('iron', 0, .95, z, 3.15, .15, .15);
        for (const side of [-1, 1]) {
            const x = side * 1.53;
            part(new THREE.TorusGeometry(.9, .085, 5, radial), 'iron', x, .99, z, [0, Math.PI / 2, 0]);
            part(new THREE.TorusGeometry(.79, .09, 5, radial), 'wood', x, .99, z, [0, Math.PI / 2, 0]);
            for (let spoke = 0; spoke < 5; spoke++) box('wood', x, .99, z, .12, 1.53, .11, [spoke * Math.PI / 5, 0, 0]);
            part(new THREE.CylinderGeometry(.17, .17, .36, 8), 'wood', x, .99, z, [0, 0, Math.PI / 2]);
        }
    }
    // Three curved hoops carry only a half cover, exposing household supplies.
    const arch = z => new THREE.CatmullRomCurve3([
        new THREE.Vector3(-1.14, 2.1, z), new THREE.Vector3(-.92, 2.98, z),
        new THREE.Vector3(0, 3.35, z), new THREE.Vector3(.92, 2.98, z), new THREE.Vector3(1.14, 2.1, z)
    ]);
    for (const z of [-1.5, 0, 1.5]) part(new THREE.TubeGeometry(arch(z), 12, .045, 5, false), 'wood', 0, 0, 0);
    const canopy = new THREE.PlaneGeometry(2.28, 1.62, 16, 8), vertices = canopy.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
        const x = vertices.getX(i), along = vertices.getY(i) + .82;
        const edgeSag = Math.sin(along / 1.64 * Math.PI) * .11;
        vertices.setXYZ(i, x, 2.1 + Math.sqrt(Math.max(0, 1 - (x / 1.14) ** 2)) * 1.25 - edgeSag
            + Math.sin(x * 18) * .015, along);
    }
    canopy.computeVertexNormals(); part(canopy, 'canvas', 0, 0, 0);
    // A boarded trunk, tied bedrolls and a folded blanket; no sparkle or chest
    // affordance that would promise an unavailable reward.
    for (let plank = 0; plank < 4; plank++) box('wood', -.62 + plank * .3, 1.9, -.86, .275, .82, .9);
    for (const x of [-.57, .3]) box('iron', x, 2.325, -.86, .09, .045, .97);
    for (const z of [.12, .72]) part(new THREE.CylinderGeometry(.25, .25, 1.6, 10), 'cloth', 0, 1.66, z, [0, 0, Math.PI / 2]);
    for (const z of [.12, .72]) for (const x of [-.5, .5]) part(new THREE.TorusGeometry(.255, .022, 4, 10), 'canvas', x, 1.66, z, [0, Math.PI / 2, 0]);
    box('cloth', .5, 1.59, 1.24, .8, .36, .66);
    for (const [key, geometries] of batches) {
        const geometry = mergeGeometries(geometries, false); geometries.forEach(g => g.dispose());
        const mesh = new THREE.Mesh(geometry, materials[key]); mesh.name = `road-cart:${key}`;
        mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
    }
    const { x, z } = LANTERNHOLD_ROAD_CART;
    root.userData.walkFootprints = [
        { siteId: 'lanternhold-road-cart', x, z, y: ground + 1.75, width: 3.5, height: 3.5, depth: 4.42 },
        ...[-1, 1].map(side => ({ siteId: 'lanternhold-road-cart', x: x + side * 1.18 * .65,
            z: z - 3.12, y: ground + .91, width: .14, height: .2, depth: 2.55 }))
    ];
    return root;
}
