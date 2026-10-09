import { jest } from '@jest/globals';
import { drawAtlasFoliageGlyph } from '../src/ui/AtlasFoliageGlyphs.js';
import { PROCEDURAL_FOLIAGE_RECIPES } from '../src/data/worldFoliage.js';

const context = () => Object.fromEntries(['beginPath', 'moveTo', 'lineTo', 'closePath', 'fill', 'stroke'].map(k => [k, jest.fn()]));
const ink = ['#111', '#555', '#aaa'];

test.each(PROCEDURAL_FOLIAGE_RECIPES.map(r => [r.id]))('%s has a bounded authored symbol at desktop and phone tile scales', species => {
    for (const size of [1.5, 6]) {
        const ctx = context();
        expect(drawAtlasFoliageGlyph(ctx, species, 100, 200, size, ink)).toBe(true);
        const points = [...ctx.moveTo.mock.calls, ...ctx.lineTo.mock.calls];
        expect(points.length).toBeGreaterThan(3); expect(points.length).toBeLessThanOrEqual(24);
        for (const [x, y] of points) {
            expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
            expect(Math.abs(x - 100)).toBeLessThanOrEqual(size);
            expect(Math.abs(y - 200)).toBeLessThanOrEqual(size);
        }
        expect(ctx.stroke).toHaveBeenCalledTimes(2);
        expect(ctx.fillStyle).toBe(ink[1]); expect(ctx.strokeStyle).toBe(ink[2]);
    }
});

test('seven physical foliage families have distinct path silhouettes, not one generic tree', () => {
    const signatures = PROCEDURAL_FOLIAGE_RECIPES.map(({ id }) => {
        const ctx = context(); drawAtlasFoliageGlyph(ctx, id, 0, 0, 1, ink);
        return JSON.stringify([ctx.moveTo.mock.calls, ctx.lineTo.mock.calls]);
    });
    expect(new Set(signatures).size).toBe(7);
});

test('storm crystals have diamond facets; dead Fire snags have open branches rather than a filled canopy', () => {
    const crystal = context(), snag = context();
    drawAtlasFoliageGlyph(crystal, 'storm_crystal', 0, 0, 1, ink);
    expect(crystal.moveTo.mock.calls[0]).toEqual([0, -1]);
    expect(crystal.lineTo.mock.calls.slice(0, 3)).toEqual([[.6, -.25], [0, .8], [-.6, -.25]]);
    expect(crystal.fill).toHaveBeenCalledTimes(1);
    drawAtlasFoliageGlyph(snag, 'ember_snag', 0, 0, 1, ink);
    expect(snag.fill).not.toHaveBeenCalled(); expect(snag.closePath).not.toHaveBeenCalled();
});

test('an unknown future species retains the original triangular fallback', () => {
    const ctx = context();
    expect(drawAtlasFoliageGlyph(ctx, 'unknown', 10, 20, 2, ink)).toBe(false);
    expect(ctx.moveTo).toHaveBeenCalledWith(10, 18);
    expect(ctx.lineTo.mock.calls).toEqual([[11.4, 21], [8.6, 21]]);
    expect(ctx.fill).toHaveBeenCalledTimes(1); expect(ctx.stroke).toHaveBeenCalledTimes(1);
});
