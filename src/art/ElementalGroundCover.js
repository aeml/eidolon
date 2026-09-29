import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WATER_PATHS, FIRE_PATHS } from '../data/elementalPopulation.js';
import { distanceToPath } from '../data/worldPopulation.js';
import { FOLIAGE_HAZARD_CLEARINGS } from '../data/worldFoliage.js';
import { WORLD_REGIONS } from '../data/worldGeography.js';

const random = seed => {
    let n = Math.imul(seed + 139, 1597334677);
    n = Math.imul(n ^ n >>> 16, 2246822519);
    return ((n ^ n >>> 13) >>> 0) / 4294967296;
};
const hash = text => [...text].reduce((n, c) => Math.imul(n, 31) + c.charCodeAt(0) | 0, 17);

function bedsFor(site) {
    if (site.recipe === 'boat-grave') return [[[-17, -12], [-17, -1], [-11, 9]], [[16, -5], [19, 7], [10, 15]]];
    if (site.recipe === 'tide-procession') return [[[-21, 40], [-22, 51], [-19, 62]], [[21, 40], [22, 51], [19, 62]]];
    if (site.recipe === 'furnace-procession') return [[[42, -21], [53, -23], [63, -19]], [[42, 21], [53, 23], [63, 19]]];
    const edge = Math.min(20, site.radius * .79);
    // Broken side/rear beds leave the arrival and central gathering space open.
    // Different reaches avoid putting every location inside the same wreath.
    return [[[-edge, edge * .45], [-edge * .92, -edge * .3], [-edge * .65, -edge * .75]],
        [[edge, edge * .7], [edge * .85, -edge * .2], [edge * .65, -edge * .75]],
        [[-edge * .65, -edge * .75], [0, -edge * .95], [edge * .65, -edge * .75]]];
}

export function elementalGroundCoverPlacements(site, realm, footprints = [], quality = 'high') {
    if (!['water', 'fire'].includes(realm)) throw new TypeError(`Unsupported cover realm: ${realm}`);
    const seed = hash(site.id), paths = realm === 'water' ? WATER_PATHS : FIRE_PATHS;
    const region = WORLD_REGIONS[realm], placements = [], radius = 1.35;
    const ownSolids = footprints.filter(f => f.siteId === site.id);
    const clear = (x, z) => {
        const wx = site.x + x, wz = site.z + z;
        if (Math.hypot(x, z) + radius > site.radius) return false;
        if (wx - radius < region.minX || wx + radius > region.maxX || wz - radius < region.minZ || wz + radius > region.maxZ) return false;
        if (site.role === 'story' && Math.hypot(x, z) < 10 + radius) return false;
        if (site.readingOffset && Math.hypot(x - site.readingOffset[0], z - site.readingOffset[1]) < 4 + radius) return false;
        if (realm === 'water' ? Math.abs(wx) < 8 + radius : Math.abs(wz - 200) < 8 + radius) return false;
        if (paths.some(path => distanceToPath(wx, wz, path.points) < path.width / 2 + 2 + radius)) return false;
        if (FOLIAGE_HAZARD_CLEARINGS[realm].some(([hx, hz, r]) => Math.hypot(wx - hx, wz - hz) < r + 8 + radius)) return false;
        if (ownSolids.some(f => Math.hypot(Math.max(0, Math.abs(wx - f.x) - f.width / 2),
            Math.max(0, Math.abs(wz - f.z) - f.depth / 2)) < radius + .45)) return false;
        return true;
    };
    bedsFor(site).forEach((bed, bedIndex) => {
        const phase = random(seed + bedIndex * 79) * Math.PI * 2;
        for (let segment = 1; segment < bed.length; segment++) {
            const a = bed[segment - 1], b = bed[segment], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
            const steps = Math.ceil(length / 1.15), dx = (b[0] - a[0]) / length, dz = (b[1] - a[1]) / length;
            for (let step = 0; step < steps; step++) for (let tuft = 0; tuft < 4; tuft++) {
                const id = seed + bedIndex * 2347 + segment * 271 + step * 17 + tuft * 53;
                if (quality === 'low' && random(id + 201) > .55) continue;
                const t = (step + random(id)) / steps;
                const pocket = .5 + .5 * Math.sin(t * 9 + phase + segment * 2);
                if (random(id + 13) > .25 + pocket * .75) continue;
                const spread = Math.sin(t * 5 + phase) * 1.8 +
                    (random(id + 4) - .5) * (1.3 + pocket * 5.4);
                const x = a[0] + (b[0] - a[0]) * t - dz * spread;
                const z = a[1] + (b[1] - a[1]) * t + dx * spread;
                if (!clear(x, z)) continue;
                placements.push({ x, z, radius, rotation: -.65 + random(id + 5) * 1.3,
                    scale: .8 + random(id + 7) * .35, variant: Math.floor(random(id + 11) * 4) });
            }
        }
    });
    return placements;
}

export function createElementalCoverTuft(realm, variant, quality = 'high') {
    const positions = [], colors = [];
    const water = realm === 'water', low = quality === 'low';
    const blades = low ? 5 : 9, segments = low ? 3 : 5;
    const base = new THREE.Color(water ? 0x344d48 : 0x3b352b);
    const tip = new THREE.Color(water ? (variant % 2 ? 0x81948c : 0x9c9980) : (variant % 2 ? 0x877959 : 0x6e6b55));
    const triangle = (a, b, c, shade) => {
        for (const point of [a, b, c]) {
            positions.push(...point);
            const color = base.clone().lerp(tip, Math.min(1, .12 + point[1] * .85)).multiplyScalar(shade);
            colors.push(color.r, color.g, color.b);
        }
    };
    for (let blade = 0; blade < blades; blade++) {
        const seed = variant * 97 + blade * 13, angle = random(seed) * Math.PI * 2;
        const dx = Math.cos(angle), dz = Math.sin(angle), sx = -dz, sz = dx;
        const height = (water ? .58 : .35) + random(seed + 1) * .4;
        const reach = .25 + random(seed + 2) * .42;
        const curve = t => [dx * reach * t * t + .15 * t, height * t - .1 * t * t, dz * reach * t * t];
        for (let segment = 0; segment < segments; segment++) {
            const t = segment / segments, next = (segment + 1) / segments, a = curve(t), b = curve(next);
            const width = water ? .13 : .16;
            const edge = (p, w) => [p[0] + sx * w, Math.max(0, p[1] - Math.abs(w) * .28), p[2] + sz * w];
            const wa = width * (1 - t), wb = width * (1 - next);
            triangle(edge(a, -wa), a, edge(b, -wb), 1);
            if (wb > 0) triangle(a, b, edge(b, -wb), 1);
            triangle(a, edge(a, wa), b, .81);
            if (wb > 0) triangle(edge(a, wa), edge(b, wb), b, .81);
        }
        if (water && blade % 3 === 0) {
            // Small dry seed heads distinguish reeds from the Fire grass.
            const a = curve(.76), b = curve(.98), middle = a.map((v, i) => (v + b[i]) * .5);
            triangle(a, [middle[0] - .065, middle[1], middle[2]], b, .86);
            triangle(a, b, [middle[0] + .065, middle[1], middle[2]], .86);
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
}

export function createElementalGroundCover(site, realm, footprints, material, quality = 'high') {
    const plants = elementalGroundCoverPlacements(site, realm, footprints, quality);
    if (!plants.length) return null;
    const variants = Array.from({ length: 4 }, (_, i) => createElementalCoverTuft(realm, i, quality));
    const parts = plants.map(plant => {
        const geometry = variants[plant.variant].clone();
        geometry.scale(plant.scale, plant.scale, plant.scale); geometry.rotateY(plant.rotation);
        geometry.translate(plant.x, .015, plant.z); return geometry;
    });
    const geometry = mergeGeometries(parts, false);
    [...parts, ...variants].forEach(g => g.dispose());
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material); mesh.name = `${site.id}:ground-cover`;
    mesh.receiveShadow = true; mesh.castShadow = false;
    mesh.userData.plantCount = plants.length;
    return mesh;
}
