import fs from 'node:fs';
import { EARTH_OUTCROP_COLLISIONS } from '../src/data/earthOutcrops.js';
import { compileRockSolids, moveAroundRockSolids, firstRockHit, stopAtRockSolids } from '../src/core/RockCollision.js';

// Candidate solids only. Generating this file does not enable world placement.
const solids = EARTH_OUTCROP_COLLISIONS;
const output = `${JSON.stringify({ schemaVersion: 1, solids }, null, 2)}\n`;
const target = new URL('../server/internal/game/content/earth-outcrops.json', import.meta.url);
if (process.argv.includes('--check')) {
    if (fs.readFileSync(target, 'utf8') !== output) throw new Error('Stale Earth outcrop solid data');
} else fs.writeFileSync(target, output);
console.log(`Verified ${solids.length} candidate outcrop polygons; runtime activation unchanged.`);

const compiled = compileRockSolids(solids), cases = [];
function addCase(name, start, end, radius = 1.25) {
    const a = { x: start[0], z: start[1] }, b = { x: end[0], z: end[1] };
    const point = moveAroundRockSolids(compiled, a, b, radius), hit = firstRockHit(compiled, a, b, radius);
    const stopped = stopAtRockSolids(compiled, a, b, radius);
    cases.push({ name, start, end, radius, position: [point.x, point.z],
        stopped: [stopped.x, stopped.z],
        hit: { at: hit.at, normal: [hit.normal.x, hit.normal.z], blocked: hit.hit } });
}
for (const solid of solids) {
    addCase(`${solid.id}:saved`, [solid.x, solid.z], [solid.x, solid.z]);
    addCase(`${solid.id}:x-cross`, [solid.x - 25, solid.z], [solid.x + 25, solid.z]);
    addCase(`${solid.id}:z-cross`, [solid.x, solid.z - 25], [solid.x, solid.z + 25]);
    addCase(`${solid.id}:diagonal`, [solid.x - 19, solid.z - 17], [solid.x + 19, solid.z + 17], .8);
}
for (let i = 0; i < 64; i++) {
    const angle = i * Math.PI / 32, dx = Math.cos(angle), dz = Math.sin(angle);
    addCase(`angled:${i}`, [-102 + dx * 22, -321 + dz * 22], [-102 - dx * 22, -321 - dz * 22]);
}
addCase('small-separation', [-102, -326.24], [-102, -326.24]);
addCase('clear-town', [0, 200], [1, 201]);
addCase('glancing-wall', [-102, -327], [-97, -323]);
const vectors = `${JSON.stringify({ schemaVersion: 1, cases }, null, 2)}\n`;
const vectorTarget = new URL('../server/internal/game/testdata/earth-outcrop-movement.json', import.meta.url);
if (process.argv.includes('--check')) {
    if (fs.readFileSync(vectorTarget, 'utf8') !== vectors) throw new Error('Stale JS outcrop movement vectors');
} else fs.writeFileSync(vectorTarget, vectors);
console.log(`Verified ${cases.length} client-generated movement/hit vectors for Go parity.`);
