// Seamless, original surface fields in a canonical 256-texel domain. High and
// Low sample the same geology; albedo, relief and roughness describe one surface.
// These are flush material variations, never false cliffs or glowing hazards.
const clamp = v => Math.max(0, Math.min(1, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const wrap = (value, period) => ((value % period) + period) % period;
function hash(x, y, seed) {
    let n = Math.imul(x + 137, 1597334677) ^ Math.imul(y + 83, 3812015801) ^ seed;
    n = Math.imul(n ^ n >>> 16, 2246822519);
    return ((n ^ n >>> 13) >>> 0) / 4294967296;
}
function noise(x, y, cells, seed) {
    const px = x / 256 * cells, py = y / 256 * cells;
    const ix = Math.floor(px), iy = Math.floor(py), u = smooth(0, 1, px - ix), v = smooth(0, 1, py - iy);
    const at = (a, b) => hash(wrap(a, cells), wrap(b, cells), seed);
    const a = at(ix, iy), b = at(ix + 1, iy), c = at(ix, iy + 1), d = at(ix + 1, iy + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function sampleWindWornSlate(x, y, seed) {
    const turn = Math.PI * 2 / 256;
    const broad = noise(x, y, 5, seed ^ 0x1491), grit = noise(x, y, 43, seed ^ 0x493f);
    const weathering = noise(x, y, 7, seed ^ 0x7319);
    // Warped, elongated mineral beds break into irregular ledges rather than
    // parallel sinusoidal ripples or a cellular paving grid. Integer domain
    // frequencies keep the same continuous geology across the tile boundary.
    const bed = noise(x + Math.sin(y * turn) * 8, y * 3, 7, seed ^ 0x325a);
    const strata = smooth(.4, .62, bed) * (1 - smooth(.28, .72, weathering));
    const cover = smooth(.36, .7, broad);
    const mineral = .22 + grit * .24 + strata * .28;
    const dark = [58, 57, 64], light = [100, 98, 107], dust = [123, 120, 131];
    const grain = hash(Math.floor(x), Math.floor(y), seed ^ 0xab3);
    const color = dark.map((value, i) => {
        const rock = value + (light[i] - value) * mineral;
        return Math.round(rock + (dust[i] - rock) * cover * .36 + (grain - .5) * 2);
    });
    return { color, cover, strata,
        height: .24 + strata * .068 + grit * .045 + cover * .024,
        roughness: .72 + cover * .23 + grit * .025 };
}

export function sampleElementalTerrain(x, y, realm, seed) {
    if (!['water', 'fire', 'air'].includes(realm)) throw new TypeError(`Unsupported elemental surface: ${realm}`);
    const frost = realm === 'water';
    x = wrap(x, 256); y = wrap(y, 256);
    if (realm === 'air') return sampleWindWornSlate(x, y, seed);
    const turn = Math.PI * 2 / 256;
    // Anisotropic, warped fragments, rather than uniform hexagons. Domain warp
    // is periodic so the texture seam is no more visible than any other joint.
    const px = x / 256 * 19 + Math.sin(y * turn * 3) * .24;
    const py = y / 256 * 13 + Math.sin(x * turn * 2 + y * turn) * .2;
    const cx = Math.floor(px), cy = Math.floor(py);
    let nearest = Infinity, second = Infinity, plate = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const ix = cx + dx, iy = cy + dy, wx = wrap(ix, 19), wy = wrap(iy, 13);
        // Bounded jitter retains complete nearest-neighbor coverage in 3x3.
        const ox = .2 + hash(wx, wy, seed) * .6, oy = .2 + hash(wx, wy, seed ^ 0x74a1) * .6;
        const distance = Math.hypot(px - ix - ox, py - iy - oy);
        if (distance < nearest) {
            second = nearest; nearest = distance; plate = hash(wx, wy, seed ^ 0x19af);
        } else if (distance < second) second = distance;
    }
    const broad = noise(x, y, 5, seed ^ 0x1491), grit = noise(x, y, 43, seed ^ 0x493f);
    const cover = smooth(.36, .7, broad); // frost/ash accumulates in broad beds
    // Interrupt fractures with weathering. A full cellular outline reads as
    // laid paving, not weathered basalt, especially at ordinary gameplay zoom.
    const seam = (1 - smooth(.005, .11, second - nearest)) * (1 - cover * .9) * smooth(.38, .72, grit);
    const grain = hash(Math.floor(x), Math.floor(y), seed ^ 0xab3);
    const mineral = .3 + plate * .14 + grit * .18;
    const dark = frost ? [49, 60, 68] : [43, 43, 42];
    const light = frost ? [87, 100, 106] : [76, 71, 65];
    const deposit = frost ? [126, 138, 140] : [96, 88, 76];
    const color = dark.map((value, i) => {
        const rock = (value + (light[i] - value) * mineral) * (1 - seam * .12);
        return Math.round(rock + (deposit[i] - rock) * cover * .66 + (grain - .5) * 3);
    });
    return { color, cover,
        height: .24 + grit * .045 - seam * .028 + cover * .06,
        roughness: frost ? .62 + cover * .34 + grit * .025 : .8 + cover * .17 + grit * .025 };
}
