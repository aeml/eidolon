import { readFile, writeFile } from 'node:fs/promises';
import { BASE_ITEMS } from '../src/core/ItemSystem.js';
import { isEquippableItem } from '../src/core/EquipmentSlots.js';

if (process.argv.slice(2).some(arg => arg !== '--check')) throw new Error('Usage: node scripts/generate-cosmetics.mjs [--check]');

const source = new URL('../server/internal/game/content/cosmetics.json', import.meta.url);
const earnedSource = new URL('../server/internal/game/content/season-cosmetics.json', import.meta.url);
const garmentSource = new URL('../server/internal/game/content/garments.json', import.meta.url);
const destination = new URL('../src/data/cosmetics.generated.js', import.meta.url);
const catalogue = JSON.parse(await readFile(source, 'utf8'));
const garments = JSON.parse(await readFile(garmentSource, 'utf8'));
const earnedCatalogue = JSON.parse(await readFile(earnedSource, 'utf8'));
const equipment = new Set(BASE_ITEMS.filter(isEquippableItem).map(item => item.name));
const ids = new Set(), names = new Set(), medals = new Set();
const commonFields = ['id', 'name', 'base', 'primary', 'secondary'];
const invalid = reason => { throw new Error(`Invalid cosmetics: ${reason}`); };
function validate(offers, earned) {
    if (!Array.isArray(offers)) invalid('catalogue must be an array');
    const fields = new Set([...commonFields, ...(earned ? ['medal'] : ['realm', 'priceEP', 'description', 'kind', 'pieces'])]);
    for (const offer of offers) {
        if (!offer || typeof offer !== 'object' || Array.isArray(offer) || Object.keys(offer).some(key => !fields.has(key))) {
            invalid('unexpected offer fields; cosmetics must not contain gameplay-power data');
        }
        for (const field of ['id', 'name', 'base', ...(earned ? ['medal'] : ['realm', 'description'])]) {
            if (typeof offer[field] !== 'string' || !offer[field].trim()) invalid(`missing ${field}`);
        }
        if (ids.has(offer.id) || names.has(offer.name)) invalid(`duplicate shop/earned identity: ${offer.id}`);
        if (!equipment.has(offer.base)) invalid(`unknown or non-equipment base: ${offer.base}`);
        if (offer.kind !== undefined) {
            if (offer.kind !== 'outfit' || BASE_ITEMS.find(item => item.name === offer.base)?.slot !== 'chest') invalid(`invalid garment kind: ${offer.id}`);
            const slots = ['head', 'chest', 'legs', 'feet', 'gloves', 'shoulders', 'belt'];
            if (!offer.pieces || Object.keys(offer.pieces).sort().join('|') !== slots.sort().join('|') ||
                slots.some(slot => BASE_ITEMS.find(item => item.name === offer.pieces[slot])?.slot !== slot)) invalid(`incomplete garment coverage: ${offer.id}`);
        } else if (offer.pieces !== undefined) invalid(`garment pieces require outfit kind: ${offer.id}`);
        for (const color of ['primary', 'secondary']) {
            if (!Number.isInteger(offer[color]) || offer[color] < 0 || offer[color] > 0xffffff) invalid(`invalid ${color}: ${offer.id}`);
        }
        if (earned) {
            if (!['Bronze', 'Silver', 'Gold'].includes(offer.medal) || medals.has(offer.medal)) invalid(`invalid or duplicate earned medal: ${offer.id}`);
            medals.add(offer.medal);
        } else {
            if (!Number.isSafeInteger(offer.priceEP) || offer.priceEP <= 0) invalid(`invalid EP price: ${offer.id}`);
            if (!['earth', 'water', 'fire', 'air'].includes(offer.realm)) invalid(`invalid realm: ${offer.id}`);
        }
        ids.add(offer.id); names.add(offer.name);
    }
}
// Validate before either branch: invalid input must not produce a tracked output
// or make --check look successful. Entitlement and payment remain server-owned.
catalogue.push(...garments);
validate(catalogue, false);
validate(earnedCatalogue, true);
const output = `// Generated from server/internal/game/content/cosmetics.json and season-cosmetics.json. Do not edit by hand.\nexport const COSMETIC_CATALOGUE = ${JSON.stringify(catalogue, null, 4)};\nexport const SEASON_COSMETIC_CATALOGUE = ${JSON.stringify(earnedCatalogue, null, 4)};\n`;
if (process.argv.includes('--check')) {
    let existing;
    try { existing = await readFile(destination, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (existing !== output) throw new Error('Stale cosmetics catalog: run node scripts/generate-cosmetics.mjs and commit the result');
} else await writeFile(destination, output);
console.log(`${process.argv.includes('--check') ? 'Verified' : 'Generated'} cosmetics and season cosmetic catalogs.`);
