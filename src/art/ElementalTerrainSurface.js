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

function sampleWeatheredIce(x, y, seed) {
    const turn = Math.PI * 2 / 256;
    const broad = noise(x, y, 5, seed ^ 0x1491);
    const grit = noise(x, y, 43, seed ^ 0x493f);
    const bed = noise(x + Math.sin(y * turn) * 12, y * 2, 9, seed ^ 0x612b);
    const weathering = noise(x, y, 7, seed ^ 0x173f);
    const cover = smooth(.36, .7, broad + (noise(x, y, 19, seed ^ 0x724b) - .5) * .12);
    // Ice and wind-deposited rime share a field across all three maps. Broken
    // pressure lines are recessed, not a regular outline around paving cells.
    const ice = smooth(.24, .68, bed) * (1 - cover * .94);
    const cx = Math.floor(x / 32), cy = Math.floor(y / 32);
    const direction = hash(cx, cy, seed ^ 0x8391) * Math.PI * 2;
    const dx = x % 32 - 16, dy = y % 32 - 16;
    const along = dx * Math.cos(direction) + dy * Math.sin(direction);
    const across = -dx * Math.sin(direction) + dy * Math.cos(direction);
    // Each tapered fissure stays inside its cell; no seam-spanning network or
    // closed noise contour. Offset branches and deposition break its continuity.
    const bend = Math.max(0, along) * .14;
    const fracture = (1 - smooth(.12, .8, Math.abs(across - bend)))
        * smooth(0, .3, 1 - Math.abs(along) / 13)
        * smooth(.3, .65, weathering) * (1 - cover * .92);
    const rock = [48, 59, 65], sheet = [69, 87, 96], rime = [127, 139, 142];
    const color = rock.map((value, i) => {
        const base = (value + (sheet[i] - value) * ice + grit * 5) * (1 - fracture * .13);
        return Math.round(base + (rime[i] - base) * cover * .66);
    });
    return { color, cover, ice, fracture,
        height: .24 + grit * .022 + ice * .018 + cover * .065 - fracture * .025,
        roughness: .7 - ice * .085 + cover * .25 + grit * .015 };
}

export function sampleElementalTerrain(x, y, realm, seed) {
    if (!['water', 'fire', 'air'].includes(realm)) throw new TypeError(`Unsupported elemental surface: ${realm}`);
    x = wrap(x, 256); y = wrap(y, 256);
    if (realm === 'air') return sampleWindWornSlate(x, y, seed);
    if (realm === 'water') return sampleWeatheredIce(x, y, seed);
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
    const cover = smooth(.36, .7, broad); // ash accumulates in broad beds
    // Interrupt fractures with weathering. A full cellular outline reads as
    // laid paving, not weathered basalt, especially at ordinary gameplay zoom.
    const seam = (1 - smooth(.005, .11, second - nearest)) * (1 - cover * .9) * smooth(.38, .72, grit);
    const grain = hash(Math.floor(x), Math.floor(y), seed ^ 0xab3);
    const mineral = .3 + plate * .14 + grit * .18;
    const dark = [43, 43, 42];
    const light = [76, 71, 65];
    const deposit = [96, 88, 76];
    const color = dark.map((value, i) => {
        const rock = (value + (light[i] - value) * mineral) * (1 - seam * .12);
        return Math.round(rock + (deposit[i] - rock) * cover * .66 + (grain - .5) * 3);
    });
    return { color, cover,
        height: .24 + grit * .045 - seam * .028 + cover * .06,
        roughness: .8 + cover * .17 + grit * .025 };
}
