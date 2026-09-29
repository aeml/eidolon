import fs from 'node:fs';
import { createEarthLocations } from '../src/art/ProceduralEarthLocations.js';
import { createElementalLocations } from '../src/art/ProceduralElementalLocations.js';
import { WORLD_READINGS } from '../src/data/worldPopulation.js';
import { PROCEDURAL_FOLIAGE_RECIPES, createProceduralFoliagePlacements } from '../src/data/worldFoliage.js';

// Spawn exclusion is derived from the same solid footprints as the rendered
// environment. It is not an overworld movement validator or a new safe zone.
const scenes = [createEarthLocations(), ...['water', 'fire', 'air'].map(realm => createElementalLocations(realm))];
const footprints = scenes.flatMap(scene => scene.userData.walkFootprints).map(({ siteId, x, z, width, depth }) =>
    ({ siteId, x, z, width, depth }));
// Trees already block local walking and admin landings. Use those same trunk
// bounds for ordinary enemy spawn exclusion, including the composed woodlands.
for (const recipe of PROCEDURAL_FOLIAGE_RECIPES.filter(recipe => recipe.collision)) {
    createProceduralFoliagePlacements(recipe).forEach((placement, index) => {
        const width = recipe.collision[0] * 2 * placement.scale;
        footprints.push({ siteId: `tree:${recipe.id}:${index}`, x: placement.x, z: placement.z, width, depth: width });
    });
}
const readings = WORLD_READINGS.map(({ id, name, x, z }) => ({ id, name, x, z }));
const output = `${JSON.stringify({ schemaVersion: 1, footprints, readings }, null, 2)}\n`;
const target = new URL('../server/internal/game/content/world-population-footprints.json', import.meta.url);
if (process.argv.includes('--check')) {
    if (fs.readFileSync(target, 'utf8') !== output) throw new Error('Stale world population spawn footprints');
} else fs.writeFileSync(target, output);
console.log(`Verified ${footprints.length} world scenery spawn exclusions and ${readings.length} optional readings.`);
