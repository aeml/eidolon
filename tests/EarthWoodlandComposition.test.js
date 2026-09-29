import { readFileSync } from 'node:fs';
import { PROCEDURAL_FOLIAGE_RECIPES, createProceduralFoliagePlacements } from '../src/data/worldFoliage.js';
import { EARTH_LOCATIONS, EARTH_PATHS, distanceToPath } from '../src/data/worldPopulation.js';
import { createConiferBoughGeometry } from '../src/art/ProceduralConiferBoughs.js';

const recipes = PROCEDURAL_FOLIAGE_RECIPES.filter(recipe => recipe.region === 'earth');
const trees = recipes.flatMap(recipe => createProceduralFoliagePlacements(recipe).map((tree, index) => ({
    ...tree, id: `tree:${recipe.id}:${index}`, radius: recipe.collision[0] * tree.scale
})));

test('woodland stands preserve total population, open routes and spaced trunks', () => {
    expect(trees).toHaveLength(330);
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
    expect(positions.count / 3).toBe(420);
    expect(positions.count).toBeGreaterThan(300);
    expect([...positions.array, ...geometry.attributes.normal.array, ...geometry.attributes.color.array].every(Number.isFinite)).toBe(true);
    expect(geometry.attributes.color.count).toBe(positions.count);
    expect(geometry.boundingBox.min.y).toBeGreaterThan(-1.8);
    expect(geometry.boundingBox.max.y).toBeLessThan(1.7);
    expect(geometry.boundingSphere.radius).toBeLessThan(2.6);
    geometry.dispose();
});
