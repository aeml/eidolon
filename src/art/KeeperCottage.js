import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { applyWorldSurfaceDetail } from './WorldSurfaceDetail.js';
import { createTaperedRoot } from './EarthLandmarkGeometry.js';

// Folded, slightly wilted nursery leaves, not spherical green placeholders.
export function createKeeperGardenPlant(seed) {
    const positions = [], colors = [], uvs = [];
    const color = new THREE.Color(seed % 4 ? 0x58664a : 0x7c7450);
    for (let leaf = 0; leaf < 7; leaf++) {
        const angle = leaf * 2.4 + seed * .7, dx = Math.cos(angle), dz = Math.sin(angle);
        const length = .32 + (leaf + seed) % 3 * .09;
        const origin = [0, .02, 0], ridge = [dx * length * .55, .24 + leaf % 3 * .035, dz * length * .55];
        const tip = [dx * length, .12 + leaf % 2 * .05, dz * length];
        const left = [ridge[0] - dz * .13, ridge[1] - .1, ridge[2] + dx * .13];
        const right = [ridge[0] + dz * .13, ridge[1] - .1, ridge[2] - dx * .13];
        for (const [i, triangle] of [[origin, left, ridge], [left, tip, ridge],
            [origin, ridge, right], [ridge, tip, right]].entries()) {
            for (const point of triangle) {
                positions.push(...point);
                const shade = i < 2 ? .86 : 1.08;
                colors.push(color.r * shade, color.g * shade, color.b * shade);
                uvs.push(point[0], point[2]);
            }
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.computeVertexNormals(); return geometry;
}

// Mara's evacuated cottage: roofless, open toward the road, with the evidence
// still on the planting table. Static materials are batched; the caller owns
// disposal. All construction fits the existing foundation/three wall envelopes.
export function createKeeperCottage() {
    const root = new THREE.Group(); root.name = 'Keeper cottage';
    const materials = {
        masonry: applyWorldSurfaceDetail(new THREE.MeshStandardMaterial({ color: 0x807b69,
            vertexColors: true, roughness: .97 }), 'fieldstone'),
        timber: applyWorldSurfaceDetail(new THREE.MeshStandardMaterial({ color: 0x554536,
            vertexColors: true, roughness: .95 }), 'timber'),
        bark: applyWorldSurfaceDetail(new THREE.MeshStandardMaterial({ color: 0x403e2b,
            vertexColors: true, roughness: 1 }), 'bark'),
        slate: applyWorldSurfaceDetail(new THREE.MeshStandardMaterial({ color: 0x484e50,
            vertexColors: true, roughness: .92 }), 'fieldstone'),
        paper: new THREE.MeshStandardMaterial({ color: 0xd4c49c, vertexColors: true, roughness: .98 }),
        iron: new THREE.MeshStandardMaterial({ color: 0x444640, vertexColors: true, metalness: .55, roughness: .72 }),
        clay: new THREE.MeshStandardMaterial({ color: 0x816951, vertexColors: true, roughness: .96 })
    };
    const batches = new Map();
    const part = (geometry, surface, position, rotation = [0, 0, 0], tone = 1) => {
        const baked = geometry.index ? geometry.toNonIndexed() : geometry.clone();
        geometry.dispose();
        baked.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...position),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(1, 1, 1)));
        const colors = [], vertices = baked.attributes.position;
        for (let i = 0; i < vertices.count; i++) {
            const damp = surface === 'masonry' ? Math.max(0, 1 - vertices.getY(i) / .9) * .17 : 0;
            colors.push(tone * (1 - damp), tone * (1 - damp * .6), tone * (1 - damp * 1.2));
        }
        baked.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        if (!batches.has(surface)) batches.set(surface, []);
        batches.get(surface).push(baked);
    };
    const box = (surface, w, h, d, x, y, z, rotation = [0, 0, 0], tone = 1) =>
        part(new THREE.BoxGeometry(w, h, d), surface, [x, y, z], rotation, tone);
    const block = (w, h, d, x, y, z, yaw, seed, surface = 'masonry') => {
        const bevel = Math.min(.025, h * .12, d * .12);
        const shape = new THREE.Shape();
        shape.moveTo(-w / 2 + bevel, -h / 2 + bevel);
        shape.lineTo(w / 2 - bevel, -h / 2 + bevel);
        shape.lineTo(w / 2 - bevel, h / 2 - bevel);
        shape.lineTo(-w / 2 + bevel, h / 2 - bevel); shape.closePath();
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: d - 2 * bevel,
            bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel,
            bevelSegments: 1, steps: 1, curveSegments: 1 });
        geometry.translate(0, 0, -d / 2 + bevel);
        part(geometry, surface, [x, y, z], [0, yaw, 0], .83 + (seed % 9) * .026);
    };
    const beam = (a, b, width, depth) => {
        const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
        const delta = end.clone().sub(start);
        const geometry = new THREE.BoxGeometry(width, delta.length(), depth);
        geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()));
        part(geometry, 'timber', start.add(end).multiplyScalar(.5).toArray());
    };

    // Recessed joints and chipped course ends give the old three wall volumes
    // actual construction without new invisible obstacles or a roof over the book.
    const courses = (length, height, cx, cz, yaw, seed) => {
        const rows = Math.ceil(height / .5), rowHeight = height / rows;
        const c = Math.cos(yaw), s = Math.sin(yaw);
        for (let row = 0; row < rows; row++) {
            let at = -length / 2;
            let column = 0;
            while (at < length / 2 - .04) {
                const width = Math.min(length / 2 - at, column === 0 && row % 2 ? .48 : .88 + (row + column) % 3 * .12);
                const middle = at + width / 2;
                const topWear = row === rows - 1 ? ((column + seed) % 3) * .065 : 0;
                block(width - .028, rowHeight - .025 - topWear, .43,
                    cx + c * middle, row * rowHeight + (rowHeight - topWear) / 2,
                    cz - s * middle, yaw, seed + row * 13 + column);
                at += width; column++;
            }
        }
    };
    courses(7, 2.2, 0, -3.3, 0, 17);
    courses(4.8, 1.5, -3.3, -.7, Math.PI / 2, 29);
    courses(3.6, .85, 3.3, -1.3, Math.PI / 2, 43);

    // The floor is flush rubble/flagstone, not an opaque rectangular plinth.
    for (let row = 0; row < 6; row++) for (let column = 0; column < 7; column++) {
        const seed = row * 17 + column * 11;
        if (seed % 7 === 2 || (row === 5 && column % 3 === 1)) continue;
        block(.87 + seed % 3 * .025, .045, .79, -2.94 + column * .98,
            .014, -2.76 + row * .93, (seed % 3 - 1) * .028, seed);
    }
    // A split kitchen-wall seam and dark hearth mark the house described in
    // the diary. Quiet charcoal replaces the unexplained floating green stones.
    box('slate', 1.15, .035, .4, 1.75, .055, -2.83);
    for (const x of [1.03, 2.47]) block(.23, .7, .38, x, .35, -2.83, 0, 7);
    block(1.65, .18, .38, 1.75, .77, -2.83, 0, 4);
    for (let i = 0; i < 3; i++) box('bark', .78, .055, .09, 1.65, .09 + i * .04, -2.73 - i * .05, [0, i * .35, .05]);

    // Fallen roof timbers/slates stay against the ruined sides, clear of the
    // central approach. A few exposed iron straps retain their former purpose.
    beam([-3.12, .22, -2.6], [-3.12, 1.36, .95], .15, .17);
    beam([2.97, .19, -2.7], [2.98, .49, -.05], .14, .16);
    for (let i = 0; i < 6; i++) {
        block(.42, .045, .62, 2.58 + i % 2 * .27, .09 + i % 3 * .025,
            -1.95 + Math.floor(i / 2) * .65, -.18 + i * .06, i, 'slate');
    }
    for (const z of [-2.3, -.3]) box('iron', .2, .035, .25, -3.1, .35 + (z + 2.3) * .31, z, [.3, 0, 0]);

    part(createTaperedRoot([[-3.28, 1.12, -2.5], [-3.19, .75, -1.8],
        [-3.06, .14, -.3], [-2.9, .035, 1.45]], .15, 'low'), 'bark', [0, 0, 0]);
    part(createTaperedRoot([[-3.26, .38, -1.5], [-2.8, .18, -2.4],
        [-1.9, .055, -2.97], [-.8, .025, -2.97]], .12, 'low'), 'bark', [0, 0, 0]);

    // Four-legged planting table, worn boards, ledger and pressed leaf. The
    // readable page remains at the same centre and height as the old evidence.
    for (let i = 0; i < 5; i++) box('timber', 2.2, .12, .26, 0, 1.25, -.56 + i * .28, [0, 0, 0], .88 + i * .04);
    for (const x of [-.8, .8]) for (const z of [-.45, .45]) box('timber', .13, 1.18, .13, x, .62, z);
    for (const x of [-.8, .8]) box('timber', .1, .13, 1.07, x, .42, 0);
    box('timber', 1.67, .1, .12, 0, .43, 0);
    box('timber', 1.19, .085, .9, 0, 1.365, 0, [0, -.06, 0], .62);
    for (const side of [-1, 1]) {
        box('paper', .52, .075, .76, side * .265, 1.445, 0, [0, 0, -side * .12]);
        for (let line = 0; line < 5; line++) box('timber', .25 + line % 2 * .085, .008, .017,
            side * .265, 1.488, -.23 + line * .095);
    }
    box('clay', .035, .012, .85, .03, 1.502, .08);
    const leaf = new THREE.Shape(); leaf.moveTo(0, -.12); leaf.quadraticCurveTo(.12, .01, 0, .17);
    leaf.quadraticCurveTo(-.1, .01, 0, -.12);
    part(new THREE.ShapeGeometry(leaf), 'bark', [.32, 1.505, .11], [-Math.PI / 2, 0, -.4], 1.4);
    // Small nursery pots connect the domestic scene to Mara's work as keeper.
    for (let i = 0; i < 3; i++) {
        const x = -2.55 + i * .34, z = -2.55;
        const pot = new THREE.LatheGeometry([new THREE.Vector2(.12, 0), new THREE.Vector2(.2, .27),
            new THREE.Vector2(.21, .31), new THREE.Vector2(.165, .31), new THREE.Vector2(.08, .055)], 10);
        part(pot, 'clay', [x, .05, z], [0, i * .7, 0], .85 + i * .08);
    }
    for (const [surface, parts] of batches) {
        const geometry = mergeGeometries(parts, false); parts.forEach(part => part.dispose());
        geometry.computeBoundingBox(); geometry.computeBoundingSphere();
        const mesh = new THREE.Mesh(geometry, materials[surface]); mesh.name = `keeper-cottage:${surface}`;
        mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
    }
    return root;
}
