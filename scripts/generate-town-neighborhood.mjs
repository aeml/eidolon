import fs from 'node:fs';
import { LANTERNHOLD_HOMES, LANTERNHOLD_RESIDENT_ROUTES } from '../src/data/lanternholdNeighborhood.js';

const target = new URL('../server/internal/game/content/lanternhold-neighborhood.json', import.meta.url);
const output = JSON.stringify({ homes: LANTERNHOLD_HOMES, routes: LANTERNHOLD_RESIDENT_ROUTES }, null, 2) + '\n';
if (process.argv.includes('--check')) {
    if (fs.readFileSync(target, 'utf8') !== output) throw Error('Stale Lanternhold neighborhood');
} else fs.writeFileSync(target, output);
console.log('Verified fifteen homes and four resident routes.');
