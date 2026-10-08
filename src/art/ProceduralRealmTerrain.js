import * as THREE from 'three';
import { getRegionTheme } from './darkFantasyTheme.js';
import { applyTownGroundComposition } from './TownGroundComposition.js';
import { applyEarthGroundComposition } from './EarthGroundComposition.js';
import { sampleElementalTerrain } from './ElementalTerrainSurface.js';

function terrainDefinition(id, region, label, motif, seed, surface) {
    return Object.freeze({ id, region, label, motif, seed, surface: Object.freeze(surface) });
}

export const PROCEDURAL_TERRAIN_DEFINITIONS = Object.freeze({
    earth: terrainDefinition(
        'gloamwood-loam', 'earth', 'Gloamwood Marches',
        'mottled grave-loam, embedded cairn grains, moss patches, and short worn root fragments', 0x6d2b79f5,
        { roughness: 0.94, metalness: 0.02, repeat: [72, 58], tint: 0xd6c7a8 }
    ),
    town: terrainDefinition(
        'lanternhold-vigil-stone', 'town', 'Lanternhold',
        'hand-set weathered cobbles, softened mortar, chipped corners, and quiet lichen stains', 0x14a7b0d3,
        { roughness: 0.94, metalness: 0.02, repeat: [28, 28], tint: 0xe0d8ca }
    ),
    water: terrainDefinition(
        'moonfrost-drowned-ice', 'water', 'Moonfrost Expanse',
        'frost-dusted basalt, weathered blue-grey ice, wind-swept rime, and subdued mineral grains', 0x39c56a11,
        { roughness: 0.9, metalness: 0.03, repeat: [64, 52], tint: 0xe0e6e8 }
    ),
    fire: terrainDefinition(
        'cinder-waste-blackglass', 'fire', 'Cinder Wastes',
        'folded cooled-flow basalt, recessed scoria pores, iron-rich crust, and wind-deposited ash pockets', 0xa21f3c87,
        { roughness: 0.96, metalness: 0.04, repeat: [70, 56], tint: 0xd9c8b6 }
    ),
    air: terrainDefinition(
        'stormcrown-slate', 'air', 'Stormcrown Reach',
        'wind-scoured slate, broken warped bedding, pale scree deposits, and weathered violet-grey stone', 0xc3841dd9,
        { roughness: 0.93, metalness: 0.03, repeat: [68, 54], tint: 0xd1cdd8 }
    ),
    ocean: terrainDefinition(
        'eidolic-blackwater', 'water', 'The Eidolic Deep',
        'layered blackwater, pale wave bones, deep-teal undertow, and moon-silver ripples', 0x82b4ef25,
        { roughness: 0.28, metalness: 0.18, repeat: [180, 180], tint: 0x83b6c8 }
    ),
    sky: terrainDefinition(
        'eidolic-night-vault', 'air', 'The Eidolic Night',
        'ink-blue vault, ash haze, remote cold stars, and a restrained violet horizon', 0xf1a35c49,
        { roughness: 1, metalness: 0, repeat: [1, 1], tint: 0xffffff }
    )
});

function hash2d(x, y, seed) {
    let value = (Math.imul(x + 0x9e37, 0x85ebca6b) ^ Math.imul(y + 0x7f4a, 0xc2b2ae35) ^ seed) >>> 0;
    value ^= value >>> 16;
    value = Math.imul(value, 0x7feb352d);
    value ^= value >>> 15;
    value = Math.imul(value, 0x846ca68b);
    value ^= value >>> 16;
    return (value >>> 0) / 0xffffffff;
}

function colorChannels(color) {
    return [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff];
}

function mixColor(from, to, amount) {
    const a = colorChannels(from);
    const b = colorChannels(to);
    const t = Math.max(0, Math.min(1, amount));
    return [
        Math.round(a[0] + (b[0] - a[0]) * t),
        Math.round(a[1] + (b[1] - a[1]) * t),
        Math.round(a[2] + (b[2] - a[2]) * t)
    ];
}

function paletteFor(key) {
    if (key === 'ocean') return { shadow: 0x07131b, ground: 0x123345, midtone: 0x347087, accent: 0x93dce2 };
    if (key === 'sky') return { shadow: 0x05070d, ground: 0x111827, midtone: 0x343552, accent: 0xa7c8e8 };
    return getRegionTheme(key).palette;
}

function periodicNoise(x, y, cells, seed) {
    const px = x / 256 * cells;
    const py = y / 256 * cells;
    const ix = Math.floor(px);
    const iy = Math.floor(py);
    const fx = px - ix;
    const fy = py - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const wrap = (value) => ((value % cells) + cells) % cells;
    const a = hash2d(wrap(ix), wrap(iy), seed);
    const b = hash2d(wrap(ix + 1), wrap(iy), seed);
    const c = hash2d(wrap(ix), wrap(iy + 1), seed);
    const d = hash2d(wrap(ix + 1), wrap(iy + 1), seed);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function sampleEarth(x, y, _size, definition) {
    // Patchy loam rather than closed sinusoidal cells that read as paving.
    // All fields wrap on the same canonical tile at both quality levels.
    const seed = definition.seed;
    const broad = periodicNoise(x, y, 8, seed);
    const grit = periodicNoise(x, y, 32, seed ^ 0x5184);
    const grain = hash2d(x, y, seed ^ 0x3d28);
    const moss = Math.max(0, (broad - 0.45) * 1.5);
    const soil = mixColor(0x383329, 0x635a46, 0.12 + grit * 0.32 + grain * 0.12);
    const mossColor = colorChannels(0x47513a);
    const color = soil.map((value, index) => value + (mossColor[index] - value) * moss);

    // Sparse short, tapered root fragments. Each fits inside its cell so no
    // seam joins them into a repeated network of large outlined polygons.
    const cellX = Math.floor(x / 32);
    const cellY = Math.floor(y / 32);
    const rootSeed = hash2d(cellX, cellY, seed ^ 0xace1);
    if (rootSeed > 0.62) {
        const angle = rootSeed * Math.PI * 7;
        const dx = x % 32 - 16;
        const dy = y % 32 - 16;
        const along = dx * Math.cos(angle) + dy * Math.sin(angle);
        const across = -dx * Math.sin(angle) + dy * Math.cos(angle);
        const taper = Math.max(0, 1 - Math.abs(along) / 11);
        const root = Math.max(0, 1 - Math.abs(across - Math.sin(along * 0.23)) / 1.25) * taper;
        for (let channel = 0; channel < 3; channel++) color[channel] *= 1 - root * 0.27;
    }

    // Small embedded stones, not bright square/diamond confetti.
    const chipSeed = hash2d(Math.floor(x / 8), Math.floor(y / 8), seed ^ 0xb917);
    const chip = chipSeed > 0.83
        ? Math.max(0, 1 - Math.hypot((x % 8 - 4) / 1.5, (y % 8 - 4) / 0.85))
        : 0;
    return color.map((channel) => Math.round(channel + chip * 13));
}

function townStoneShape(x, y, size, definition) {
    // Canonical texel coordinates keep Low's stones the same physical size.
    // Eight columns / sixteen rows wrap exactly, including the offset bond.
    const px = x * 256 / size;
    const py = y * 256 / size;
    const row = Math.floor(py / 16);
    const shiftedX = px + (row % 2) * 16 + Math.sin(py * Math.PI / 128) * 0.7;
    const localX = ((shiftedX % 32) + 32) % 32;
    const localY = py % 16;
    const stoneX = ((Math.floor(shiftedX / 32) % 8) + 8) % 8;
    const stoneNoise = hash2d(stoneX, row, definition.seed);
    const dx = Math.min(localX, 32 - localX);
    const dy = Math.min(localY, 16 - localY);
    const cornerCut = 1.1 + stoneNoise * 1.3;
    const edge = Math.min(dx, dy, (dx + dy - cornerCut) * 0.707);
    return { px, py, stoneNoise, edge };
}

function sampleTown(x, y, size, definition, palette) {
    const { px, py, stoneNoise, edge } = townStoneShape(x, y, size, definition);
    const wear = hash2d(Math.floor(px), Math.floor(py), definition.seed ^ 0x9f31);
    const stain = Math.sin(px * Math.PI / 128) * Math.cos(py * Math.PI / 64);
    const stone = mixColor(palette.ground, palette.midtone, 0.17 + stoneNoise * 0.16 + wear * 0.05 + stain * 0.035);
    const joint = mixColor(palette.shadow, palette.ground, 0.53);
    // A soft bevel/joint, rather than an oversized black grid. The only bright
    // oath marks now belong to world landmarks, not a repeating floor stamp.
    const coverage = Math.max(0, Math.min(1, (edge - 0.45) / (256 / size)));
    const bevel = 0.89 + Math.min(1, Math.max(0, edge) / 2.6) * 0.11;
    return stone.map((channel, index) => Math.round(joint[index] + (channel * bevel - joint[index]) * coverage));
}

function sampleWater(x, y, _size, definition) {
    return sampleElementalTerrain(x, y, 'water', definition.seed).color;
}

function sampleFire(x, y, _size, definition) {
    return sampleElementalTerrain(x, y, 'fire', definition.seed).color;
}

function sampleAir(x, y, _size, definition) {
    return sampleElementalTerrain(x, y, 'air', definition.seed).color;
}

function sampleOcean(x, y, _size, definition, palette) {
    const noise = hash2d(x, y, definition.seed);
    const wave = (Math.sin(x * 0.11 + Math.sin(y * 0.037) * 2.1) + Math.cos(y * 0.083)) * 0.5 + 0.5;
    const bone = Math.abs(Math.sin(x * 0.068 + y * 0.031 + noise * 0.32)) > 0.988;
    return mixColor(palette.shadow, bone ? palette.accent : palette.midtone, bone ? 0.52 : 0.12 + wave * 0.3);
}

function sampleSky(x, y, size, definition, palette) {
    const vertical = y / Math.max(1, size - 1);
    const haze = Math.exp(-Math.pow((vertical - 0.64) * 5.8, 2));
    const star = hash2d(x, y, definition.seed) > 1 - (46 / (size * size));
    if (star) return mixColor(palette.accent, 0xffffff, hash2d(y, x, definition.seed) * 0.62);
    const base = mixColor(palette.shadow, palette.ground, 0.16 + vertical * 0.36);
    const horizon = colorChannels(0x322940);
    return base.map((channel, index) => Math.round(channel + (horizon[index] - channel) * haze * 0.34));
}

const SAMPLERS = Object.freeze({
    earth: sampleEarth,
    town: sampleTown,
    water: sampleWater,
    fire: sampleFire,
    air: sampleAir,
    ocean: sampleOcean,
    sky: sampleSky
});

function updateSignature(signature, value) {
    return Math.imul(signature ^ value, 0x01000193) >>> 0;
}

export function createProceduralTerrainTexture(key, { quality = 'high' } = {}) {
    const definition = PROCEDURAL_TERRAIN_DEFINITIONS[key];
    if (!definition) return null;
    const normalizedQuality = quality === 'low' ? 'low' : 'high';
    const size = key === 'sky'
        ? (normalizedQuality === 'low' ? 256 : 512)
        : (normalizedQuality === 'low' ? 128 : 256);
    const data = new Uint8Array(size * size * 4);
    const sampler = SAMPLERS[key];
    const palette = paletteFor(key);
    // Surface landmarks must not move or double in size when quality changes.
    // Town handles footprint-aware joint filtering itself; sky preserves its
    // resolution-dependent sparse star count rather than scaling surface UVs.
    const sampleScale = key === 'town' || key === 'sky' ? 1 : 256 / size;
    let signature = 0x811c9dc5;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const [red, green, blue] = sampler(x * sampleScale, y * sampleScale, size * sampleScale, definition, palette);
            const offset = (y * size + x) * 4;
            data[offset] = red;
            data[offset + 1] = green;
            data[offset + 2] = blue;
            data[offset + 3] = 255;
            signature = updateSignature(updateSignature(updateSignature(signature, red), green), blue);
        }
    }
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
    texture.name = `ProceduralTerrain:${definition.id}:${normalizedQuality}`;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    texture.userData.proceduralTerrain = true;
    texture.userData.terrainKey = key;
    texture.userData.terrainId = definition.id;
    texture.userData.region = definition.region;
    texture.userData.motif = definition.motif;
    texture.userData.quality = normalizedQuality;
    texture.userData.signature = signature.toString(16).padStart(8, '0');
    texture.userData.resolution = size;
    return texture;
}

// Surface shape is independent of albedo: a dark stain is not a hole and a
// bright magical mark is not a raised bump. Evaluate one periodic canonical
// field so Low and High retain the same stone/soil footprint and normal strength.
function createTerrainSurfaceMaps(key, quality) {
    if (!['town', 'earth', 'water', 'fire', 'air'].includes(key)) return null;
    const definition = PROCEDURAL_TERRAIN_DEFINITIONS[key];
    const canonicalSize = 256;
    const height = new Float32Array(canonicalSize * canonicalSize);
    const roughness = new Float32Array(height.length);
    for (let y = 0; y < canonicalSize; y++) {
        for (let x = 0; x < canonicalSize; x++) {
            const index = y * canonicalSize + x;
            if (key === 'town') {
                const { edge, stoneNoise } = townStoneShape(x, y, canonicalSize, definition);
                const bevel = THREE.MathUtils.clamp((edge - .3) / 2.8, 0, 1);
                const coverage = bevel * bevel * (3 - 2 * bevel);
                height[index] = .06 + coverage * (.55 + stoneNoise * .12);
                roughness[index] = .98 - coverage * (.20 + stoneNoise * .06);
            } else if (key === 'earth') {
                const broad = periodicNoise(x, y, 8, definition.seed);
                const grit = periodicNoise(x, y, 32, definition.seed ^ 0x5184);
                height[index] = .2 + broad * .16 + grit * .065;
                roughness[index] = .86 + broad * .12;
            } else {
                const surface = sampleElementalTerrain(x, y, key, definition.seed);
                height[index] = surface.height; roughness[index] = surface.roughness;
            }
        }
    }
    const size = quality === 'low' ? 128 : 256;
    const normalData = new Uint8Array(size * size * 4);
    const roughnessData = new Uint8Array(normalData.length);
    const sample = (x, y) => height[((y + canonicalSize) % canonicalSize) * canonicalSize + (x + canonicalSize) % canonicalSize];
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const cx = x * canonicalSize / size, cy = y * canonicalSize / size;
            const nx = -(sample(cx + 1, cy) - sample(cx - 1, cy)) * 2;
            const ny = -(sample(cx, cy + 1) - sample(cx, cy - 1)) * 2;
            const length = Math.hypot(nx, ny, 1);
            const offset = (y * size + x) * 4;
            normalData[offset] = Math.round((nx / length * .5 + .5) * 255);
            normalData[offset + 1] = Math.round((ny / length * .5 + .5) * 255);
            normalData[offset + 2] = Math.round((1 / length * .5 + .5) * 255);
            normalData[offset + 3] = 255;
            const value = Math.round(roughness[cy * canonicalSize + cx] * 255);
            roughnessData[offset] = roughnessData[offset + 1] = roughnessData[offset + 2] = value;
            roughnessData[offset + 3] = 255;
        }
    }
    const makeTexture = (data, channel) => {
        const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
        texture.name = `ProceduralTerrain:${definition.id}:${channel}:${quality}`;
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.colorSpace = THREE.NoColorSpace;
        texture.generateMipmaps = true;
        texture.needsUpdate = true;
        return texture;
    };
    return { normalMap: makeTexture(normalData, 'normal'), roughnessMap: makeTexture(roughnessData, 'roughness') };
}

export function createProceduralTerrainMaterial(key, { quality = 'high', texture = null } = {}) {
    const definition = PROCEDURAL_TERRAIN_DEFINITIONS[key];
    if (!definition) return null;
    const map = texture || createProceduralTerrainTexture(key, { quality });
    map.repeat.set(...definition.surface.repeat);
    const surfaces = createTerrainSurfaceMaps(key, map.userData.quality || quality);
    if (surfaces) {
        for (const surface of Object.values(surfaces)) {
            surface.repeat.copy(map.repeat);
            surface.offset.copy(map.offset);
            surface.center.copy(map.center);
            surface.rotation = map.rotation;
            surface.anisotropy = map.anisotropy;
        }
    }
    const material = new THREE.MeshStandardMaterial({
        map,
        ...surfaces,
        color: definition.surface.tint,
        roughness: definition.surface.roughness,
        metalness: definition.surface.metalness,
        emissive: definition.surface.emissive || 0x000000,
        emissiveIntensity: definition.surface.emissiveIntensity || 0
    });
    material.name = `ProceduralTerrainMaterial:${definition.id}`;
    material.userData.proceduralTerrain = true;
    material.userData.terrainKey = key;
    material.userData.terrainId = definition.id;
    material.userData.motif = definition.motif;
    if (key === 'town') {
        const soil = createProceduralTerrainTexture('earth', { quality: map.userData.quality || quality });
        soil.wrapS = THREE.RepeatWrapping; soil.wrapT = THREE.RepeatWrapping;
        applyTownGroundComposition(material, soil, map.userData.quality || quality);
    }
    if (key === 'earth') applyEarthGroundComposition(material, map.userData.quality || quality);
    if (surfaces) {
        // Albedo can be shared/owned by RenderSystem. These two maps are owned
        // by this material and must also be freed by preview/quality swaps.
        const release = () => {
            surfaces.normalMap.dispose();
            surfaces.roughnessMap.dispose();
            material.removeEventListener('dispose', release);
        };
        material.addEventListener('dispose', release);
    }
    return material;
}

export function getProceduralTerrainMetrics(texture) {
    if (!texture?.userData?.proceduralTerrain) return null;
    return Object.freeze({
        key: texture.userData.terrainKey,
        id: texture.userData.terrainId,
        region: texture.userData.region,
        motif: texture.userData.motif,
        quality: texture.userData.quality,
        signature: texture.userData.signature,
        resolution: texture.userData.resolution,
        repeat: texture.repeat.toArray(),
        codeGenerated: texture.isDataTexture === true
    });
}
