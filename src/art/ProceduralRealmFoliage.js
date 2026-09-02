import * as THREE from 'three';
import { getRegionTheme } from './darkFantasyTheme.js';

const GEOMETRIES = new Map();
const MATERIALS = new Map();
const ARCHETYPES = new Map();

const geometry = (key, create) => {
    if (!GEOMETRIES.has(key)) {
        const value = create();
        value.computeBoundingBox();
        value.computeBoundingSphere();
        GEOMETRIES.set(key, value);
    }
    return GEOMETRIES.get(key);
};

const material = (key, color, options = {}) => {
    if (!MATERIALS.has(key)) {
        MATERIALS.set(key, new THREE.MeshStandardMaterial({
            color,
            roughness: options.roughness ?? 0.92,
            metalness: options.metalness ?? 0,
            emissive: options.emissive ?? 0x000000,
            emissiveIntensity: options.emissiveIntensity ?? 0,
            flatShading: true,
            side: options.side ?? THREE.FrontSide
        }));
    }
    return MATERIALS.get(key);
};

function part(name, geometryValue, materialValue, {
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = [1, 1, 1],
    castShadow = true,
    receiveShadow = true
} = {}) {
    const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation));
    const matrix = new THREE.Matrix4().compose(
        new THREE.Vector3(...position),
        quaternion,
        new THREE.Vector3(...scale)
    );
    return Object.freeze({ name, geometry: geometryValue, material: materialValue, matrix, castShadow, receiveShadow });
}

const trunk = geometry('foliage-trunk', () => new THREE.CylinderGeometry(0.28, 0.48, 5.4, 7));
const narrowTrunk = geometry('foliage-narrow-trunk', () => new THREE.CylinderGeometry(0.16, 0.32, 6.2, 7));
const branch = geometry('foliage-branch', () => new THREE.CylinderGeometry(0.08, 0.18, 2.8, 6));
const broadCrown = geometry('foliage-broad-crown', () => new THREE.DodecahedronGeometry(1.55, 0));
const pineCrown = geometry('foliage-pine-crown', () => new THREE.ConeGeometry(1.7, 3.4, 7));
const curtain = geometry('foliage-curtain', () => new THREE.ConeGeometry(0.58, 3.5, 6, 1, true));
const shard = geometry('foliage-shard', () => new THREE.ConeGeometry(0.34, 2.2, 5));
const crystal = geometry('foliage-crystal', () => new THREE.OctahedronGeometry(0.7, 0));
const root = geometry('foliage-root', () => new THREE.ConeGeometry(0.2, 1.9, 5));
const lantern = geometry('foliage-lantern', () => new THREE.OctahedronGeometry(0.2, 0));

function palette(region) {
    return getRegionTheme(region).palette;
}

function createOssuaryBirch() {
    const p = palette('earth');
    const bark = material('foliage-birch-bark', 0x8d8977);
    const scar = material('foliage-birch-scar', p.shadow);
    const leaf = material('foliage-gloam-leaf', 0x34432f, { side: THREE.DoubleSide });
    const glow = material('foliage-grave-lantern', p.accent, { emissive: p.accent, emissiveIntensity: 0.72, roughness: 0.5 });
    return [
        part('pale scarred trunk', narrowTrunk, bark, { position: [0, 3.1, 0], rotation: [0, 0, -0.06] }),
        part('black bark seam', narrowTrunk, scar, { position: [0.12, 3.35, 0.08], rotation: [0, 0, -0.09], scale: [0.18, 0.92, 0.16] }),
        part('west grave bough', branch, bark, { position: [-0.72, 5.2, 0], rotation: [0, 0, -0.72] }),
        part('east grave bough', branch, bark, { position: [0.68, 4.68, 0.16], rotation: [0.12, 0, 0.82], scale: [0.88, 0.88, 0.88] }),
        part('faceted crown', broadCrown, leaf, { position: [-0.25, 6.55, 0], scale: [1.25, 0.82, 1.08] }),
        part('low gloam crown', broadCrown, leaf, { position: [0.78, 5.62, 0.08], scale: [0.8, 0.58, 0.74] }),
        part('grave lantern fruit', lantern, glow, { position: [-0.98, 4.75, 0.15], castShadow: false })
    ];
}

function createGravePine() {
    const p = palette('earth');
    const bark = material('foliage-black-pine-bark', 0x262822);
    const leaf = material('foliage-black-pine-needle', 0x26352d, { side: THREE.DoubleSide });
    const moss = material('foliage-pine-moss', p.midtone);
    return [
        part('black pine trunk', trunk, bark, { position: [0, 2.7, 0], scale: [0.76, 1.12, 0.76] }),
        part('lower funeral tier', pineCrown, leaf, { position: [0, 3.6, 0], scale: [1.15, 0.8, 1.15] }),
        part('middle funeral tier', pineCrown, leaf, { position: [0, 5.35, 0], scale: [0.86, 0.7, 0.86] }),
        part('high funeral tier', pineCrown, leaf, { position: [0, 6.75, 0], scale: [0.58, 0.55, 0.58] }),
        part('mossbound root', root, moss, { position: [-0.48, 0.25, 0.05], rotation: [0, 0, Math.PI / 2], scale: [0.8, 0.65, 0.8] })
    ];
}

function createMourningWillow() {
    const p = palette('earth');
    const bark = material('foliage-willow-bark', 0x403a31);
    const leaf = material('foliage-willow-leaf', 0x3f4c37, { side: THREE.DoubleSide });
    const glow = material('foliage-willow-votive', p.spirit, { emissive: p.spirit, emissiveIntensity: 0.5 });
    return [
        part('crooked mourning trunk', trunk, bark, { position: [0.2, 2.5, 0], rotation: [0, 0, -0.16], scale: [0.92, 0.94, 0.92] }),
        part('mourning crown', broadCrown, leaf, { position: [-0.3, 5.25, 0], scale: [1.42, 0.7, 1.2] }),
        part('west leaf curtain', curtain, leaf, { position: [-1.05, 3.65, 0.1], rotation: [0.05, 0, -0.08] }),
        part('east leaf curtain', curtain, leaf, { position: [0.78, 3.72, -0.12], rotation: [-0.04, 0, 0.1], scale: [0.9, 0.92, 0.9] }),
        part('rear leaf curtain', curtain, leaf, { position: [-0.1, 3.55, -0.88], rotation: [0.12, 0, 0], scale: [0.72, 0.86, 0.72] }),
        part('willow votive', lantern, glow, { position: [0.82, 2.62, 0.22], castShadow: false })
    ];
}

function createRimePine() {
    const p = palette('water');
    const bark = material('foliage-rime-bark', 0x334853);
    const ice = material('foliage-rime-needle', 0x7898a6, { metalness: 0.08, roughness: 0.7 });
    const snow = material('foliage-rime-snow', 0xb8ccd2, { roughness: 0.82 });
    const glow = material('foliage-rime-glow', p.accent, { emissive: p.accent, emissiveIntensity: 0.66 });
    return [
        part('drowned pine trunk', trunk, bark, { position: [0, 2.75, 0], scale: [0.76, 1.05, 0.76] }),
        part('lower rime tier', pineCrown, ice, { position: [0, 3.6, 0], scale: [1.18, 0.78, 1.18] }),
        part('middle snow tier', pineCrown, snow, { position: [0, 5.18, 0], scale: [0.84, 0.62, 0.84] }),
        part('moonfrost crown', pineCrown, ice, { position: [0, 6.48, 0], scale: [0.54, 0.48, 0.54] }),
        part('conduction crystal', shard, glow, { position: [0.58, 0.82, 0.1], rotation: [0, 0, -0.18], scale: [0.45, 0.62, 0.45], castShadow: false })
    ];
}

function createDrownedWillow() {
    const p = palette('water');
    const bark = material('foliage-drowned-bark', 0x263b43);
    const leaf = material('foliage-drowned-reed', 0x536f79, { side: THREE.DoubleSide });
    const spirit = material('foliage-drowned-spirit', p.spirit, { emissive: p.spirit, emissiveIntensity: 0.82 });
    return [
        part('bent drowned trunk', trunk, bark, { position: [0.28, 2.6, 0], rotation: [0, 0, -0.2], scale: [0.84, 1.02, 0.84] }),
        part('drowned canopy', broadCrown, leaf, { position: [-0.4, 5.38, 0], scale: [1.36, 0.58, 1.08] }),
        part('silver reed curtain west', curtain, leaf, { position: [-1.0, 3.72, 0], scale: [0.72, 0.92, 0.72] }),
        part('silver reed curtain east', curtain, leaf, { position: [0.72, 3.55, 0.15], scale: [0.65, 0.82, 0.65] }),
        part('drowned soul fruit west', lantern, spirit, { position: [-0.9, 2.58, 0.25], castShadow: false }),
        part('drowned soul fruit east', lantern, spirit, { position: [0.65, 2.92, -0.08], scale: [0.75, 0.75, 0.75], castShadow: false })
    ];
}

function createEmberSnag() {
    const p = palette('fire');
    const char = material('foliage-charwood', 0x211b1a);
    const ember = material('foliage-ember-heart', p.accent, { emissive: p.accent, emissiveIntensity: 1.05, roughness: 0.42 });
    return [
        part('charred trunk', trunk, char, { position: [0, 2.6, 0], rotation: [0, 0, 0.08], scale: [0.86, 1, 0.86] }),
        part('forked snag west', branch, char, { position: [-0.72, 4.55, 0], rotation: [0, 0, -0.7] }),
        part('forked snag east', branch, char, { position: [0.78, 4.1, 0.12], rotation: [0.12, 0, 0.78], scale: [0.88, 0.88, 0.88] }),
        part('ember shard west', shard, ember, { position: [-0.95, 5.68, 0], rotation: [0, 0, -0.2], scale: [0.5, 0.66, 0.5], castShadow: false }),
        part('ember shard east', shard, ember, { position: [1.02, 5.24, 0.1], rotation: [0, 0, 0.22], scale: [0.42, 0.58, 0.42], castShadow: false }),
        part('ember heart', lantern, ember, { position: [0.08, 2.9, 0.35], castShadow: false })
    ];
}

function createBasaltBriar() {
    const p = palette('fire');
    const basalt = material('foliage-basalt', p.shadow, { roughness: 0.78 });
    const rust = material('foliage-basalt-rust', p.midtone, { metalness: 0.28 });
    const magma = material('foliage-basalt-magma', p.spirit, { emissive: p.spirit, emissiveIntensity: 1.15, roughness: 0.35 });
    return [
        part('basalt briar spine', shard, basalt, { position: [0, 1.5, 0], scale: [1.2, 1.38, 1.2] }),
        part('western basalt thorn', shard, rust, { position: [-0.88, 1.05, 0.15], rotation: [0, 0, -0.62], scale: [0.72, 0.72, 0.72] }),
        part('eastern basalt thorn', shard, basalt, { position: [0.88, 0.95, -0.08], rotation: [0, 0, 0.68], scale: [0.66, 0.66, 0.66] }),
        part('magma briar heart', crystal, magma, { position: [0, 1.2, 0.42], scale: [0.42, 0.72, 0.36], castShadow: false })
    ];
}

function createGaleCypress() {
    const p = palette('air');
    const bark = material('foliage-gale-bark', 0x4e5966, { metalness: 0.12 });
    const leaf = material('foliage-gale-leaf', 0x526b78, { side: THREE.DoubleSide });
    const charge = material('foliage-gale-charge', p.accent, { emissive: p.accent, emissiveIntensity: 0.76 });
    return [
        part('wind-bent silver trunk', narrowTrunk, bark, { position: [0.35, 3, 0], rotation: [0, 0, -0.16], scale: [1.15, 0.98, 1.15] }),
        part('low leeward crown', pineCrown, leaf, { position: [-0.5, 3.7, 0], rotation: [0, 0, -0.16], scale: [0.72, 0.78, 0.72] }),
        part('high leeward crown', pineCrown, leaf, { position: [-0.75, 5.42, 0], rotation: [0, 0, -0.18], scale: [0.55, 0.68, 0.55] }),
        part('storm conductor', shard, charge, { position: [-1.08, 6.75, 0], rotation: [0, 0, -0.22], scale: [0.34, 0.48, 0.34], castShadow: false }),
        part('windward root', root, bark, { position: [0.74, 0.3, 0.1], rotation: [0, 0, -Math.PI / 2], scale: [0.72, 0.62, 0.72] })
    ];
}

function createStormCrystal() {
    const p = palette('air');
    const slate = material('foliage-storm-slate', p.shadow, { roughness: 0.76 });
    const silver = material('foliage-storm-silver', 0x74859a, { metalness: 0.52, roughness: 0.48 });
    const charge = material('foliage-storm-violet', p.spirit, { emissive: p.spirit, emissiveIntensity: 1.08, roughness: 0.3 });
    return [
        part('storm crystal plinth', shard, slate, { position: [0, 1.18, 0], scale: [1.05, 1.08, 1.05] }),
        part('silver conductor west', shard, silver, { position: [-0.72, 1.12, 0.08], rotation: [0, 0, -0.42], scale: [0.58, 0.78, 0.58] }),
        part('silver conductor east', shard, silver, { position: [0.7, 0.92, -0.1], rotation: [0, 0, 0.5], scale: [0.52, 0.66, 0.52] }),
        part('captive storm', crystal, charge, { position: [0, 1.72, 0.36], scale: [0.52, 0.82, 0.44], castShadow: false })
    ];
}

const ARCHETYPE_BUILDERS = Object.freeze({
    ossuary_birch: createOssuaryBirch,
    grave_pine: createGravePine,
    mourning_willow: createMourningWillow,
    rime_pine: createRimePine,
    drowned_willow: createDrownedWillow,
    ember_snag: createEmberSnag,
    basalt_briar: createBasaltBriar,
    gale_cypress: createGaleCypress,
    storm_crystal: createStormCrystal
});

export const PROCEDURAL_FOLIAGE_RECIPES = Object.freeze([
    Object.freeze({ id: 'ossuary_birch', region: 'earth', theme: 'pale ossuary birch', count: 120, bounds: [-950, 950, -550, 950], scale: [0.88, 1.28], collision: [0.72, 8.2] }),
    Object.freeze({ id: 'grave_pine', region: 'earth', theme: 'black grave pine', count: 115, bounds: [-950, 950, -550, 950], scale: [0.9, 1.3], collision: [0.78, 8.5] }),
    Object.freeze({ id: 'mourning_willow', region: 'earth', theme: 'votive mourning willow', count: 95, bounds: [-950, 950, -550, 950], scale: [0.88, 1.22], collision: [0.82, 7.2] }),
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
    for (const [clearX, clearZ, radius] of FOLIAGE_HAZARD_CLEARINGS[region] || []) {
        if (Math.hypot(x - clearX, z - clearZ) <= radius + 8) return false;
    }
    for (const [clearX, clearZ, radius] of LANDMARK_CLEARINGS[region] || []) {
        if (Math.hypot(x - clearX, z - clearZ) <= radius) return false;
    }

    // Preserve the four cardinal realm roads and their gateway sightlines.
    if (region === 'earth') {
        if (Math.abs(x) < 34 && (z < 110 || z > 290)) return false;
        if (Math.abs(z - 200) < 34 && Math.abs(x) > 90) return false;
    }
    if (region === 'water' && Math.abs(x) < 42) return false;
    if ((region === 'fire' || region === 'air') && Math.abs(z - 200) < 42) return false;
    return true;
}

export function createProceduralFoliagePlacements(recipe) {
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

export function getProceduralFoliageArchetype(id) {
    const builder = ARCHETYPE_BUILDERS[id];
    if (!builder) throw new Error(`Unknown procedural foliage archetype: ${id}`);
    if (!ARCHETYPES.has(id)) ARCHETYPES.set(id, Object.freeze(builder()));
    return ARCHETYPES.get(id);
}

export function createProceduralFoliagePreview(id) {
    const recipe = PROCEDURAL_FOLIAGE_RECIPES.find((candidate) => candidate.id === id);
    if (!recipe) throw new Error(`Unknown procedural foliage archetype: ${id}`);
    const group = new THREE.Group();
    group.name = `ProceduralFoliage:${id}`;
    group.userData.proceduralFoliage = true;
    group.userData.foliageId = id;
    group.userData.region = recipe.region;
    group.userData.theme = recipe.theme;
    for (const descriptor of getProceduralFoliageArchetype(id)) {
        const mesh = new THREE.Mesh(descriptor.geometry, descriptor.material);
        mesh.name = descriptor.name;
        mesh.applyMatrix4(descriptor.matrix);
        mesh.castShadow = descriptor.castShadow;
        mesh.receiveShadow = descriptor.receiveShadow;
        group.add(mesh);
    }
    return group;
}

export function getProceduralFoliageCacheMetrics() {
    return Object.freeze({
        geometries: GEOMETRIES.size,
        materials: MATERIALS.size,
        archetypes: ARCHETYPES.size
    });
}
