import { readFile, writeFile } from 'node:fs/promises';

const source = new URL('../server/internal/game/content/cosmetics.json', import.meta.url);
const destination = new URL('../src/data/cosmetics.generated.js', import.meta.url);
const catalogue = JSON.parse(await readFile(source, 'utf8'));
await writeFile(destination, `// Generated from server/internal/game/content/cosmetics.json. Do not edit by hand.\nexport const COSMETIC_CATALOGUE = ${JSON.stringify(catalogue, null, 4)};\n`);
