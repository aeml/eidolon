import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EARTH_OUTCROP_FORMATIONS, EARTH_OUTCROP_SOLIDS, EARTH_OUTCROP_OUTLINE as outline } from '../data/earthOutcrops.js';
import { applyWorldSurfaceDetail } from './WorldSurfaceDetail.js';

const random = seed => ((Math.imul(seed + 71, 73856093) ^ Math.imul(seed + 13, 19349663)) >>> 0) / 4294967296;

// Weathered shoulders share lighting across gentle joins, not across sharp
// geological cleaves. Only normals change; the buried solid, silhouettes,
// triangulation and collision footprints retain their exact authored recipe.
function smoothShoulderNormals(positions, normals) {
    const original = normals.slice(), vertices = new Map(), crease = Math.cos(Math.PI / 4);
    for (let i = 0; i < positions.length; i += 3) {
        const key = `${positions[i]},${positions[i + 1]},${positions[i + 2]}`;
        if (!vertices.has(key)) vertices.set(key, []);
        vertices.get(key).push(i);
    }
    const sum = new THREE.Vector3();
    for (const indices of vertices.values()) for (const i of indices) {
        sum.set(0, 0, 0);
        for (const j of indices) {
            if (original[i] * original[j] + original[i + 1] * original[j + 1] +
                original[i + 2] * original[j + 2] >= crease) {
                sum.x += original[j]; sum.y += original[j + 1]; sum.z += original[j + 2];
            }
        }
        sum.normalize();
        normals[i] = sum.x; normals[i + 1] = sum.y; normals[i + 2] = sum.z;
    }
}

export function createEarthOutcropGeometry(solid, terrain = null) {
    const positions = [], colors = [], uv = [], normals = [];
    const ground = terrain?.sample(solid.x, solid.z) ?? 0;
    // A buried foundation spans the entire footprint, including intervening
    // terrain vertices. Do not leave a flat-bottomed boulder floating uphill.
    let minimum = ground;
    for (let x = -solid.width / 2; x <= solid.width / 2; x += 2) {
        for (let z = -solid.depth / 2; z <= solid.depth / 2; z += 2) {
            minimum = Math.min(minimum, terrain?.sample(solid.x + x, solid.z + z) ?? 0);
        }
    }
    // Break long faces with displaced midpoints, retaining the exact buried
    // collision footprint. An eroded shoulder and broad cleaved crown avoid
    // both a pointed pyramid and repeated horizontal slab shelves.
    const contour = outline.flatMap(([x, z], side) => {
        const next = outline[(side + 1) % outline.length];
        const split = .35 + random(solid.seed + side * 47) * .3;
        return [[x, z], [x + (next[0] - x) * split, z + (next[1] - z) * split]];
    });
    // A formation leans toward its own cleave rather than repeating a centred
    // rounded loaf. Every point is a convex blend of the original perimeter
    // and an interior anchor, so the server-owned solid never grows outward.
    const leanX = (random(solid.seed + 401) - .5) * .72;
    const leanZ = (random(solid.seed + 607) - .5) * .72;
    const pitchX = (random(solid.seed + 809) - .5) * .34;
    const pitchZ = (random(solid.seed + 1013) - .5) * .34;
    const fractureSide = Math.floor(random(solid.seed + 1297) * outline.length);
    const layers = [[0, 1], [.22, .98], [.40, .94], [.60, .86], [.78, .70], [.93, .49], [1, .32]];
    const rings = layers.map(([level, width], tier) => contour.map(([x, z], side) => {
        const weathering = (random(solid.seed + side * 31) - .5) * .10;
        const cleave = Math.sin(side * .71 + solid.seed) * Math.sin(level * Math.PI) * .13;
        // A single seeded cleft breaks the broad rectangular shoulder. It
        // follows one edge through the upper rings, rather than putting the
        // same sawtooth notch in every side. Keep the buried/base rings exact;
        // the upper silhouette stays inside the original collision perimeter.
        const edge = Math.floor(side / 2);
        const splitCleft = side % 2 && edge === fractureSide
            ? .05 * Math.max(0, (level - .22) / .78) : 0;
        // Broad correlated crown weathering gives each formation its own
        // shoulder widths. Do not add a centre spike or change the cap plane.
        const shoulderWear = tier > 1 ? (random(solid.seed + edge * 97 + 1511) - .5) *
            .13 * Math.sin(level * Math.PI / 2) : 0;
        const erosion = tier ? Math.min(.985, width + cleave + weathering + shoulderWear - splitCleft) : 1;
        const px = x * erosion + leanX * (1 - erosion);
        const pz = z * erosion + leanZ * (1 - erosion);
        // Correlated shoulder fractures avoid uniform stacked contour bands.
        // The last two rings remain planar; no noisy central cap or spikes.
        const bedding = tier < 5 ? Math.sin(side * .71 + solid.seed) * Math.sin(level * Math.PI) * .07 : 0;
        const tilt = (px * pitchX + pz * pitchZ) * level;
        return [solid.x + px * solid.width / 2,
            tier ? ground + (level + bedding + tilt) * solid.height : minimum - .8,
            solid.z + pz * solid.depth / 2];
    }));
    const faceNormal = (a, b, c) => new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    const addFace = (a, b, c, normal = faceNormal(a, b, c)) => {
        for (const point of [a, b, c]) {
            positions.push(point.x, point.y, point.z); uv.push(point.x * .1, point.z * .1);
            normals.push(normal.x, normal.y, normal.z);
            const up = Math.max(0, normal.y);
            const moss = up * Math.max(0, Math.sin(point.x * .47 + point.z * .39)) * .3;
            const wet = Math.max(0, 1 - (point.y - ground) / 1.3) * .22;
            // Continuous mineral coloration avoids artificial triangle patches.
            const tone = .86 + Math.sin(point.x * .29 + point.z * .17 + solid.seed) * .075;
            colors.push(tone * (1 - wet - moss * .6), tone * (1 - wet * .7 - moss * .2),
                tone * (1 - wet - moss));
        }
    };
    const point = array => new THREE.Vector3(...array);
    for (let tier = 0; tier < rings.length - 1; tier++) for (let side = 0; side < contour.length; side++) {
        const next = (side + 1) % contour.length;
        const a = point(rings[tier][side]), b = point(rings[tier][next]);
        const c = point(rings[tier + 1][side]), d = point(rings[tier + 1][next]);
        // A cleaved face has one lighting plane, not a visible diagonal through
        // every quad. Keep sharp changes between ledges and adjoining faces.
        const normal = faceNormal(a, c, b).add(faceNormal(b, c, d)).normalize();
        addFace(a, c, b, normal);
        addFace(b, c, d, normal);
    }
    smoothShoulderNormals(positions, normals);
    // The broad cleaved crown keeps its independent planar lighting.
    const top = rings.at(-1);
    const cap = THREE.ShapeUtils.triangulateShape(top.map(([x, , z]) => new THREE.Vector2(x, z)), []);
    for (const [a, b, c] of cap) {
        addFace(point(top[a]), point(top[c]), point(top[b]));
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
}

// Candidate factory owns its geometry/material. Preview and subsequent world
// integration consume the same solids; quality never changes their silhouette.
export function createEarthOutcrops({ terrainElevation = null } = {}) {
    const root = new THREE.Group(); root.name = 'Earth exposed rock shelves';
    const material = applyWorldSurfaceDetail(new THREE.MeshStandardMaterial({
        color: 0x646b6c, vertexColors: true, roughness: .95
    }), 'stratified-rock');
    root.userData.walkFootprints = [];
    for (const formation of EARTH_OUTCROP_FORMATIONS) {
        const parts = EARTH_OUTCROP_SOLIDS.filter(s => s.formationId === formation.id).map(solid => {
            const geometry = createEarthOutcropGeometry(solid, terrainElevation);
            const bounds = geometry.boundingBox, y = (bounds.min.y + bounds.max.y) / 2;
            root.userData.walkFootprints.push({ siteId: `rock:${solid.id}`, x: solid.x, z: solid.z,
                width: solid.width, depth: solid.depth, y, height: bounds.max.y - bounds.min.y, angle: 0 });
            return geometry;
        });
        const geometry = mergeGeometries(parts, false);
        parts.forEach(part => part.dispose());
        geometry.computeBoundingBox(); geometry.computeBoundingSphere();
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = formation.id; mesh.castShadow = true; mesh.receiveShadow = true;
        root.add(mesh);
    }
    return root;
}
