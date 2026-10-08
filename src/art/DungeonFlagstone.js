// Original coursed flagstones. Each family closes exactly over the 64-unit
// texture domain, so all PBR channels share joints without a repeat seam.
const courses = {
    verdant_bastion_catacombs: [[6, 10, 7, 9, 6, 8, 9, 9], [8, 11, 7, 13, 9, 16]],
    molten_core: [[8, 6, 11, 7, 9, 10, 6, 7], [12, 9, 14, 7, 10, 12]],
    tempest_spire: [[5, 7, 6, 8, 5, 7, 6, 8, 5, 7], [7, 10, 6, 9, 11, 8, 13]],
    abyssal_well: [[9, 8, 12, 7, 10, 8, 10], [10, 15, 9, 14, 16]],
    umbral_nexus: [[6, 11, 7, 10, 8, 9, 13], [13, 8, 17, 10, 16]]
};
const wrap = value => ((value % 64) + 64) % 64;
const smooth = (a, b, value) => {
    const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
    return t * t * (3 - 2 * t);
};
function band(value, widths, turn = 0) {
    let start = 0;
    for (let index = 0; index < widths.length; index++) {
        const size = widths[(index + turn) % widths.length];
        if (value < start + size) return { index, size, offset: value - start };
        start += size;
    }
    throw new RangeError('Flagstone coordinate outside its periodic tile');
}
function hash(x, y) {
    let n = Math.imul(x + 91, 1597334677) ^ Math.imul(y + 17, 3812015801);
    n = Math.imul(n ^ n >>> 16, 2246822519);
    return ((n ^ n >>> 13) >>> 0) / 4294967296;
}

export function sampleDungeonFlagstone(x, y, type) {
    const pattern = courses[type];
    if (!pattern) throw new TypeError(`Unsupported flagstone family: ${type}`);
    x = wrap(x); y = wrap(y);
    // Very small continuous irregularities, not rippling tile-sized warps.
    const turn = Math.PI * 2 / 64;
    const row = band(wrap(y + .14 * Math.sin(x * turn * 3)), pattern[0]);
    const shifted = wrap(x + row.index * 3.7 + .16 * Math.sin(y * turn * 5));
    const slab = band(shifted, pattern[1], row.index % pattern[1].length);
    const stone = hash(slab.index, row.index);
    const dx = Math.min(slab.offset, slab.size - slab.offset);
    const dy = Math.min(row.offset, row.size - row.offset);
    // Rounded/chipped corners and interrupted hairline cleaves stay physical:
    // never emissive, never a second grid, never raised collision geometry.
    const corner = .22 + stone * .42;
    const edge = Math.min(dx, dy, (dx + dy - corner) * .707);
    const bevel = smooth(.04, .58, edge);
    const u = slab.offset / slab.size, v = row.offset / row.size;
    const cleave = Math.abs(v - .24 - stone * .42 - (u - .5) * (stone - .5)
        - Math.sin(u * 14 + stone * 17) * .025);
    const fracture = stone > .64 ? (1 - smooth(.006, .023, cleave))
        * smooth(.12, .28, u) * (1 - smooth(.7, .91, u)) * bevel : 0;
    return { row: row.index, column: slab.index, width: slab.size, height: row.size,
        stone, bevel: bevel * (1 - fracture * .22), fracture };
}
