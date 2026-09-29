import * as THREE from 'three';
import { EARTH_PATHS, distanceToPath } from '../data/worldPopulation.js';

const random = seed => ((Math.imul(seed + 91, 73856093) ^ Math.imul(seed + 7, 19349663)) >>> 0) / 4294967296;
const hash = text => [...text].reduce((value, char) => Math.imul(value, 31) + char.charCodeAt(0) | 0, 17);

// Low, non-blocking foliage; clearance includes the whole tuft, not its pivot.
export function earthGroundCoverPlacements(site, quality = 'high') {
    const seed = hash(site.id), placements = [], extent = 1.8;
    const patches = 9, tufts = quality === 'low' ? 4 : 7;
    const focusX = site.arrivalOffset?.[0] || 0;
    const focusZ = site.arrivalOffset?.[1] || 0;
    // The Bastion approach is a long grave road, not a circular clearing.
    // Compose connected edge beds beside the markers and the arrival space.
    // Low uses the same anchors and the first four tufts of each High patch.
    const graveBeds = [-1, 1].flatMap(side => [[side * 9.4, 45.5],
        [side * 16.8, 50], [side * 19, 57], [side * 26, 46]]);
    for (let patch = 0; patch < patches; patch++) {
        const angle = patch / patches * Math.PI * 2 + random(seed + patch) * .5;
        const radius = Math.min(18, site.radius) * (.5 + random(seed + patch * 11) * .35);
        if (site.recipe === 'grave-road' && patch >= graveBeds.length) continue;
        const [anchorX, anchorZ] = site.recipe === 'grave-road' ? graveBeds[patch]
            : [focusX + Math.cos(angle) * radius, focusZ + Math.sin(angle) * radius];
        for (let tuft = 0; tuft < tufts; tuft++) {
            const id = seed + patch * 173 + tuft * 31;
            const theta = random(id) * Math.PI * 2, spread = Math.sqrt(random(id + 3)) * 2.3;
            const x = anchorX + Math.cos(theta) * spread, z = anchorZ + Math.sin(theta) * spread;
            if (Math.hypot(x, z) + extent > site.radius) continue;
            if (site.role === 'story' && Math.hypot(x, z) < 10 + extent) continue;
            if (site.id === 'verdant-approach' && z - extent < 42) continue;
            if (site.recipe === 'grave-road' && [-12, 12].some(pierX => [46, 52, 58].some(pierZ =>
                Math.hypot(x - pierX, z - pierZ) < extent + 1.2))) continue;
            if (site.readingOffset && Math.hypot(x - site.readingOffset[0], z - site.readingOffset[1]) < 4 + extent) continue;
            if (EARTH_PATHS.some(path => distanceToPath(site.x + x, site.z + z, path.points) < path.width / 2 + 2 + extent)) continue;
            placements.push({ x, z, seed: id, radius: extent, rotation: theta });
        }
    }
    return placements;
}

// Curved tapered blades and folded fern leaves replace crossed flat triangles.
// Vertex tones distinguish shaded bases, midribs and tips in one material batch.
export function createEarthGroundCoverTuft(seed, quality = 'high') {
    const positions = [], colors = [], uvs = [];
    const fern = Math.abs(seed) % 3 === 0;
    const low = quality === 'low', count = fern ? (low ? 4 : 6) : (low ? 7 : 12);
    const base = new THREE.Color(0x263a25), tip = new THREE.Color(0x596e48);
    if (random(seed + 101) > .85) tip.setHex(0x7c7450);
    const triangle = (a, b, c, shade = 1) => {
        for (const [index, point] of [a, b, c].entries()) {
            positions.push(...point);
            const color = base.clone().lerp(tip, Math.min(1, .18 + point[1] * .65)).multiplyScalar(shade);
            colors.push(color.r, color.g, color.b); uvs.push(index === 1 ? 1 : 0, index === 2 ? 1 : 0);
        }
    };
    for (let blade = 0; blade < count; blade++) {
        const angle = blade / count * Math.PI * 2 + random(seed + blade * 7) * .6;
        const dx = Math.cos(angle), dz = Math.sin(angle), sx = -dz, sz = dx;
        const height = .65 + random(seed + blade * 13) * .65;
        const reach = fern ? .9 + random(seed + blade * 17) * .55 : .35 + random(seed + blade * 17) * .5;
        const curve = t => [dx * reach * t * t, fern ? Math.sin(t * Math.PI * .78) * height : height * t - .28 * t * t, dz * reach * t * t];
        const segments = low ? 3 : 5;
        for (let segment = 0; segment < segments; segment++) {
            const t = segment / segments, next = (segment + 1) / segments;
            const a = curve(t), b = curve(next);
            const widthA = fern ? .024 * (1 - t) : .11 * (1 - t);
            const widthB = fern ? .024 * (1 - next) : .11 * (1 - next);
            const offset = (point, width) => [point[0] + sx * width, point[1], point[2] + sz * width];
            triangle(offset(a, -widthA), offset(a, widthA), offset(b, -widthB));
            if (widthB > 0) triangle(offset(a, widthA), offset(b, widthB), offset(b, -widthB));
        }
        if (!fern) continue;
        for (let leaf = 1; leaf <= (low ? 4 : 6); leaf++) {
            const t = leaf / (low ? 5 : 7), origin = curve(t);
            for (const side of [-1, 1]) {
                const length = Math.sin(t * Math.PI) * .42;
                const end = [origin[0] + sx * side * length + dx * .18, origin[1] + .035,
                    origin[2] + sz * side * length + dz * .18];
                const mid = origin.map((value, axis) => (value + end[axis]) * .5);
                const left = [mid[0] - dx * .1, mid[1] - .035, mid[2] - dz * .1];
                const right = [mid[0] + dx * .1, mid[1] - .035, mid[2] + dz * .1];
                mid[1] += .04;
                if (low) { triangle(origin, left, end); triangle(origin, end, right, .88); }
                else {
                    triangle(origin, left, mid); triangle(left, end, mid);
                    triangle(origin, mid, right, .88); triangle(mid, end, right, .88);
                }
            }
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.computeVertexNormals(); geometry.computeBoundingSphere();
    return geometry;
}
