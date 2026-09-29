// Original, periodic masonry field in the dungeon's canonical 64-unit tile.
// Albedo stains, physical bevels and roughness are separate signals.
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = (a, b, value) => { const t = clamp((value - a) / (b - a)); return t * t * (3 - 2 * t); };
const wrap = (value, period) => ((value % period) + period) % period;
const hash = (x, y) => {
    let n = Math.imul(x + 91, 1597334677) ^ Math.imul(y + 17, 3812015801);
    n = Math.imul(n ^ n >>> 16, 2246822519);
    return ((n ^ n >>> 13) >>> 0) / 4294967296;
};
function noise(x, y, period) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const u = smooth(0, 1, x - ix), v = smooth(0, 1, y - iy);
    const at = (a, b) => hash(wrap(a, period), wrap(b, period));
    const a = at(ix, iy), b = at(ix + 1, iy), c = at(ix, iy + 1), d = at(ix + 1, iy + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const FLOOR_ROWS = [4, 6, 5, 7, 4, 6, 5, 7, 4, 5, 5, 6];
const FLOOR_WIDTHS = [7, 11, 6, 8, 9, 5, 10, 8];
function band(value, widths, turn = 0) {
    let start = 0;
    for (let index = 0; index < widths.length; index++) {
        const size = widths[(index + turn) % widths.length];
        if (value < start + size) return { index, size, offset: value - start };
        start += size;
    }
    throw new RangeError('Masonry coordinate outside its periodic tile');
}

export function sampleVerdantMasonry(x, y, wall = false) {
    x = wrap(x, 64); y = wrap(y, 64);
    const course = wall ? { index: Math.floor(y / 4), size: 4, offset: y % 4 } : band(y, FLOOR_ROWS);
    const height = course.size, row = course.index;
    const shifted = x + (row % 2) * 4 + (hash(row, 13) - .5) * 1.1;
    const block = wall ? { index: Math.floor(wrap(shifted, 64) / 8), size: 8, offset: wrap(shifted, 8) }
        : band(wrap(shifted, 64), FLOOR_WIDTHS, row % FLOOR_WIDTHS.length);
    const column = block.index, u = block.offset, v = course.offset;
    const stone = hash(wrap(column, 8), row);
    const dx = Math.min(u, block.size - u), dy = Math.min(v, height - v);
    const corner = .22 + stone * .28;
    const edge = Math.min(dx, dy, (dx + dy - corner) * .707);
    const bevel = smooth(.08, .42, edge);
    const weather = noise(x / 8, y / 8, 8);
    const grain = noise(x * 4, y * 4, 256);
    const erosion = noise(x / 2, y / 2, 32);
    // Short interrupted cleaves within some slabs, not a second tile grid.
    const crackLine = Math.abs(v / height - .25 - stone * .35 - (u / block.size - .5) * (stone - .5)
        - Math.sin(u * 1.7 + stone * 11) * .025);
    const fracture = stone > .55 ? (1 - smooth(.006, .025, crackLine))
        * smooth(.28, .65, erosion) * bevel : 0;
    const moss = smooth(.52, .82, weather) * (1 - bevel * .8) * .7;
    const tone = .45 + stone * .25 + weather * .2 + grain * .1;
    const mortar = [46, 49, 45], shadow = [59, 62, 59], light = [91, 93, 85], growth = [48, 60, 37];
    const color = mortar.map((joint, index) => {
        const face = shadow[index] + (light[index] - shadow[index]) * tone;
        const worn = (joint + (face - joint) * (.35 + bevel * .65))
            * (.9 + erosion * .18) * (1 - fracture * .24);
        return Math.round(worn + (growth[index] - worn) * moss);
    });
    return { color, emissive: 0,
        relief: .35 + bevel * (.14 + stone * .02) + grain * .006 - fracture * .025,
        roughness: .98 - bevel * (.12 + stone * .03) };
}
