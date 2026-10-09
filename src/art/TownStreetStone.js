// Canonical256-texel field shared by street albedo, relief and roughness.
// Unequal courses and rotated slab runs close over the same tile; no geometry,
// walkable height, decals or extra shader samples are introduced.
const ROWS = Object.freeze([28, 36, 26, 34, 32, 30, 38, 32]);
const SLABS = Object.freeze([40, 52, 36, 48, 44, 36]);
const wrap = value => ((value % 256) + 256) % 256;
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = (a, b, value) => { const t = clamp((value - a) / (b - a)); return t * t * (3 - 2 * t); };

function band(value, widths, turn = 0) {
    let start = 0;
    for (let index = 0; index < widths.length; index++) {
        const width = widths[(index + turn) % widths.length];
        if (value < start + width) return { index, width, offset: value - start };
        start += width;
    }
    throw new RangeError('Street coordinate outside its periodic tile');
}

function stoneHash(column, row, seed) {
    let value = Math.imul(column + 431, 374761393) ^ Math.imul(row + 79, 668265263) ^ seed;
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

export function sampleTownStreetStone(x, y, size = 256, seed = 0x14a7b0d3) {
    const px = wrap(x * 256 / size), py = wrap(y * 256 / size);
    const turn = Math.PI * 2 / 256;
    // Place the texture boundary within a face, not along an entire course
    // joint. The field still wraps exactly; this avoids a repeat-wide stripe.
    const row = band(wrap(py + 17 + Math.sin(px * turn * 3) * .6), ROWS);
    const slab = band(wrap(px + 13 + row.index * 21.7 + Math.sin(py * turn * 2) * .7), SLABS,
        row.index % SLABS.length);
    const stoneNoise = stoneHash(slab.index, row.index, seed);
    const dx = Math.min(slab.offset, slab.width - slab.offset);
    const dy = Math.min(row.offset, row.width - row.offset);
    const edge = Math.min(dx, dy, (dx + dy - (1.5 + stoneNoise * 2.2)) * .707);
    const u = slab.offset / slab.width, v = row.offset / row.width;
    const cleave = Math.abs(v - .26 - stoneNoise * .34 - (u - .5) * (stoneNoise - .5)
        - Math.sin(u * 14 + stoneNoise * 19) * .018);
    const fracture = stoneNoise > .7 ? (1 - smooth(.006, .023, cleave)) *
        smooth(.15, .3, u) * (1 - smooth(.7, .85, u)) : 0;
    return { px, py, row: row.index, column: slab.index, width: slab.width,
        height: row.width, stoneNoise, edge, fracture };
}
