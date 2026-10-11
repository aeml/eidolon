import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { characterRuntimeSelection } from './lib/character-runtime-selection.mjs';
import { BASE_ITEMS } from '../src/core/ItemSystem.js';

// Read-only with respect to delivered models and Blender sources.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => JSON.parse(fs.readFileSync(path.join(repoRoot, file), 'utf8'));
const CLASSES = ['Fighter', 'Wizard', 'Cleric', 'Rogue'];
const PROFILES = ['Sword', 'Dagger', 'Staff', 'Mace', 'Unarmed'];
const STATES = ['Idle', 'CombatIdle', 'Walk', 'Run', 'Attack', 'Block'];
const sameKeys = (value, keys) => Object.keys(value || {}).sort().join('|') === [...keys].sort().join('|');
const validModelPath = file => typeof file === 'string' && file.startsWith('assets/') && file.endsWith('.glb') &&
    !/[\\?#\0]/.test(file) && !file.split('/').some(part => ['', '.', '..'].includes(part));

export function buildAuthoredEquipmentRuntime({ equipment, motions, grips, runtime, runtimeSelection,
    equipmentBytes = Buffer.from(JSON.stringify(equipment)),
    baseItems = BASE_ITEMS.filter(item => !['MATERIAL', 'RELIC'].includes(item.type)),
    readBytes = file => fs.readFileSync(path.join(repoRoot, file)) }) {
    if (equipment?.schemaVersion !== 2 || motions?.version !== 2 || grips?.schemaVersion !== 2) {
        throw new Error('Unsupported authored equipment/motion/grip schema');
    }
    for (const input of [equipment, motions, grips]) {
        if (!sameKeys(input.characters, CLASSES)) throw new Error('Authored assets must cover exactly four classes');
    }
    if (!Array.isArray(motions.profiles) || [...motions.profiles].sort().join('|') !== [...PROFILES].sort().join('|') ||
        !Array.isArray(motions.states) || [...motions.states].sort().join('|') !== [...STATES].sort().join('|')) {
        throw new Error('Incomplete authored weapon motion profiles/states');
    }
    const names = new Set(), ids = new Set(), bases = new Map(baseItems.map(item => [item.name, item]));
    if (!Array.isArray(equipment.items)) throw new Error('Missing authored item coverage');
    for (const item of equipment.items) {
        if (names.has(item.name) || ids.has(item.id)) throw new Error(`Duplicate authored item name or ID: ${item.name}`);
        if (typeof item.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(item.id)) throw new Error(`Invalid authored item ID: ${item.name}`);
        if (!bases.has(item.name)) throw new Error(`Unexpected authored item coverage: ${item.name}`);
        if (item.slot !== bases.get(item.name).slot) throw new Error(`Authored item slot mismatch: ${item.name}`);
        if (!sameKeys(item.models, ['standard', 'legendary'])) throw new Error(`Missing authored model tiers: ${item.name}`);
        for (const fits of Object.values(item.models)) {
            if (!sameKeys(fits, ['mainHand', 'offHand'].includes(item.slot) ? ['universal'] : CLASSES)) {
                throw new Error(`Incomplete authored class fits: ${item.name}`);
            }
        }
        names.add(item.name); ids.add(item.id);
    }
    if (names.size !== bases.size) throw new Error('Incomplete authored base-item coverage');
    for (const name of CLASSES) {
        if (!validModelPath(equipment.characters[name].reference) || !equipment.characters[name].reference.startsWith(`assets/archetypes/${name}/`)) {
            throw new Error(`Invalid authored character path: ${name}`);
        }
        for (const hand of ['mainHand', 'offHand']) {
            const grip = grips.characters[name][hand], m = grip?.localMatrix;
            if (grip?.socket !== `socket_${hand}` || !Array.isArray(m) || m.length !== 16 || !m.every(Number.isFinite) ||
                [m[3], m[7], m[11]].some(value => Math.abs(value) > 1e-6) || Math.abs(m[15] - 1) > 1e-6 ||
                Math.abs(m[0] * (m[5] * m[10] - m[6] * m[9]) - m[4] * (m[1] * m[10] - m[2] * m[9]) +
                    m[8] * (m[1] * m[6] - m[2] * m[5])) < 1e-10) throw new Error(`Invalid authored grip: ${name}/${hand}`);
        }
        const motion = motions.characters[name];
        if (!PROFILES.includes(motion.defaultProfile) || !Array.isArray(motion.clips) ||
            PROFILES.some(profile => STATES.some(state => !motion.clips.includes(`${profile}_${state}`)))) {
            throw new Error(`Incomplete authored weapon motions: ${name}`);
        }
    }
    if (runtime?.sourceManifestSHA256 !== createHash('sha256').update(equipmentBytes).digest('hex')) {
        throw new Error('Wearable runtime copies were derived from another delivery');
    }
    if (!Array.isArray(runtime.sources)) throw new Error('Missing wearable runtime sources');
    const byteCache = new Map();
    const cachedBytes = file => {
        if (!byteCache.has(file)) byteCache.set(file, readBytes(file));
        return byteCache.get(file);
    };
    const selection = characterRuntimeSelection(runtimeSelection, equipment.characters, cachedBytes);
    const versions = {}, characters = {}, previousCharacters = {}, retainedCharacters = {};
    const record = (file, expected) => {
        if (!validModelPath(file)) throw new Error(`Invalid authored model path: ${file}`);
        if (typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected)) throw new Error(`Invalid delivered asset hash: ${file}`);
        const hash = createHash('sha256').update(cachedBytes(file)).digest('hex');
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
    const source =
    `// Generated by scripts/generate-authored-equipment.mjs; do not edit.\nexport const AUTHORED_ASSETS = ${serialized};\n` +
    `const versions = ${JSON.stringify(paths.map(path => versions[path]))};\n` +
    `const paths = ${pathExpression};\n` +
    `export const AUTHORED_ASSET_VERSIONS = Object.fromEntries(paths.map((path, i) => [path, versions[i]]));\n`;
    return { source, classes: Object.keys(characters).length, items: Object.keys(items).length, verifiedPaths: paths.length };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
    try {
        const args = process.argv.slice(2);
        if (args.length > 1 || args.length === 1 && args[0] !== '--check') throw new Error('Usage: node scripts/generate-authored-equipment.mjs [--check]');
        const result = buildAuthoredEquipmentRuntime({ equipment: read('assets/equipment/authored/manifest.json'),
            motions: read('assets/equipment/authored/motion-profiles.json'), grips: read('assets/equipment/authored/grip-transforms.json'),
            runtime: read('assets/equipment/runtime/manifest.json'), runtimeSelection: read('assets/archetypes/runtime-selection.json'),
            equipmentBytes: fs.readFileSync(path.join(repoRoot, 'assets/equipment/authored/manifest.json')) });
        const target = path.join(repoRoot, 'src/assets/authoredEquipment.generated.js');
        if (args[0] === '--check') {
            if (fs.readFileSync(target, 'utf8') !== result.source) throw new Error('Stale authored equipment runtime catalog; regenerate and review the diff');
        } else fs.writeFileSync(target, result.source);
        console.log(`${args[0] === '--check' ? 'Verified' : 'Generated'} ${result.classes} classes and ${result.items} items (${result.verifiedPaths} verified paths).`);
    } catch (error) {
        console.error(error.message); process.exitCode = 1;
    }
}
