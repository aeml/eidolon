import * as THREE from 'three';
import { getRegionTheme } from './darkFantasyTheme.js';

function terrainDefinition(id, region, label, motif, seed, surface) {
    return Object.freeze({ id, region, label, motif, seed, surface: Object.freeze(surface) });
}

export const PROCEDURAL_TERRAIN_DEFINITIONS = Object.freeze({
    earth: terrainDefinition(
        'gloamwood-loam', 'earth', 'Gloamwood Marches',
        'grave-loam, weathered cairn chips, moss veins, and old root scars', 0x6d2b79f5,
        { roughness: 0.94, metalness: 0.02, repeat: [72, 58], tint: 0xd6c7a8 }
    ),
    town: terrainDefinition(
        'lanternhold-vigil-stone', 'town', 'Lanternhold',
        'offset vigil cobbles, iron-dark mortar, amber oath marks, and worn thresholds', 0x14a7b0d3,
        { roughness: 0.86, metalness: 0.08, repeat: [12, 12], tint: 0xf0d8b8 }
    ),
    water: terrainDefinition(
        'moonfrost-drowned-ice', 'water', 'Moonfrost Expanse',
        'moonlit blue ice, drowned basalt shadows, rime dust, and branching fractures', 0x39c56a11,
        { roughness: 0.46, metalness: 0.28, repeat: [64, 52], tint: 0xc8e6f0 }
    ),
    fire: terrainDefinition(
        'cinder-waste-blackglass', 'fire', 'Cinder Wastes',
        'charred blackglass plates, ash pockets, ember seams, and furnace-orange faults', 0xa21f3c87,
        { roughness: 0.82, metalness: 0.12, repeat: [70, 56], tint: 0xefa075, emissive: 0x210604, emissiveIntensity: 0.22 }
    ),
    air: terrainDefinition(
        'stormcrown-slate', 'air', 'Stormcrown Reach',
        'fractured storm slate, silver conductors, captive-violet charge, and wind-scoured edges', 0xc3841dd9,
        { roughness: 0.55, metalness: 0.24, repeat: [68, 54], tint: 0xc8d7f0, emissive: 0x0b1021, emissiveIntensity: 0.14 }
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

function sampleEarth(x, y, size, definition, palette) {
    const noise = hash2d(x, y, definition.seed);
    const coarse = hash2d(Math.floor(x / 7), Math.floor(y / 7), definition.seed ^ 0x5184);
    const root = Math.abs(Math.sin(x * 0.082 + Math.sin(y * 0.037) * 2.4) + Math.cos(y * 0.096)) < 0.105;
    const cairn = hash2d(Math.floor(x / 3), Math.floor(y / 3), definition.seed ^ 0xace1) > 0.965;
    if (cairn) return mixColor(palette.ground, palette.midtone, 0.58 + noise * 0.2);
    if (root) return mixColor(palette.shadow, 0x72583b, 0.26 + noise * 0.18);
    const moss = Math.sin((x + y) / size * Math.PI * 8 + coarse * 2) > 0.82;
    return mixColor(palette.ground, moss ? 0x536445 : palette.midtone, 0.08 + noise * (moss ? 0.28 : 0.15));
}

function sampleTown(x, y, _size, definition, palette) {
    const tileWidth = 42;
    const tileHeight = 23;
    const row = Math.floor(y / tileHeight);
    const shiftedX = x + (row % 2) * tileWidth * 0.5;
    const localX = ((shiftedX % tileWidth) + tileWidth) % tileWidth;
    const localY = y % tileHeight;
    const mortar = localX < 2 || localX > tileWidth - 2 || localY < 2 || localY > tileHeight - 2;
    if (mortar) return mixColor(palette.shadow, 0x090a0b, 0.34);
    const stoneX = Math.floor(shiftedX / tileWidth);
    const stoneY = row;
    const stoneNoise = hash2d(stoneX, stoneY, definition.seed);
    const wear = hash2d(x, y, definition.seed ^ 0x9f31);
    const oathMark = stoneNoise > 0.968
        && (Math.abs(localX - tileWidth / 2) < 1.5 || Math.abs(localY - tileHeight / 2) < 1.5);
    if (oathMark) return mixColor(palette.accent, 0xffdb8a, 0.36);
    return mixColor(palette.ground, palette.midtone, 0.08 + stoneNoise * 0.22 + wear * 0.08);
}

function sampleWater(x, y, _size, definition, palette) {
    const noise = hash2d(x, y, definition.seed);
    const broad = hash2d(Math.floor(x / 9), Math.floor(y / 9), definition.seed ^ 0x4b19);
    const fracture = Math.abs(
        Math.sin(x * 0.061 + Math.sin(y * 0.047) * 2.8)
        + Math.cos(y * 0.073 + Math.sin(x * 0.031) * 2.2)
    );
    if (fracture < 0.09) return mixColor(palette.shadow, palette.accent, 0.42 + noise * 0.22);
    const rime = noise > 0.91;
    return mixColor(palette.ground, rime ? 0xd6edf2 : palette.midtone, 0.12 + broad * 0.25);
}

function sampleFire(x, y, _size, definition, palette) {
    const noise = hash2d(x, y, definition.seed);
    const plate = hash2d(Math.floor(x / 11), Math.floor(y / 11), definition.seed ^ 0x31ef);
    const fault = Math.abs(
        Math.sin(x * 0.052 + Math.sin(y * 0.019) * 3.6)
        + Math.cos(y * 0.067 + plate * 1.4)
    );
    if (fault < 0.12) return mixColor(0xff5420, palette.accent, 0.4 + noise * 0.48);
    const ash = noise > 0.88;
    return mixColor(palette.shadow, ash ? palette.midtone : palette.ground, 0.22 + plate * 0.28);
}

function sampleAir(x, y, _size, definition, palette) {
    const tile = 31;
    const localX = (x + Math.floor(y / tile) * 9) % tile;
    const localY = y % tile;
    const noise = hash2d(x, y, definition.seed);
    const seam = localX < 1.5 || localY < 1.5 || Math.abs(localX - localY * 0.42) < 1.1;
    const conductor = (x + y * 2) % 97 < 1.4;
    if (conductor) return mixColor(palette.accent, palette.spirit, 0.46);
    if (seam) return mixColor(palette.shadow, 0x090d18, 0.28);
    return mixColor(palette.ground, palette.midtone, 0.12 + noise * 0.24);
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
    let signature = 0x811c9dc5;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const [red, green, blue] = sampler(x, y, size, definition, palette);
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

export function createProceduralTerrainMaterial(key, { quality = 'high', texture = null } = {}) {
    const definition = PROCEDURAL_TERRAIN_DEFINITIONS[key];
    if (!definition) return null;
    const map = texture || createProceduralTerrainTexture(key, { quality });
    map.repeat.set(...definition.surface.repeat);
    const material = new THREE.MeshStandardMaterial({
        map,
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
