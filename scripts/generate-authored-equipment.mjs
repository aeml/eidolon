import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { characterRuntimeSelection } from './lib/character-runtime-selection.mjs';

// Read-only with respect to delivered models and Blender sources.
const read = path => JSON.parse(fs.readFileSync(path, 'utf8'));
const equipment = read('assets/equipment/authored/manifest.json');
const motions = read('assets/equipment/authored/motion-profiles.json');
const grips = read('assets/equipment/authored/grip-transforms.json');
const runtime = read('assets/equipment/runtime/manifest.json');
if (runtime.sourceManifestSHA256 !== createHash('sha256').update(fs.readFileSync('assets/equipment/authored/manifest.json')).digest('hex')) {
    throw new Error('Wearable runtime copies were derived from another delivery');
}
const selection = characterRuntimeSelection(read('assets/archetypes/runtime-selection.json'), equipment.characters,
    file => fs.readFileSync(file));
const versions = {}, characters = {}, previousCharacters = {}, retainedCharacters = {};
const record = (file, expected) => {
    const hash = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    if (hash !== expected) throw new Error(`Delivered asset hash mismatch: ${file}`);
    versions[`./${file}`] = hash.slice(0, 16);
    return `./${file}`;
};
for (const name of Object.keys(equipment.characters)) {
    characters[name] = Object.fromEntries(['high', 'low'].map(quality => {
        const variant = selection[name].variants[quality];
        return [quality, record(variant.file, variant.sha256)];
    }));
    characters[name].motionBank = record(motions.characters[name].file, motions.characters[name].sha256);
    previousCharacters[name] = Object.fromEntries(['high', 'low'].map(quality => {
        const variant = selection[name].variants[quality];
        return [quality, record(variant.baselineFile, variant.baselineSHA256)];
    }));
    retainedCharacters[name] = Object.fromEntries(['high', 'low'].map(quality => [quality,
        (selection[name].previousVariants?.[quality] || []).map(variant => record(variant.file, variant.sha256))]));
}
const items = Object.fromEntries(equipment.items.map(item => [item.name, {
    id: item.id, slot: item.slot,
    models: Object.fromEntries(Object.entries(item.models).map(([tier, fits]) => [tier,
        Object.fromEntries(Object.entries(fits).map(([actorClass, model]) => [actorClass, record(model.file, model.sha256)]))]))
}]));
for (const row of runtime.sources) {
    const item = items[row.item], source = equipment.items.find(item => item.name === row.item)?.models[row.tier]?.[row.actorClass];
    if (!source || source.sha256 !== row.sourceHash || source.file !== row.source) throw new Error('Runtime wearable source mismatch');
    item.runtimeModels ||= {};
    item.runtimeModels[row.tier] ||= {};
    if (item.runtimeModels[row.tier][row.actorClass]) throw new Error('Duplicate wearable runtime fit');
    item.runtimeModels[row.tier][row.actorClass] = Object.fromEntries(['high', 'low'].map(quality => {
        const variant = row.variants[quality]; return [quality, record(variant.file, variant.sha256)];
    }));
}
for (const item of Object.values(items)) for (const [tier, fits] of Object.entries(item.models)) {
    for (const actorClass of Object.keys(fits)) if (!item.runtimeModels?.[tier]?.[actorClass]) throw new Error('Missing wearable runtime fit');
}
// Each model path appears once; runtime versions derive from the delivered hash.
const catalog = { characters, items, grips: grips.characters, sets: equipment.sets, previousCharacters, retainedCharacters };
const serialized = JSON.stringify(catalog, null, 2);
const hashesByVersion = Object.fromEntries(Object.values(versions).map(version => [version, version]));
// Assign version keys by walking catalog paths, avoiding a duplicate path table.
const pathExpression = `[...new Set([...Object.values(AUTHORED_ASSETS.characters).flatMap(c => [c.high, c.low, c.motionBank]), ...Object.values(AUTHORED_ASSETS.items).flatMap(i => Object.values(i.models).flatMap(Object.values)), ...Object.values(AUTHORED_ASSETS.items).flatMap(i => Object.values(i.runtimeModels).flatMap(fits => Object.values(fits).flatMap(Object.values))), ...Object.values(AUTHORED_ASSETS.previousCharacters).flatMap(c => [c.high, c.low]), ...Object.values(AUTHORED_ASSETS.retainedCharacters).flatMap(c => [...c.high, ...c.low])])]`;
// Use the emitted traversal order, never record() insertion order: retained
// assets may be recorded before item paths yet appear last in the catalog.
const paths = [...new Set([...Object.values(characters).flatMap(c => [c.high, c.low, c.motionBank]),
    ...Object.values(items).flatMap(i => Object.values(i.models).flatMap(Object.values)),
    ...Object.values(items).flatMap(i => Object.values(i.runtimeModels).flatMap(fits => Object.values(fits).flatMap(Object.values))),
    ...Object.values(previousCharacters).flatMap(c => [c.high, c.low]),
    ...Object.values(retainedCharacters).flatMap(c => [...c.high, ...c.low])])];
if (paths.length !== Object.keys(versions).length || paths.some(path => !versions[path])) throw new Error('Catalog version roster mismatch');
fs.writeFileSync('src/assets/authoredEquipment.generated.js',
    `// Generated by scripts/generate-authored-equipment.mjs; do not edit.\nexport const AUTHORED_ASSETS = ${serialized};\n` +
    `const versions = ${JSON.stringify(paths.map(path => versions[path]))};\n` +
    `const paths = ${pathExpression};\n` +
    `export const AUTHORED_ASSET_VERSIONS = Object.fromEntries(paths.map((path, i) => [path, versions[i]]));\n`);
console.log(`Generated ${Object.keys(characters).length} classes and ${Object.keys(items).length} item models (${Object.keys(hashesByVersion).length} verified hashes).`);
