// Original, periodic masonry field in the dungeon's canonical 64-unit tile.
// Albedo stains, physical bevels and roughness are separate signals.
import { sampleDungeonFlagstone } from './DungeonFlagstone.js';
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

export function sampleVerdantMasonry(x, y, wall = false) {
    x = wrap(x, 64); y = wrap(y, 64);
    // Preserve the established wall courses. Floors use the shared irregular
    // flagstone field rather than generating a second, unused floor layout.
    const height = 4, row = Math.floor(y / height);
    const shifted = x + (row % 2) * 4 + (hash(row, 13) - .5) * 1.1;
    const column = Math.floor(wrap(shifted, 64) / 8), u = wrap(shifted, 8), v = y % height;
    const flagstone = wall ? null : sampleDungeonFlagstone(x, y, 'verdant_bastion_catacombs');
    const stone = wall ? hash(wrap(column, 8), row) : flagstone.stone;
    const dx = Math.min(u, 8 - u), dy = Math.min(v, height - v);
    const corner = .22 + stone * .28;
    const edge = Math.min(dx, dy, (dx + dy - corner) * .707);
    const bevel = wall ? smooth(.08, .42, edge) : flagstone.bevel;
    const weather = noise(x / 8, y / 8, 8);
    const grain = noise(x * 4, y * 4, 256);
    const erosion = noise(x / 2, y / 2, 32);
    // Short interrupted cleaves within some slabs, not a second tile grid.
    const crackLine = Math.abs(v / height - .25 - stone * .35 - (u / 8 - .5) * (stone - .5)
        - Math.sin(u * 1.7 + stone * 11) * .025);
    const fracture = wall ? (stone > .55 ? (1 - smooth(.006, .025, crackLine))
        * smooth(.28, .65, erosion) * bevel : 0) : flagstone.fracture;
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
