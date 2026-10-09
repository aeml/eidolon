// Original engraved silhouettes, anchored to production foliage placements.
// These are map symbols, not new geography or collision footprints. Keep their
// detail bounded: static CPU tiles bake them once, never on marker updates.
const PINE = [
    [[0, -1], [.4, -.25], [.2, -.25], [.7, .5], [-.7, .5], [-.2, -.25], [-.4, -.25]],
    [[0, -.6], [0, 1]]
];
const BIRCH = [
    [[0, -1], [.4, -.9], [.6, -.5], [.7, 0], [.4, .5], [-.4, .5], [-.7, 0], [-.6, -.5], [-.4, -.9]],
    [[-.12, .25], [0, 1], [.12, .25]]
];
const WILLOW = [
    [[0, -.9], [.5, -.7], [.8, 0], [.7, .7], [.4, .2], [0, -.1], [-.4, .2], [-.7, .7], [-.8, 0], [-.5, -.7]],
    [[-.45, -.1], [-.45, .8], [-.45, -.1], [0, -.4], [0, 1], [0, -.4], [.45, -.1], [.45, .8]]
];
const SNAG = [
    [[0, 1], [-.1, -.35], [.15, -1]],
    [[-.1, -.15], [-.65, -.5], [-.55, -.9], [-.65, -.5], [-.8, -.4], [-.65, -.5], [-.1, -.15], [.6, -.5], [.75, -.9]]
];
const BRIAR = [
    [[-.75, .4], [-.5, -.15], [-.3, .1], [0, -.8], [.2, -.25], [.5, -.55], [.75, .4], [.15, .6], [-.15, .6]],
    [[-.5, .4], [0, .1], [.5, .4]]
];
const CYPRESS = [
    [[.45, -1], [.35, -.35], [.65, .15], [.4, .1], [.6, .55], [-.65, .55], [-.2, -.15], [.1, -.6]],
    [[-.1, .2], [-.15, 1]]
];
const CRYSTAL = [
    [[0, -1], [.6, -.25], [0, .8], [-.6, -.25]],
    [[0, -1], [0, .8], [0, -.25], [.6, -.25], [-.6, -.25]]
];

const GLYPHS = {
    ossuary_birch: BIRCH, grave_pine: PINE, mourning_willow: WILLOW,
    rime_pine: PINE, drowned_willow: WILLOW,
    ember_snag: SNAG, basalt_briar: BRIAR,
    gale_cypress: CYPRESS, storm_crystal: CRYSTAL
};
const FALLBACK = [[[0, -1], [.7, .5], [-.7, .5]]];

export function drawAtlasFoliageGlyph(ctx, species, x, y, size, ink) {
    const paths = GLYPHS[species] || FALLBACK;
    ctx.fillStyle = ink[1]; ctx.strokeStyle = ink[2]; ctx.lineWidth = .6;
    paths.forEach((points, index) => {
        ctx.beginPath();
        points.forEach(([dx, dy], i) => {
            const px = x + dx * size, py = y + dy * size;
            if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        });
        if (index === 0 && paths !== SNAG) { ctx.closePath(); ctx.fill(); }
        ctx.stroke();
    });
    return paths !== FALLBACK;
}
