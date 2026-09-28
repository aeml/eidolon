import fs from 'node:fs';
import { createEarthLocations } from '../src/art/ProceduralEarthLocations.js';
import { WORLD_READINGS } from '../src/data/worldPopulation.js';

// Spawn exclusion is derived from the same solid footprints as the rendered
// environment. It is not an overworld movement validator or a new safe zone.
const scene = createEarthLocations();
const footprints = scene.userData.walkFootprints.map(({ siteId, x, z, width, depth }) =>
    ({ siteId, x, z, width, depth }));
const readings = WORLD_READINGS.map(({ id, name, x, z }) => ({ id, name, x, z }));
const output = `${JSON.stringify({ schemaVersion: 1, footprints, readings }, null, 2)}\n`;
const target = new URL('../server/internal/game/content/world-population-footprints.json', import.meta.url);
if (process.argv.includes('--check')) {
    if (fs.readFileSync(target, 'utf8') !== output) throw new Error('Stale world population spawn footprints');
} else fs.writeFileSync(target, output);
console.log(`Verified ${footprints.length} Earth scenery spawn exclusions.`);
