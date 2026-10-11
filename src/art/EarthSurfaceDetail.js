import { DataTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping } from 'three';

export const EARTH_SURFACE_TILE_METRES = 8;
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = (a, b, value) => { const t = clamp((value - a) / (b - a)); return t * t * (3 - 2 * t); };
const wrap = (value, period) => ((value % period) + period) % period;
const hash = (x, z, seed) => {
    let value = Math.imul(x + 137, 1597334677) ^ Math.imul(z + 83, 3812015801) ^ seed;
    value = Math.imul(value ^ value >>> 16, 2246822519);
    return ((value ^ value >>> 13) >>> 0) / 4294967296;
};

function layer(cells, seed, stone = false) {
    return { cells, sites: Array.from({ length: cells * cells }, (_, i) => {
        const x = i % cells, z = Math.floor(i / cells), tone = hash(x, z, seed);
        const angle = hash(x, z, seed ^ 0x5361) * Math.PI * 2;
        return { x: .15 + hash(x, z, seed ^ 0x3127) * .7, z: .15 + hash(x, z, seed ^ 0x9943) * .7,
            rx: stone ? .16 + tone * .20 : .36 + hash(x, z, seed ^ 0x6153) * .28,
            rz: stone ? .14 + hash(x, z, seed ^ 0x7319) * .18 : .30 + hash(x, z, seed ^ 0x7319) * .34,
            cos: Math.cos(angle), sin: Math.sin(angle), tone, active: !stone || tone > .70 };
    }) };
}

// Fixed deterministic descriptors, not textures/materials or per-frame work.
// Sites jitter, rotate and vary in width; the field wraps by inspecting adjacent
// cells, so shapes can cross a tile edge without cuts or a square-cell outline.
const SOIL = layer(32, 0x476c1b39), STONES = layer(16, 0x916fa273, true), MOSS = layer(8, 0x14a789a3);
function sampleLayer(x, z, source, stone = false) {
    const px = x / EARTH_SURFACE_TILE_METRES * source.cells, pz = z / EARTH_SURFACE_TILE_METRES * source.cells;
    const cx = Math.floor(px), cz = Math.floor(pz);
    let coverage = 0, height = 0;
    for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) {
        const ix = cx + ox, iz = cz + oz, site = source.sites[wrap(iz, source.cells) * source.cells + wrap(ix, source.cells)];
        if (!site.active) continue;
        const dx = px - ix - site.x, dz = pz - iz - site.z;
        const a = (dx * site.cos - dz * site.sin) / site.rx, b = (dx * site.sin + dz * site.cos) / site.rz;
        const radius = Math.hypot(a, b);
        // Clipped oval stones have unequal mineral faces, not repeated square
        // slabs. Round shallow soil aggregates and cushions stay smooth.
        const distance = stone ? Math.max(radius, Math.abs(a + b * .35) * .94) : radius;
        const shape = 1 - smooth(stone ? .65 : .18, 1, distance);
        coverage = Math.max(coverage, shape);
        const face = stone ? .68 + site.tone * .20 : .60 + site.tone * .40;
        height = Math.max(height, shape * face);
    }
    return { coverage, height };
}

// Flattened grass bundles share the vegetation channel. The fixed descriptors
// and polynomial blade bends avoid per-texel trigonometry. This is a material
// surface: standing plants, collisions and draw submissions stay independent.
const GRASS_CELLS = 18;
const GRASS = Array.from({ length: GRASS_CELLS * GRASS_CELLS }, (_, i) => {
    const x = i % GRASS_CELLS, z = Math.floor(i / GRASS_CELLS);
    const tone = hash(x, z, 0x6327ac91), angle = tone * Math.PI * 2;
    return { x: .15 + hash(x, z, 0x812376af) * .7,
        z: .15 + hash(x, z, 0x5b1473a1) * .7,
        blades: [-.45, 0, .4].map(turn => ({ cos: Math.cos(angle + turn), sin: Math.sin(angle + turn),
            length: .9 + tone * .5, width: .18 + tone * .1, height: .65 + tone * .35 })) };
});
function sampleBlade(dx, dz, blade) {
    const along = (dx * blade.cos + dz * blade.sin) / blade.length + .2;
    if (along <= 0 || along >= 1) return 0;
    const across = -dx * blade.sin + dz * blade.cos - along * (1 - along) * .32;
    const radius = Math.abs(across) / (blade.width * (1 - along * .75));
    return (1 - smooth(.1, 1, radius)) * smooth(0, .12, along) *
        (1 - smooth(.8, 1, along)) * blade.height;
}

export function sampleEarthThatch(x, z) {
    const px = wrap(x, EARTH_SURFACE_TILE_METRES) / EARTH_SURFACE_TILE_METRES * GRASS_CELLS;
    const pz = wrap(z, EARTH_SURFACE_TILE_METRES) / EARTH_SURFACE_TILE_METRES * GRASS_CELLS;
    const cx = Math.floor(px), cz = Math.floor(pz);
    let height = 0;
    for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) {
        const ix = cx + ox, iz = cz + oz;
        const tuft = GRASS[wrap(iz, GRASS_CELLS) * GRASS_CELLS + wrap(ix, GRASS_CELLS)];
        const dx = px - ix - tuft.x, dz = pz - iz - tuft.z;
        for (const blade of tuft.blades) {
            height = Math.max(height, sampleBlade(dx, dz, blade));
        }
    }
    return height;
}

// Paint only a blade's conservative rectangle. Testing all 27 blades at every
// texture pixel wastes preparation time; wrapping these bounded stamps retains
// the same canonical analytic field, including every tile-edge contribution.
function rasterizeThatch(size) {
    const data = new Float64Array(size * size), step = GRASS_CELLS / size;
    for (let iz = 0; iz < GRASS_CELLS; iz++) for (let ix = 0; ix < GRASS_CELLS; ix++) {
        const tuft = GRASS[iz * GRASS_CELLS + ix];
        for (const blade of tuft.blades) {
            const corners = [-.2 * blade.length, .8 * blade.length].flatMap(along =>
                [-blade.width, blade.width + .08].map(across =>
                    [along * blade.cos - across * blade.sin, along * blade.sin + across * blade.cos]));
            const x0 = Math.ceil((ix + tuft.x + Math.min(...corners.map(p => p[0]))) / step);
            const x1 = Math.floor((ix + tuft.x + Math.max(...corners.map(p => p[0]))) / step);
            const z0 = Math.ceil((iz + tuft.z + Math.min(...corners.map(p => p[1]))) / step);
            const z1 = Math.floor((iz + tuft.z + Math.max(...corners.map(p => p[1]))) / step);
            for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
                const height = sampleBlade(x * step - ix - tuft.x, z * step - iz - tuft.z, blade);
                const at = wrap(z, size) * size + wrap(x, size);
                data[at] = Math.max(data[at], height);
            }
        }
    }
    return data;
}

// R soil relief, G stone coverage, B grass/moss relief, A stone relief.
// No baked directional illumination or emission. Shader color/roughness and
// shallow normal relief consume these same registered physical features.
function sampleFields(x, z, thatch) {
    const soil = sampleLayer(x, z, SOIL), stones = sampleLayer(x, z, STONES, true), moss = sampleLayer(x, z, MOSS);
    return [.24 + soil.height * .62, stones.coverage, .20 + Math.max(moss.height * .35, thatch * .70), stones.height];
}
export function sampleEarthSurface(x, z) {
    x = wrap(x, EARTH_SURFACE_TILE_METRES); z = wrap(z, EARTH_SURFACE_TILE_METRES);
    return sampleFields(x, z, sampleEarthThatch(x, z));
}

export function createEarthSurfaceDetail(quality = 'high') {
    const size = quality === 'low' ? 128 : 256, data = new Uint8Array(size * size * 4), thatch = rasterizeThatch(size);
    for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) {
        const sample = sampleFields(x * EARTH_SURFACE_TILE_METRES / size, z * EARTH_SURFACE_TILE_METRES / size, thatch[z * size + x]);
        for (let channel = 0; channel < 4; channel++) data[(z * size + x) * 4 + channel] = Math.round(clamp(sample[channel]) * 255);
    }
    const texture = new DataTexture(data, size, size);
    texture.name = `Gloamwood physical soil, stone and moss:${quality}`;
    texture.colorSpace = NoColorSpace; texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.magFilter = LinearFilter; texture.minFilter = LinearMipmapLinearFilter;
    texture.generateMipmaps = true; texture.needsUpdate = true;
    texture.userData.earthSurfaceDetail = true; texture.userData.tileMetres = EARTH_SURFACE_TILE_METRES;
    return texture;
}
