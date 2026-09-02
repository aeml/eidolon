const freezeArray = (values) => Object.freeze([...values]);

const regionTheme = ({ id, name, realm, motif, palette, lighting, particles }) => Object.freeze({
    id,
    name,
    realm,
    motif,
    palette: Object.freeze(palette),
    lighting: Object.freeze(lighting),
    particles: Object.freeze({
        ...particles,
        velY: freezeArray(particles.velY),
        velXZ: freezeArray(particles.velXZ),
        life: freezeArray(particles.life),
        spread: freezeArray(particles.spread),
        spawnY: freezeArray(particles.spawnY)
    })
});

/**
 * Eidolon's visual source of truth. All palettes favor dark neutral materials
 * with one bright gameplay accent so silhouettes stay legible at the normal
 * isometric camera distance without turning the world into neon noise.
 */
export const DARK_FANTASY_REGION_THEMES = Object.freeze({
    earth: regionTheme({
        id: 'gloamwood_marches',
        name: 'Earth Realm — Gloamwood Marches',
        realm: 'earth',
        motif: 'weathered stone, black oak, moss, grave-lantern gold',
        palette: { shadow: 0x171b18, ground: 0x34382f, midtone: 0x65705a, accent: 0xc6a15b, spirit: 0x9bb7a2, fog: 0x8f998e },
        lighting: {
            ambientIntensity: 1.9,
            keyIntensity: 2.45,
            keyColor: 0xffe8c2,
            fillColor: 0x8fa798,
            fillIntensity: 0.32,
            fogColor: 0x8f998e,
            fogNear: 1120,
            fogFar: 3900,
            exposure: 1.4,
            bloomStrength: 0.2,
            bloomRadius: 0.26,
            bloomThreshold: 0.84
        },
        particles: { color: 0xbca77e, size: 2.8, velY: [0.12, 0.48], velXZ: [-0.24, 0.24], life: [5, 9], spread: [55, 24, 55], spawnY: [-3, 20] }
    }),
    town: regionTheme({
        id: 'lanternhold',
        name: 'Lanternhold',
        realm: 'earth',
        motif: 'charcoal timber, old iron, amber windows, protective runes',
        palette: { shadow: 0x181715, ground: 0x3f3a32, midtone: 0x756a58, accent: 0xf0b85c, spirit: 0xffdda0, fog: 0xa19a8f },
        lighting: {
            ambientIntensity: 2.0,
            keyIntensity: 2.35,
            keyColor: 0xffdfb0,
            fillColor: 0xbd8050,
            fillIntensity: 0.38,
            fogColor: 0xa19a8f,
            fogNear: 1250,
            fogFar: 3800,
            exposure: 1.43,
            bloomStrength: 0.25,
            bloomRadius: 0.32,
            bloomThreshold: 0.79
        },
        particles: { color: 0xffc96b, size: 2.45, velY: [0.08, 0.34], velXZ: [-0.12, 0.12], life: [6, 11], spread: [40, 15, 40], spawnY: [0, 12] }
    }),
    water: regionTheme({
        id: 'moonfrost_expanse',
        name: 'Water Realm — Moonfrost Expanse',
        realm: 'water',
        motif: 'moonlit ice, drowned stone, silver reeds, deep teal shadows',
        palette: { shadow: 0x101a24, ground: 0x273d4a, midtone: 0x65869a, accent: 0x9de6ff, spirit: 0xc3b7ff, fog: 0x7894a5 },
        lighting: {
            ambientIntensity: 1.78,
            keyIntensity: 2.5,
            keyColor: 0xdaf3ff,
            fillColor: 0x6b78ad,
            fillIntensity: 0.34,
            fogColor: 0x7894a5,
            fogNear: 980,
            fogFar: 3550,
            exposure: 1.34,
            bloomStrength: 0.32,
            bloomRadius: 0.38,
            bloomThreshold: 0.73
        },
        particles: { color: 0xd8efff, size: 3.25, velY: [-1.25, -0.42], velXZ: [-0.28, 0.28], life: [5, 9], spread: [55, 35, 55], spawnY: [18, 38] }
    }),
    fire: regionTheme({
        id: 'cinder_wastes',
        name: 'Fire Realm — Cinder Wastes',
        realm: 'fire',
        motif: 'black glass, furnace iron, charred bone, ember-red fissures',
        palette: { shadow: 0x1c1110, ground: 0x3d211c, midtone: 0x76402e, accent: 0xff7a2f, spirit: 0xffc04d, fog: 0x77584c },
        lighting: {
            ambientIntensity: 1.62,
            keyIntensity: 2.62,
            keyColor: 0xffc08a,
            fillColor: 0xb9361f,
            fillIntensity: 0.3,
            fogColor: 0x77584c,
            fogNear: 900,
            fogFar: 3300,
            exposure: 1.3,
            bloomStrength: 0.38,
            bloomRadius: 0.34,
            bloomThreshold: 0.7
        },
        particles: { color: 0xff7435, size: 2.05, velY: [1.15, 2.8], velXZ: [-0.42, 0.42], life: [2, 4], spread: [55, 15, 55], spawnY: [-2, 8] }
    }),
    air: regionTheme({
        id: 'stormcrown_reach',
        name: 'Air Realm — Stormcrown Reach',
        realm: 'air',
        motif: 'storm slate, silver banners, fractured peaks, violet lightning',
        palette: { shadow: 0x151824, ground: 0x30384b, midtone: 0x71809b, accent: 0x9dc8ff, spirit: 0xb694ff, fog: 0x929db1 },
        lighting: {
            ambientIntensity: 1.84,
            keyIntensity: 2.55,
            keyColor: 0xe5efff,
            fillColor: 0x7969ad,
            fillIntensity: 0.34,
            fogColor: 0x929db1,
            fogNear: 1180,
            fogFar: 4200,
            exposure: 1.36,
            bloomStrength: 0.3,
            bloomRadius: 0.35,
            bloomThreshold: 0.76
        },
        particles: { color: 0xc4d9ff, size: 2.65, velY: [-0.1, 0.22], velXZ: [-2.35, 2.35], life: [2, 5], spread: [65, 25, 65], spawnY: [0, 28] }
    }),
    verdant_bastion_catacombs: regionTheme({
        id: 'thorncrypt',
        name: 'Verdant Bastion — The Thorncrypt',
        realm: 'dungeon',
        motif: 'root-bound masonry, tarnished bronze, funerary ivy, witchlight',
        palette: { shadow: 0x101710, ground: 0x263226, midtone: 0x53654b, accent: 0x88b45d, spirit: 0xa8e6a0, fog: 0x35483a },
        lighting: { ambientIntensity: 1.35, keyIntensity: 2.2, keyColor: 0xaed783, fillColor: 0x426b58, fillIntensity: 0.38, fogColor: 0x35483a, fogNear: 120, fogFar: 620, exposure: 1.24, bloomStrength: 0.35, bloomRadius: 0.42, bloomThreshold: 0.7 },
        particles: { color: 0x9ad47a, size: 2.4, velY: [0.04, 0.22], velXZ: [-0.12, 0.12], life: [6, 12], spread: [36, 16, 36], spawnY: [0, 14] }
    }),
    molten_core: regionTheme({
        id: 'furnace_below',
        name: 'Molten Core — The Furnace Below',
        realm: 'dungeon',
        motif: 'obsidian vaults, colossal chains, molten channels, forge sparks',
        palette: { shadow: 0x160b09, ground: 0x351612, midtone: 0x682c1d, accent: 0xff5b26, spirit: 0xffc13d, fog: 0x4d241c },
        lighting: { ambientIntensity: 1.22, keyIntensity: 2.6, keyColor: 0xff9b61, fillColor: 0xc62f19, fillIntensity: 0.42, fogColor: 0x4d241c, fogNear: 100, fogFar: 560, exposure: 1.2, bloomStrength: 0.52, bloomRadius: 0.4, bloomThreshold: 0.62 },
        particles: { color: 0xff6a2a, size: 2.2, velY: [1.0, 2.6], velXZ: [-0.35, 0.35], life: [2, 5], spread: [40, 18, 40], spawnY: [-1, 10] }
    }),
    tempest_spire: regionTheme({
        id: 'shattered_aerie',
        name: 'Tempest Spire — The Shattered Aerie',
        realm: 'dungeon',
        motif: 'floating slate, broken arches, silver conductors, captive storms',
        palette: { shadow: 0x111522, ground: 0x272d43, midtone: 0x586b8b, accent: 0x75c9ff, spirit: 0xbb8cff, fog: 0x46536d },
        lighting: { ambientIntensity: 1.34, keyIntensity: 2.5, keyColor: 0xcce8ff, fillColor: 0x6658a2, fillIntensity: 0.4, fogColor: 0x46536d, fogNear: 120, fogFar: 680, exposure: 1.26, bloomStrength: 0.44, bloomRadius: 0.42, bloomThreshold: 0.66 },
        particles: { color: 0xbcd9ff, size: 2.5, velY: [-0.12, 0.28], velXZ: [-2.1, 2.1], life: [2, 5], spread: [42, 24, 42], spawnY: [0, 26] }
    }),
    abyssal_well: regionTheme({
        id: 'drowned_sanctum',
        name: 'Abyssal Well — The Drowned Sanctum',
        realm: 'dungeon',
        motif: 'flooded basalt, drowned reliquaries, bioluminescent coral, black water',
        palette: { shadow: 0x07131b, ground: 0x102b37, midtone: 0x275568, accent: 0x41d5df, spirit: 0x79a9ff, fog: 0x1c3a48 },
        lighting: { ambientIntensity: 1.3, keyIntensity: 2.25, keyColor: 0xa8f5f1, fillColor: 0x315a91, fillIntensity: 0.42, fogColor: 0x1c3a48, fogNear: 100, fogFar: 600, exposure: 1.2, bloomStrength: 0.46, bloomRadius: 0.46, bloomThreshold: 0.64 },
        particles: { color: 0x70e3df, size: 2.55, velY: [0.06, 0.3], velXZ: [-0.2, 0.2], life: [5, 10], spread: [38, 22, 38], spawnY: [-1, 20] }
    })
});

const hazardTheme = (config) => Object.freeze(config);

export const DARK_FANTASY_HAZARD_THEMES = Object.freeze({
    lava_pool: hazardTheme({ name: 'Cinder Maw', region: 'fire', boundary: 0xff6b24, secondary: 0xffc24a, fill: 0x4a0e08, glyphCount: 12, pulseRate: 1.35 }),
    sandstorm: hazardTheme({ name: 'Gravewind Spiral', region: 'earth', boundary: 0xd0ad6a, secondary: 0xf0d6a0, fill: 0x4a3926, glyphCount: 10, pulseRate: 0.72 }),
    lightning_zone: hazardTheme({ name: 'Moonfrost Conduction Field', region: 'water', boundary: 0x72dcff, secondary: 0xb69cff, fill: 0x142e55, glyphCount: 16, pulseRate: 2.15 }),
    wind_gust: hazardTheme({ name: 'Stormcrown Shear', region: 'air', boundary: 0xa8d5ff, secondary: 0xc4a1ff, fill: 0x28304c, glyphCount: 14, pulseRate: 1.05 }),
    poison_cloud: hazardTheme({ name: 'Thorncrypt Miasma', region: 'verdant_bastion_catacombs', boundary: 0x83d45b, secondary: 0xc0ee79, fill: 0x173a18, glyphCount: 11, pulseRate: 0.88 }),
    ice_patch: hazardTheme({ name: 'Drowned Rime', region: 'water', boundary: 0xa8edff, secondary: 0xd9c9ff, fill: 0x27465e, glyphCount: 16, pulseRate: 0.62 }),
    generic: hazardTheme({ name: 'Eidolic Danger', region: 'earth', boundary: 0xff5364, secondary: 0xffa1ad, fill: 0x47131a, glyphCount: 12, pulseRate: 1.0 })
});

export const OVERWORLD_THEME_KEYS = freezeArray(['earth', 'town', 'water', 'fire', 'air']);
export const DUNGEON_THEME_KEYS = freezeArray([
    'verdant_bastion_catacombs',
    'molten_core',
    'tempest_spire',
    'abyssal_well'
]);
export const REGION_THEME_KEYS = freezeArray([
    ...OVERWORLD_THEME_KEYS,
    ...DUNGEON_THEME_KEYS
]);
export const ACTIVE_WORLD_HAZARD_TYPES = freezeArray([
    'lava_pool',
    'sandstorm',
    'lightning_zone',
    'wind_gust'
]);

export function getRegionTheme(region) {
    return DARK_FANTASY_REGION_THEMES[region] || DARK_FANTASY_REGION_THEMES.earth;
}

export function getHazardTheme(hazardType) {
    return DARK_FANTASY_HAZARD_THEMES[hazardType] || DARK_FANTASY_HAZARD_THEMES.generic;
}

export function createOverworldLightingPresets() {
    return Object.fromEntries(OVERWORLD_THEME_KEYS.map((key) => [
        key,
        { ...DARK_FANTASY_REGION_THEMES[key].lighting }
    ]));
}

export function createOverworldParticleConfigs() {
    return Object.fromEntries(OVERWORLD_THEME_KEYS.map((key) => {
        const particles = DARK_FANTASY_REGION_THEMES[key].particles;
        return [key, {
            ...particles,
            velY: [...particles.velY],
            velXZ: [...particles.velXZ],
            life: [...particles.life],
            spread: [...particles.spread],
            spawnY: [...particles.spawnY]
        }];
    }));
}

export function createRegionLightingPresets() {
    return Object.fromEntries(REGION_THEME_KEYS.map((key) => [
        key,
        { ...DARK_FANTASY_REGION_THEMES[key].lighting }
    ]));
}

export function createRegionParticleConfigs() {
    return Object.fromEntries(REGION_THEME_KEYS.map((key) => {
        const particles = DARK_FANTASY_REGION_THEMES[key].particles;
        return [key, {
            ...particles,
            velY: [...particles.velY],
            velXZ: [...particles.velXZ],
            life: [...particles.life],
            spread: [...particles.spread],
            spawnY: [...particles.spawnY]
        }];
    }));
}
