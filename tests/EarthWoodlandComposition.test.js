import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PROCEDURAL_FOLIAGE_RECIPES, createProceduralFoliagePlacements, EARTH_ROADSIDE_TREES } from '../src/data/worldFoliage.js';
import { EARTH_LOCATIONS, EARTH_PATHS, distanceToPath } from '../src/data/worldPopulation.js';
import { createConiferBoughGeometry } from '../src/art/ProceduralConiferBoughs.js';

const recipes = PROCEDURAL_FOLIAGE_RECIPES.filter(recipe => recipe.region === 'earth');
const trees = recipes.flatMap(recipe => createProceduralFoliagePlacements(recipe).map((tree, index) => ({
    ...tree, id: `tree:${recipe.id}:${index}`, radius: recipe.collision[0] * tree.scale
})));

test('woodland edges preserve old placements and frame the road with staggered, clear trunks', () => {
    const original = recipes.map(recipe => [recipe.id, createProceduralFoliagePlacements(recipe).slice(0, recipe.coreCount)]);
    expect(createHash('sha256').update(JSON.stringify(original)).digest('hex'))
        .toBe('66a192eff99f8372e6c7bd716888da0dd1c30806bc608f78b616e11be235e1e7');
    expect(EARTH_ROADSIDE_TREES).toHaveLength(61);
    for (const anchor of EARTH_ROADSIDE_TREES.slice(0, 22)) {
        expect(trees.filter(tree => Math.hypot(tree.x - anchor.x, tree.z - anchor.z) < 16).length).toBeGreaterThanOrEqual(3);
    }
    // Every main-road interval now has framing on both sides, without a
    // symmetrical avenue or a trunk in the eight-metre travel corridor.
    for (const x of [240, 275, 345, 380, 420, 480, 555, 595, 640, 700]) {
        for (const side of [-1, 1]) expect(EARTH_ROADSIDE_TREES.some(tree =>
            Math.abs(tree.x - x) < 22 && (tree.z - 200) * side >= 17)).toBe(true);
    }
});

test('woodland stands and roadside additions keep open routes and spaced trunks', () => {
    expect(trees).toHaveLength(391);
    for (const [index, tree] of trees.entries()) {
        for (const other of trees.slice(index + 1)) expect(Math.hypot(tree.x - other.x, tree.z - other.z)).toBeGreaterThanOrEqual(7);
        for (const path of EARTH_PATHS) expect(distanceToPath(tree.x, tree.z, path.points) - tree.radius).toBeGreaterThan(path.width / 2 + 1.5);
        for (const site of EARTH_LOCATIONS) expect(Math.hypot(tree.x - site.x, tree.z - site.z))
            .toBeGreaterThan(site.id === 'first-grove-arch' ? 18 : site.radius + 3);
    }
    const grove = trees.filter(tree => Math.hypot(tree.x, tree.z + 260) < 55);
    expect(grove.length).toBeGreaterThanOrEqual(18);
    expect(grove.some(tree => tree.x < -20)).toBe(true);
    expect(grove.some(tree => tree.x > 20)).toBe(true);
});

test('server spawn exclusions match every client woodland trunk exactly', () => {
    const content = JSON.parse(readFileSync(new URL('../server/internal/game/content/world-population-footprints.json', import.meta.url), 'utf8'));
    const boxes = content.footprints.filter(box => box.siteId.startsWith('tree:'));
    expect(boxes).toHaveLength(trees.length);
    trees.forEach((tree, index) => expect(boxes[index]).toEqual({ siteId: tree.id, x: tree.x, z: tree.z,
        width: tree.radius * 2, depth: tree.radius * 2 }));
});

test('needle boughs have finite folded surfaces within a bounded reusable crown', () => {
    const geometry = createConiferBoughGeometry(), positions = geometry.attributes.position;
    expect(positions.count / 3).toBe(840);
    expect(positions.count).toBeGreaterThan(300);
    expect([...positions.array, ...geometry.attributes.normal.array, ...geometry.attributes.color.array].every(Number.isFinite)).toBe(true);
    expect(geometry.attributes.color.count).toBe(positions.count);
    expect(geometry.boundingBox.min.y).toBeGreaterThan(-1.8);
    expect(geometry.boundingBox.max.y).toBeLessThan(1.7);
    expect(geometry.boundingSphere.radius).toBeLessThan(2.6);
    geometry.dispose();
});
