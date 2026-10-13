import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DARK_DISTRICT_ROOF_SPAN } from './DarkDistrictRoofMaterial.js';
import { applyDarkDistrictMasonryUV } from './DarkDistrictMasonryMaterial.js';

// Decorative districts remain beyond the authoritative walking union. Local
// +Z faces the street; construction fits the former skyline's full envelope.
const HEIGHTS = Object.freeze({ shore: 20, archive: 20, foundry: 28, city: 42 });

function chamferedShell(width, height, depth, bevel = .65) {
    const w = width / 2, d = depth / 2, outline = new THREE.Shape();
    [[-w + bevel, -d], [w - bevel, -d], [w, -d + bevel], [w, d - bevel],
        [w - bevel, d], [-w + bevel, d], [-w, d - bevel], [-w, -d + bevel]]
        .forEach(([x, y], i) => i ? outline.lineTo(x, y) : outline.moveTo(x, y));
    outline.closePath();
    const geometry = new THREE.ExtrudeGeometry(outline, { depth: height, bevelEnabled: false, steps: 1 });
    geometry.rotateX(-Math.PI / 2);
    return geometry;
}

function hipRoof(width, depth, eave, ridge) {
    const w = width / 2, d = depth / 2;
    const points = [[-w, eave, -d], [w, eave, -d], [w, eave, d], [-w, eave, d],
        [-w + 6, ridge, 0], [w - 6, ridge, 0]];
    const positions = [], uvs = [];
    for (const face of [[0, 4, 5], [0, 5, 1], [1, 5, 2], [2, 5, 4], [2, 4, 3], [3, 4, 0], [0, 1, 2], [0, 2, 3]]) {
        positions.push(...face.flatMap(i => points[i]));
        const [a, b, c] = face.map(i => new THREE.Vector3(...points[i]));
        const normal = b.sub(a).cross(c.sub(a)).normalize();
        const end = Math.abs(normal.x) > Math.abs(normal.z);
        const scale = Math.hypot(1, (ridge - eave) / (end ? 6 : d));
        for (const i of face) {
            const [x, , z] = points[i];
            // Local slope distance gives every hip the same physical slate
            // scale. Tangents follow the outward face, with courses descending
            // from the ridge; side roofs never stretch a top-down projection.
            const u = normal.y < 0 ? x : end ? z * Math.sign(normal.x) : -x * Math.sign(normal.z);
            const v = normal.y < 0 ? z : (end ? Math.abs(x) - (w - 6) : Math.abs(z)) * scale;
            uvs.push(u / DARK_DISTRICT_ROOF_SPAN, v / DARK_DISTRICT_ROOF_SPAN);
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.computeVertexNormals();
    return geometry;
}

function arch(width, height, quality) {
    const path = new THREE.Shape();
    path.moveTo(-width / 2, 0); path.lineTo(width / 2, 0); path.lineTo(width / 2, height * .6);
    path.quadraticCurveTo(width * .48, height * .85, 0, height);
    path.quadraticCurveTo(-width * .48, height * .85, -width / 2, height * .6); path.closePath();
    // Low keeps the same pointed silhouette and every window, with fewer
    // subdivisions along the two curves instead of removing architectural parts.
    return path.extractPoints(quality === 'low' ? 1 : 3).shape;
}

function windowGeometry(quality, height) {
    const outline = arch(3.8, height, quality), shape = new THREE.Shape(outline);
    const hole = new THREE.Path(outline.map(p => new THREE.Vector2(p.x * .78, p.y * .86 + height * .07)));
    shape.holes.push(hole);
    const frame = new THREE.ExtrudeGeometry(shape, { depth: .32, bevelEnabled: false, steps: 1, curveSegments: 1 });
    const pane = new THREE.ExtrudeGeometry(new THREE.Shape(hole.getPoints(1)), { depth: .08, bevelEnabled: false, steps: 1 });
    pane.translate(0, 0, .06);
    return { frame, pane };
}

export function createDarkDistrictArchitectureGeometry(recipe, quality = 'high') {
    if (!(recipe in HEIGHTS)) throw new Error(`Unknown Dark Realm district: ${recipe}`);
    const height = HEIGHTS[recipe], batches = new Map();
    const add = (key, source, position = [0, 0, 0]) => {
        source.translate(...position); source.normalizeNormals();
        const geometry = source.index ? source.toNonIndexed() : source.clone(); source.dispose();
        if (!geometry.attributes.uv) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(geometry.attributes.position.count * 2, 2));
        if (key === 'stone') applyDarkDistrictMasonryUV(geometry);
        const parts = batches.get(key) || []; parts.push(geometry); batches.set(key, parts);
    };
    const box = (key, size, position) => add(key, new THREE.BoxGeometry(...size), position);
    // Stepped masonry, clipped corners and grounded buttresses break up the
    // former flat blocks. Nothing is an entrance, staircase or new walk floor.
    add('stone', chamferedShell(26, height, 22), [0, -2, 0]);
    box('stone', [28, .8, 24], [0, -1.6, 0]);
    for (const x of [-11.8, 11.8]) for (const z of [-11.3, 11.3]) {
        box('stone', [1.4, height - 1, 1.4], [x, (height - 1) / 2 - 2, z]);
    }
    const eave = height - 2, ridge = height + .25;
    // The closed roof sits directly on the wall top. A ridge replaces the
    // floating flat cap; its silhouette never exceeds the former roof bounds.
    add('roof', hipRoof(32, 28, eave, ridge));
    box('bronze', [26.5, .35, 22.5], [0, height - 2.2, 0]);
    for (const x of [-7, 7]) {
        const windowHeight = recipe === 'archive' ? 5 : 7;
        const bottom = recipe === 'archive' ? 11.4 : height * .65 - 3.5;
        const { frame, pane } = windowGeometry(quality, windowHeight);
        add('bronze', frame, [x, bottom, 11.02]); add('glow', pane, [x, bottom, 11.02]);
    }
    if (recipe === 'shore') {
        // Mooring spars emerge through the roof; their feet are embedded in
        // the masonry instead of hovering above it.
        add('bronze', new THREE.CylinderGeometry(.55, .8, 18, quality === 'low' ? 6 : 10), [0, 23, 0]);
        const spar = new THREE.CylinderGeometry(.65, .65, 16, quality === 'low' ? 6 : 10);
        spar.rotateX(Math.PI / 2); add('shadow', spar, [0, 30, 0]);
    } else if (recipe === 'archive') {
        for (const y of [5, 11, 17]) box('bronze', [30, .45, 26], [0, y, 0]);
    } else if (recipe === 'foundry') {
        // Real hollow flue, including a thick rim and closed annular foot.
        const points = [[3.8, 20], [3.15, 49.5], [2.55, 49.5], [3.05, 20], [3.8, 20]];
        add('shadow', new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), quality === 'low' ? 8 : 12), [0, 0, -5]);
        const path = [[-13, eave + (ridge - eave) / 2 + .15, 0], [-10, ridge + .15, 0],
            [10, ridge + .15, 0], [13, eave + (ridge - eave) / 2 + .15, 0]];
        for (let i = 1; i < path.length; i++) {
            const from = new THREE.Vector3(...path[i - 1]), to = new THREE.Vector3(...path[i]), delta = to.clone().sub(from);
            const channel = new THREE.BoxGeometry(delta.length(), .16, .4);
            channel.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), delta.normalize()));
            add('glow', channel, from.add(to).multiplyScalar(.5).toArray());
        }
    } else {
        // Crown piers continue into the building. The three old tips remain,
        // supported through the roof instead of floating above a flat slab.
        for (const z of [-8, 0, 8]) {
            add('bronze', chamferedShell(2.6, 11, 2.6, .35), [0, height - 4, z]);
            const tip = new THREE.ConeGeometry(1.8, 1.8, 4); tip.rotateY(Math.PI / 4);
            add('bronze', tip, [0, height + 7.9, z]);
        }
    }
    return Object.fromEntries([...batches].map(([key, parts]) => {
        const geometry = mergeGeometries(parts, false); parts.forEach(part => part.dispose());
        geometry.computeBoundingBox(); geometry.computeBoundingSphere(); return [key, geometry];
    }));
}
