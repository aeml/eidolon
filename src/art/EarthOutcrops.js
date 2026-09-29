import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EARTH_OUTCROP_FORMATIONS, EARTH_OUTCROP_SOLIDS, EARTH_OUTCROP_OUTLINE as outline } from '../data/earthOutcrops.js';
import { applyWorldSurfaceDetail } from './WorldSurfaceDetail.js';

const random = seed => ((Math.imul(seed + 71, 73856093) ^ Math.imul(seed + 13, 19349663)) >>> 0) / 4294967296;

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
    // Break long faces with a displaced midpoint, retaining the exact buried
    // collision footprint. Alternating recesses and lips produce real strata
    // and cast shadows, rather than a tapered stack with a pyramidal crown.
    const contour = outline.flatMap(([x, z], side) => {
        const next = outline[(side + 1) % outline.length];
        const split = .35 + random(solid.seed + side * 47) * .3;
        return [[x, z], [x + (next[0] - x) * split, z + (next[1] - z) * split]];
    });
    const layers = [[0, 1], [.27, .94], [.30, .79], [.61, .86], [.65, .72], [.94, .78], [1, .66]];
    const rings = layers.map(([level, width], tier) => contour.map(([x, z], side) => {
        const weathering = (random(solid.seed + side * 31) - .5) * .10;
        // Fractures peter out around the stone; don't turn every layer into a
        // complete, evenly inset stair encircling the whole formation.
        const intact = tier === 2 || tier === 4 ? Math.max(0, Math.sin(side * .57 + solid.seed)) * .12 : 0;
        const erosion = tier ? Math.min(.985, width + intact + weathering + Math.sin(side * 1.7 + tier) * .025) : 1;
        const tilt = ((x * .065 - z * .04) * erosion + Math.sin(side * 1.9 + solid.seed) * .025 * (1 - level)) * level * solid.height;
        return [solid.x + x * solid.width / 2 * erosion,
            tier ? ground + level * solid.height + tilt : minimum - .8,
            solid.z + z * solid.depth / 2 * erosion];
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
        color: 0x62675e, vertexColors: true, roughness: .95
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
