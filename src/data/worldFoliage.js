export const PROCEDURAL_FOLIAGE_RECIPES = Object.freeze([
    // Detailed opaque leaves need spatial culling, not a realm-wide draw batch.
    Object.freeze({ id: 'ossuary_birch', region: 'earth', theme: 'pale ossuary birch', count: 120, bounds: [-950, 950, -550, 950], scale: [0.88, 1.28], collision: [0.72, 8.2], renderCellSize: 64 }),
    Object.freeze({ id: 'grave_pine', region: 'earth', theme: 'black grave pine', count: 115, bounds: [-950, 950, -550, 950], scale: [0.9, 1.3], collision: [0.78, 8.5], renderCellSize: 64 }),
    Object.freeze({ id: 'mourning_willow', region: 'earth', theme: 'votive mourning willow', count: 95, bounds: [-950, 950, -550, 950], scale: [0.88, 1.22], collision: [0.82, 7.2], renderCellSize: 64 }),
    // Only Gloamwood retains tree collision because it is the one realm whose
    // authored trees already shaped navigation. New regional dressing stays
    // visual-only so this art migration cannot silently change combat paths.
    Object.freeze({ id: 'rime_pine', region: 'water', theme: 'moonfrost rime pine', count: 100, bounds: [-950, 950, -2150, -650], scale: [0.88, 1.25], collision: null }),
    Object.freeze({ id: 'drowned_willow', region: 'water', theme: 'drowned silver willow', count: 80, bounds: [-950, 950, -2150, -650], scale: [0.86, 1.18], collision: null }),
    Object.freeze({ id: 'ember_snag', region: 'fire', theme: 'ember-lit corpsewood', count: 90, bounds: [-2950, -1050, -550, 950], scale: [0.9, 1.28], collision: null }),
    Object.freeze({ id: 'basalt_briar', region: 'fire', theme: 'magma-hearted basalt briar', count: 75, bounds: [-2950, -1050, -550, 950], scale: [0.8, 1.18], collision: null }),
    Object.freeze({ id: 'gale_cypress', region: 'air', theme: 'wind-bent gale cypress', count: 90, bounds: [1050, 2950, -550, 950], scale: [0.9, 1.26], collision: null }),
    Object.freeze({ id: 'storm_crystal', region: 'air', theme: 'captive storm crystal', count: 75, bounds: [1050, 2950, -550, 950], scale: [0.8, 1.18], collision: null })
]);

// Mirrors the authoritative permanent hazard anchors. Dressing stays outside
// the gameplay radius plus an eight-unit readability apron.
export const FOLIAGE_HAZARD_CLEARINGS = Object.freeze({
    earth: Object.freeze([
        [-800, -450, 10], [-650, -350, 8], [800, -450, 10], [650, -350, 8],
        [-800, 850, 9], [-600, 750, 7], [800, 850, 9], [600, 750, 7],
        [-900, 500, 8], [-850, -200, 7], [900, 500, 8], [850, -200, 7]
    ]),
    water: Object.freeze([
        [-50, -750, 7], [100, -850, 6], [-150, -700, 5], [0, -1000, 8],
        [200, -1150, 7], [-200, -1100, 6], [50, -1300, 8], [-100, -1550, 9],
        [150, -1650, 8], [-50, -1750, 7], [250, -1500, 6], [0, -1950, 10],
        [-200, -2050, 9], [200, -2100, 8], [100, -1900, 7]
    ]),
    fire: Object.freeze([
        [-1150, 100, 6], [-1250, 350, 7], [-1350, -100, 5], [-1550, 200, 8],
        [-1650, 500, 6], [-1500, -300, 7], [-1750, 0, 6], [-1950, 300, 9],
        [-2050, -200, 7], [-2100, 600, 8], [-1900, -400, 6], [-2350, 150, 8],
        [-2450, 400, 9], [-2300, -300, 7], [-2550, 700, 8], [-2750, 200, 10],
        [-2850, 500, 9], [-2700, -100, 8], [-2950, 350, 10]
    ]),
    air: Object.freeze([
        [1150, 100, 6], [1250, 350, 7], [1350, -100, 5], [1550, 200, 8],
        [1650, 500, 6], [1500, -300, 7], [1750, 0, 6], [1950, 300, 9],
        [2050, -200, 7], [2100, 600, 8], [1900, -400, 6], [2350, 150, 8],
        [2450, 400, 9], [2300, -300, 7], [2550, 700, 8], [2750, 200, 10],
        [2850, 500, 9], [2700, -100, 8], [2950, 350, 10]
    ])
});

const LANDMARK_CLEARINGS = Object.freeze({
    earth: Object.freeze([[0, 200, 165], [800, 200, 64]]),
    water: Object.freeze([[0, -1400, 72]]),
    fire: Object.freeze([[-2400, 200, 72]]),
    air: Object.freeze([[2400, 200, 72]])
});

function hashSeed(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function randomGenerator(seed) {
    let state = seed >>> 0;
    return () => {
        state += 0x6d2b79f5;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

export function isProceduralFoliagePlacementClear(region, x, z) {
    const sites = region === 'earth' ? EARTH_LOCATIONS : region === 'water' ? WATER_LOCATIONS : region === 'fire' ? FIRE_LOCATIONS : region === 'air' ? AIR_LOCATIONS : [];
    const paths = region === 'earth' ? EARTH_PATHS : region === 'water' ? WATER_PATHS : region === 'fire' ? FIRE_PATHS : region === 'air' ? AIR_PATHS : [];
    if (sites.some(site => Math.hypot(x - site.x, z - site.z) <= (region === 'earth'
        ? (site.id === 'first-grove-arch' ? 18 : site.radius + 3) : site.radius + 8))) return false;
    if (paths.some(path => distanceToPath(x, z, path.points) <= path.width / 2 + 8)) return false;
    for (const [clearX, clearZ, radius] of FOLIAGE_HAZARD_CLEARINGS[region] || []) {
        if (Math.hypot(x - clearX, z - clearZ) <= radius + 8) return false;
    }
    for (const [clearX, clearZ, radius] of LANDMARK_CLEARINGS[region] || []) {
        if (Math.hypot(x - clearX, z - clearZ) <= radius) return false;
    }

    // Preserve the four cardinal realm roads and their gateway sightlines.
    if (region === 'earth') {
        if (Math.abs(x) < 14 && (z < 110 || z > 290)) return false;
        if (Math.abs(z - 200) < 14 && Math.abs(x) > 90) return false;
    }
    if (region === 'water' && Math.abs(x) < 42) return false;
    if ((region === 'fire' || region === 'air') && Math.abs(z - 200) < 42) return false;
    return true;
}

// Composed stands, with open intervals between them, rather than increasing
// tree count across the entire realm. The first pair frames the grove approach.
const EARTH_WOODLAND_STANDS = Object.freeze([
    [-24, -265, 10], [24, -267, 10], [-24, -236, 11], [26, -237, 11],
    [-37, -50, 22], [38, -100, 24], [-45, -435, 24], [46, -480, 22],
    [-260, 172, 22], [-500, 235, 25], [-740, 174, 25],
    [310, 170, 21], [455, 233, 20], [660, 170, 20], [686, 245, 20],
    [-160, 462, 18], [-455, 565, 20], [-355, -211, 18],
    [550, 471, 17], [-34, 640, 22], [40, 820, 24]
]);
let earthPlacements;

function createEarthWoodlandPlacements() {
    const recipes = PROCEDURAL_FOLIAGE_RECIPES.filter(value => value.region === 'earth');
    const result = new Map(recipes.map(recipe => [recipe.id, []])), occupied = [];
    const streams = new Map(recipes.map(recipe => [recipe.id, randomGenerator(hashSeed(`eidolon:woodland:${recipe.id}`))]));
    // Reserve each species' grove framing before filling the rest of the realm;
    // otherwise the first species can consume the later species' clear spaces.
    for (const quota of [6, Infinity]) for (const recipe of recipes) {
        const random = streams.get(recipe.id);
        const placements = result.get(recipe.id), [minX, maxX, minZ, maxZ] = recipe.bounds;
        const target = Math.min(quota, recipe.count);
        for (let attempt = 0; placements.length < target && attempt < recipe.count * 100; attempt++) {
            let x, z;
            if (placements.length < 6 || random() < .8) {
                const stand = EARTH_WOODLAND_STANDS[Math.floor(random() * (placements.length < 6 ? 4 : EARTH_WOODLAND_STANDS.length))];
                const angle = random() * Math.PI * 2, radius = Math.sqrt(random()) * stand[2];
                x = stand[0] + Math.cos(angle) * radius; z = stand[1] + Math.sin(angle) * radius;
            } else {
                x = minX + random() * (maxX - minX); z = minZ + random() * (maxZ - minZ);
            }
            if (x < minX || x > maxX || z < minZ || z > maxZ || !isProceduralFoliagePlacementClear('earth', x, z)) continue;
            // Cross-species trunk clearance: avoid a new impenetrable hedge.
            if (occupied.some(tree => Math.hypot(tree.x - x, tree.z - z) < 7)) continue;
            const placement = Object.freeze({ x, z, rotation: random() * Math.PI * 2,
                scale: recipe.scale[0] + random() * (recipe.scale[1] - recipe.scale[0]) });
            placements.push(placement); occupied.push(placement);
        }
        if (placements.length !== target) throw new Error(`Unable to compose woodland: ${recipe.id} (${placements.length}/${target})`);
    }
    result.forEach(Object.freeze);
    return result;
}

export function createProceduralFoliagePlacements(recipe) {
    if (recipe.region === 'earth' && PROCEDURAL_FOLIAGE_RECIPES.includes(recipe)) {
        earthPlacements ??= createEarthWoodlandPlacements();
        return earthPlacements.get(recipe.id);
    }
    const random = randomGenerator(hashSeed(`eidolon:${recipe.region}:${recipe.id}`));
    const [minX, maxX, minZ, maxZ] = recipe.bounds;
    const placements = [];
    const maxAttempts = recipe.count * 80;
    for (let attempt = 0; placements.length < recipe.count && attempt < maxAttempts; attempt += 1) {
        const x = minX + random() * (maxX - minX);
        const z = minZ + random() * (maxZ - minZ);
        if (!isProceduralFoliagePlacementClear(recipe.region, x, z)) continue;
        placements.push(Object.freeze({
            x,
            z,
            rotation: random() * Math.PI * 2,
            scale: recipe.scale[0] + random() * (recipe.scale[1] - recipe.scale[0])
        }));
    }
    if (placements.length !== recipe.count) {
        throw new Error(`Unable to place ${recipe.id}: ${placements.length}/${recipe.count}`);
    }
    return placements;
}
import { WATER_LOCATIONS, FIRE_LOCATIONS, AIR_LOCATIONS, WATER_PATHS, FIRE_PATHS, AIR_PATHS } from './elementalPopulation.js';
import { EARTH_LOCATIONS, EARTH_PATHS, distanceToPath } from './worldPopulation.js';
