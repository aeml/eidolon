// Original periodic stonework in the dungeon's 64-unit material domain.
// Stains/inscriptions affect color, not raised geometry or combat hazards.
import { sampleDungeonFlagstone } from './DungeonFlagstone.js';
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = (a, b, value) => { const t = clamp((value - a) / (b - a)); return t * t * (3 - 2 * t); };
const wrap = (value, period) => ((value % period) + period) % period;
const seeds = { molten_core: 0x41a6, tempest_spire: 0x19ef, abyssal_well: 0x7381, umbral_nexus: 0x4b31 };
function hash(x, y, seed) {
    let n = Math.imul(x + 91, 1597334677) ^ Math.imul(y + 17, 3812015801) ^ seed;
    n = Math.imul(n ^ n >>> 16, 2246822519);
    return ((n ^ n >>> 13) >>> 0) / 4294967296;
}
function noise(x, y, cells, seed) {
    const px = x / 64 * cells, py = y / 64 * cells, ix = Math.floor(px), iy = Math.floor(py);
    const u = smooth(0, 1, px - ix), v = smooth(0, 1, py - iy);
    const at = (a, b) => hash(wrap(a, cells), wrap(b, cells), seed);
    const a = at(ix, iy), b = at(ix + 1, iy), c = at(ix, iy + 1), d = at(ix + 1, iy + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function sampleElementalDungeonSurface(x, y, type, wall, palette) {
    const seed = seeds[type];
    if (seed === undefined) throw new TypeError(`Unsupported dungeon stone: ${type}`);
    x = wrap(x, 64); y = wrap(y, 64);
    const rowHeight = wall ? 8 : 16, row = Math.floor(y / rowHeight);
    const shifted = wrap(x + (row % 2) * 8 + (hash(row, 7, seed) - .5) * 1.3, 64);
    const column = Math.floor(shifted / 16), u = shifted % 16, v = y % rowHeight;
    const flagstone = wall ? null : sampleDungeonFlagstone(x, y, type);
    const stone = wall ? hash(column, row, seed) : flagstone.stone;
    const weather = noise(x, y, 5, seed ^ 0x3391);
    const grain = noise(x, y, 64, seed ^ 0x19f3);
    const edge = Math.min(u, 16 - u, v, rowHeight - v) + (grain - .5) * .08;
    const bevel = wall ? smooth(.04, .36, edge) : flagstone.bevel;
    const turn = Math.PI * 2 / 64;
    // Small mineral variations survive gameplay zoom without a checkerboard
    // of unrelated bright stones. Mortar is worn, not perfectly black.
    const base = palette.shadow.map((value, i) => value +
        ((wall ? palette.midtone[i] : palette.ground[i]) - value) * (wall ? .48 : .72));
    const tone = .88 + stone * .12 + weather * .08 + grain * .025;
    const color = base.map(value => value * tone * ((wall ? .75 : .87) + bevel * (wall ? .25 : .13))
        * (1 - (flagstone?.fracture || 0) * .09));
    let mark = 0, emissive = 0, tint = palette.accent;
    const node = (cx, cy, radius) => 1 - smooth(radius * .35, radius, Math.hypot(x - cx, y - cy));
    if (type === 'molten_core') {
        const distance = Math.abs(x - (33 + Math.sin(y * turn * 2) * 7 + Math.sin(y * turn * 5) * 1.2));
        mark = (1 - smooth(.12, .55, distance)) * smooth(.28, .62, weather);
        emissive = mark * (wall ? .2 : .025);
    } else if (type === 'abyssal_well') {
        const tide = 1 - smooth(.14, .5, Math.abs(y - (32 + Math.sin(x * turn) * 5)));
        const pearl = wall ? Math.max(node(12, 18, .8), node(39, 47, .7), node(52, 12, .7)) : 0;
        mark = Math.max(tide * .45, pearl);
        emissive = wall ? Math.max(tide * .16, pearl * .28) : tide * .012;
    } else if (type === 'tempest_spire') {
        const conductor = 1 - smooth(.1, .4, Math.abs(wrap(x - y + 32, 64) - 32));
        const terminal = Math.max(node(16, 16, .9), node(48, 48, .9));
        mark = Math.max(conductor * .35, terminal);
        emissive = wall ? Math.max(conductor * .045, terminal * .24) : terminal * .025;
        tint = palette.midtone;
    } else {
        const distance = Math.abs(x - (31 + Math.sin(y * turn * 2) * 10));
        const cleave = (1 - smooth(.1, .48, distance)) * smooth(.32, .67, weather);
        const stars = Math.max(node(11, 22, .65), node(48, 45, .7), node(22, 51, .65));
        mark = Math.max(cleave, stars * .6);
        emissive = mark * (wall ? .25 : .025);
    }
    const amount = mark * (wall ? .32 : .08);
    return { color: color.map((value, i) => Math.round(value + (tint[i] - value) * amount)),
        emissive, mark, bevel,
        relief: .4 + bevel * (.055 + stone * .008) + grain * .001,
        roughness: .96 - bevel * (.09 + stone * .035) + weather * .01 };
}
