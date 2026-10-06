import { readFile, writeFile } from 'node:fs/promises';

const source = new URL('../server/internal/game/content/cosmetics.json', import.meta.url);
const earnedSource = new URL('../server/internal/game/content/season-cosmetics.json', import.meta.url);
const destination = new URL('../src/data/cosmetics.generated.js', import.meta.url);
const catalogue = JSON.parse(await readFile(source, 'utf8'));
const earnedCatalogue = JSON.parse(await readFile(earnedSource, 'utf8'));
const output = `// Generated from server/internal/game/content/cosmetics.json and season-cosmetics.json. Do not edit by hand.\nexport const COSMETIC_CATALOGUE = ${JSON.stringify(catalogue, null, 4)};\nexport const SEASON_COSMETIC_CATALOGUE = ${JSON.stringify(earnedCatalogue, null, 4)};\n`;
if (process.argv.slice(2).some(arg => arg !== '--check')) throw new Error('Usage: node scripts/generate-cosmetics.mjs [--check]');
if (process.argv.includes('--check')) {
    let existing;
    try { existing = await readFile(destination, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (existing !== output) throw new Error('Stale cosmetics catalog: run node scripts/generate-cosmetics.mjs and commit the result');
} else await writeFile(destination, output);
console.log(`${process.argv.includes('--check') ? 'Verified' : 'Generated'} cosmetics and season cosmetic catalogs.`);
