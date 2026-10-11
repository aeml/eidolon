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

// Short flattened blades give planted earth a fibrous surface between the
// existing standing plants. Their physical ridges share the moss channel;
// there are no extra texture fetches, meshes, baked highlights or wind clocks.
const TURF_CELLS = 24;
const TURF = Array.from({ length: TURF_CELLS * TURF_CELLS }, (_, index) => {
    const x = index % TURF_CELLS, z = Math.floor(index / TURF_CELLS);
    const tone = hash(x, z, 0x6327ac91);
    const angle = Math.sin(x * Math.PI * 2 / TURF_CELLS) * .8 +
        Math.cos(z * Math.PI * 4 / TURF_CELLS) * .6 + tone * 1.4;
    return { x: .15 + hash(x, z, 0x812376af) * .7,
        z: .15 + hash(x, z, 0x5b1473a1) * .7,
        blades: [-.55, 0, .45].map(turn => ({ cos: Math.cos(angle + turn), sin: Math.sin(angle + turn),
            length: .8 + tone * .3, width: .18 + hash(x, z, 0x4127f8a3) * .06, height: .55 + tone * .35 })) };
});
export function sampleEarthTurf(x, z) {
    const px = wrap(x, EARTH_SURFACE_TILE_METRES) / EARTH_SURFACE_TILE_METRES * TURF_CELLS;
    const pz = wrap(z, EARTH_SURFACE_TILE_METRES) / EARTH_SURFACE_TILE_METRES * TURF_CELLS;
    const cx = Math.floor(px), cz = Math.floor(pz);
    let height = 0;
    for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) {
        const ix = cx + ox, iz = cz + oz;
        const tuft = TURF[wrap(iz, TURF_CELLS) * TURF_CELLS + wrap(ix, TURF_CELLS)];
        const dx = px - ix - tuft.x, dz = pz - iz - tuft.z;
        for (const blade of tuft.blades) {
            const along = (dx * blade.cos + dz * blade.sin) / blade.length + .25;
            if (along <= 0 || along >= 1) continue;
            const across = -dx * blade.sin + dz * blade.cos - Math.sin(along * Math.PI) * .08;
            const radius = Math.abs(across) / (blade.width * (1 - along * .75));
            const shape = (1 - smooth(.1, 1, radius)) * smooth(0, .12, along) * (1 - smooth(.8, 1, along));
            height = Math.max(height, shape * blade.height);
        }
    }
    return height;
}

// R soil relief, G stone coverage, B moss/turf relief, A stone relief.
// No baked directional illumination or emission. Shader color/roughness and
// shallow normal relief consume these same registered physical features.
export function sampleEarthSurface(x, z) {
    x = wrap(x, EARTH_SURFACE_TILE_METRES); z = wrap(z, EARTH_SURFACE_TILE_METRES);
    const soil = sampleLayer(x, z, SOIL), stones = sampleLayer(x, z, STONES, true), moss = sampleLayer(x, z, MOSS);
    return [.24 + soil.height * .62, stones.coverage, .22 + moss.height * .48 + sampleEarthTurf(x, z) * .30, stones.height];
}

export function createEarthSurfaceDetail(quality = 'high') {
    const size = quality === 'low' ? 128 : 256, data = new Uint8Array(size * size * 4);
    for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) {
        const sample = sampleEarthSurface(x * EARTH_SURFACE_TILE_METRES / size, z * EARTH_SURFACE_TILE_METRES / size);
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
