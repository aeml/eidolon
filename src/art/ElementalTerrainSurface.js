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
    const grit = noise(x, y, 43, seed ^ 0x493f);
    const weathering = noise(x, y, 7, seed ^ 0x7319);
    // Warped, elongated mineral beds break into irregular ledges rather than
    // parallel sinusoidal ripples or a cellular paving grid. Integer domain
    // frequencies keep the same continuous geology across the tile boundary.
    const bed = noise(x + Math.sin(y * turn) * 8, y * 3, 7, seed ^ 0x325a);
    const strata = smooth(.4, .62, bed) * (1 - smooth(.28, .72, weathering));
    // Dust lies in interrupted wind-aligned streaks, not round bright clouds.
    // Keep the physical bedding directional and its color contrast restrained.
    const drift = noise(x + Math.sin(y * turn * 2) * 7, y * 4, 3, seed ^ 0x1491);
    const cover = smooth(.32, .7, drift + (noise(x, y, 11, seed ^ 0x529b) - .5) * .12);
    const mineral = .24 + grit * .15 + strata * .19;
    const dark = [58, 57, 64], light = [100, 98, 107], dust = [123, 120, 131];
    const grain = hash(Math.floor(x), Math.floor(y), seed ^ 0xab3);
    const color = dark.map((value, i) => {
        const rock = value + (light[i] - value) * mineral;
        return Math.round(rock + (dust[i] - rock) * cover * .18 + (grain - .5) * 1.5);
    });
    return { color, cover, strata,
        height: .24 + strata * .038 + grit * .018 + cover * .026,
        roughness: .73 + cover * .2 + grit * .018 };
}

function sampleWeatheredIce(x, y, seed) {
    const turn = Math.PI * 2 / 256;
    const grit = noise(x, y, 43, seed ^ 0x493f);
    const bed = noise(x + Math.sin(y * turn) * 12, y * 2, 9, seed ^ 0x612b);
    const weathering = noise(x, y, 7, seed ^ 0x173f);
    // Wind lays rime in elongated, broken beds instead of high-contrast round
    // clouds. Integer-frequency warps preserve the seamless canonical domain.
    const drift = noise(x + Math.sin(y * turn * 2) * 9, y * 3, 3, seed ^ 0x1491);
    const cover = smooth(.32, .72, drift + (noise(x, y, 11, seed ^ 0x724b) - .5) * .16);
    // Ice and wind-deposited rime share a field across all three maps. Broken
    // pressure lines are recessed, not a regular outline around paving cells.
    const ice = smooth(.24, .68, bed) * (1 - cover * .94);
    const cx = Math.floor(x / 32), cy = Math.floor(y / 32);
    const direction = hash(cx, cy, seed ^ 0x8391) * Math.PI * 2;
    const dx = x % 32 - (8 + hash(cx, cy, seed ^ 0x493b) * 16);
    const dy = y % 32 - (8 + hash(cx, cy, seed ^ 0x73a1) * 16);
    const along = dx * Math.cos(direction) + dy * Math.sin(direction);
    const across = -dx * Math.sin(direction) + dy * Math.cos(direction);
    // Each tapered fissure stays inside its cell; no seam-spanning network or
    // closed noise contour. Offset branches and deposition break its continuity.
    const bend = Math.max(0, along) * .14;
    const fracture = (1 - smooth(.12, .8, Math.abs(across - bend)))
        * smooth(0, .3, 1 - Math.abs(along) / 10)
        * smooth(0, 3, Math.min(x % 32, y % 32, 32 - x % 32, 32 - y % 32))
        * smooth(.3, .65, weathering) * (1 - cover * .92);
    const rock = [63, 77, 87], sheet = [76, 92, 104], rime = [121, 133, 138];
    const color = rock.map((value, i) => {
        const base = (value + (sheet[i] - value) * ice + grit * 5) * (1 - fracture * .13);
        return Math.round(base + (rime[i] - base) * cover * .22);
    });
    return { color, cover, ice, fracture,
        height: .24 + grit * .018 + ice * .024 + cover * .036 - fracture * .025,
        roughness: .69 - ice * .085 + cover * .25 + grit * .015 };
}

function sampleCooledBasalt(x, y, seed) {
    const turn = Math.PI * 2 / 256;
    const broad = noise(x, y, 5, seed ^ 0x1491), grit = noise(x, y, 43, seed ^ 0x493f);
    const cover = smooth(.36, .7, broad);
    // Cooled flows form folded, broken crust instead of a cell-edge network
    // that resembles town paving. Integer domain frequencies preserve seams.
    const bed = noise(x + Math.sin(y * turn * 3) * 10,
        y * 2 + Math.sin(x * turn) * 7, 7, seed ^ 0x19af);
    const weathering = noise(x, y, 9, seed ^ 0x74a1);
    const crust = smooth(.3, .67, bed) * (1 - smooth(.36, .82, weathering) * .65);
    const flow = smooth(.3, .7, noise(x + Math.sin(y * turn) * 12, y * 3, 7, seed ^ 0x2c71));
    // Vesicles are shallow recessed scoria pores, not bright pebble confetti.
    // Ash fills them: all three maps use exactly the same deposition mask.
    const pores = (1 - smooth(.16, .4, noise(x, y, 71, seed ^ 0x613b))) * (1 - cover * .9);
    const grain = hash(Math.floor(x), Math.floor(y), seed ^ 0xab3);
    const mineral = .14 + grit * .28 + crust * .34 + flow * .1;
    const dark = [39, 40, 40], light = [84, 81, 75], deposit = [108, 100, 87];
    const color = dark.map((value, i) => {
        const rock = (value + (light[i] - value) * mineral) * (1 - pores * .1);
        return Math.round(rock + (deposit[i] - rock) * cover * .72 + (grain - .5) * 2);
    });
    return { color, cover, crust, flow, pores,
        height: .23 + crust * .058 + flow * .018 + grit * .022 - pores * .045 + cover * .06,
        roughness: .76 + cover * .18 + grit * .018 + pores * .025 - crust * .045 };
}

export function sampleElementalTerrain(x, y, realm, seed) {
    if (!['water', 'fire', 'air'].includes(realm)) throw new TypeError(`Unsupported elemental surface: ${realm}`);
    x = wrap(x, 256); y = wrap(y, 256);
    if (realm === 'air') return sampleWindWornSlate(x, y, seed);
    if (realm === 'water') return sampleWeatheredIce(x, y, seed);
    return sampleCooledBasalt(x, y, seed);
}
