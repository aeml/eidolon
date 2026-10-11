import { jest } from '@jest/globals';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { SourceTextModule } from 'node:vm';
import { buildAuthoredEquipmentRuntime } from '../scripts/generate-authored-equipment.mjs';

const classes = ['Fighter', 'Wizard', 'Cleric', 'Rogue'];
const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function fixture() {
    const bytes = new Map();
    const runtimeSelection = { schemaVersion: 1, characters: {} };
    const model = file => {
        const data = Buffer.from(`fixture bytes: ${file}`); bytes.set(file, data);
        return { file, sha256: createHash('sha256').update(data).digest('hex') };
    };
    const equipment = { schemaVersion: 2, characters: {}, items: [], sets: {} };
    const motions = { version: 2, profiles: ['Sword', 'Dagger', 'Staff', 'Mace', 'Unarmed'],
        states: ['Idle', 'CombatIdle', 'Walk', 'Run', 'Attack', 'Block'], characters: {} };
    const grips = { schemaVersion: 2, characters: {} };
    for (const name of classes) {
        const reference = `assets/archetypes/${name}/${name.toLowerCase()}.glb`;
        equipment.characters[name] = { reference };
        const source = model(reference);
        const variants = Object.fromEntries(['high', 'low'].map(quality =>
            [quality, model(reference.replace('.glb', `-runtime-${quality}.glb`))]));
        bytes.set(reference.replace('.glb', '-runtime.manifest.json'), Buffer.from(JSON.stringify({ source, variants })));
        runtimeSelection.characters[name] = { source, variants: Object.fromEntries(Object.entries(variants).map(([quality, variant]) =>
            [quality, { ...variant, baselineFile: variant.file, baselineSHA256: variant.sha256 }])) };
        motions.characters[name] = { ...model(`assets/equipment/authored/motions/${name}.glb`),
            defaultProfile: 'Sword', clips: motions.profiles.flatMap(profile => motions.states.map(state => `${profile}_${state}`)) };
        grips.characters[name] = Object.fromEntries(['mainHand', 'offHand'].map(hand => [hand,
            { socket: `socket_${hand}`, localMatrix: [...identity] }]));
    }
    const baseItems = [{ name: 'Iron Sword', slot: 'mainHand' }, { name: 'Iron Helm', slot: 'head' }];
    equipment.items = baseItems.map((item, index) => ({ ...item, id: index ? 'iron-helm' : 'iron-sword',
        models: Object.fromEntries(['standard', 'legendary'].map(tier => [tier, Object.fromEntries(
            (index ? classes : ['universal']).map(fit => [fit, model(`assets/equipment/authored/${index}/${tier}-${fit}.glb`)]))])) }));
    const readBytes = jest.fn(file => {
        if (!bytes.has(file)) throw new Error(`Missing fixture: ${file}`);
        return bytes.get(file);
    });
    return { equipment, motions, grips, baseItems, readBytes, bytes, runtimeSelection,
        get runtime() { return {
            sourceManifestSHA256: createHash('sha256').update(JSON.stringify(equipment)).digest('hex'),
            sources: equipment.items.flatMap(item => Object.entries(item.models).flatMap(([tier, fits]) =>
                Object.entries(fits).map(([actorClass, model]) => ({ item: item.name, tier, actorClass,
                    source: model.file, sourceHash: model.sha256, variants: { high: model, low: model } }))))
        }; } };
}

test('valid inputs generate deterministic source without reading models twice or mutating manifests', () => {
    const input = fixture(), before = JSON.stringify([input.equipment, input.motions, input.grips]);
    const result = buildAuthoredEquipmentRuntime(input);
    expect(result).toMatchObject({ classes: 4, items: 2, verifiedPaths: 22 });
    expect(result.source).toContain('export const AUTHORED_ASSET_VERSIONS');
    expect(input.readBytes).toHaveBeenCalledTimes(30);
    expect(JSON.stringify([input.equipment, input.motions, input.grips])).toBe(before);
    expect(buildAuthoredEquipmentRuntime(input).source).toBe(result.source);
});

test.each([
    ['unsupported schema', input => { input.equipment.schemaVersion = 3; }, /schema/],
    ['duplicate name', input => { input.equipment.items.push({ ...input.equipment.items[0] }); }, /Duplicate/],
    ['duplicate ID', input => { input.equipment.items[1].id = input.equipment.items[0].id; }, /Duplicate/],
    ['missing base item', input => { input.equipment.items.pop(); }, /coverage/],
    ['wrong item slot', input => { input.equipment.items[1].slot = 'feet'; }, /slot/],
    ['missing class', input => { delete input.equipment.characters.Rogue; }, /classes/],
    ['missing fit', input => { delete input.equipment.items[1].models.standard.Rogue; }, /fits/],
    ['missing tier', input => { delete input.equipment.items[1].models.legendary; }, /tiers/],
    ['invalid grip', input => { input.grips.characters.Rogue.offHand.localMatrix[0] = NaN; }, /grip/],
    ['singular grip', input => { input.grips.characters.Rogue.offHand.localMatrix.fill(0); }, /grip/],
    ['missing motion', input => { input.motions.characters.Rogue.clips.pop(); }, /motion/],
    ['escaping model path', input => { input.equipment.items[0].models.standard.universal.file = 'assets/../private.glb'; }, /path/],
    ['malformed hash', input => { input.equipment.items[0].models.standard.universal.sha256 = ''; }, /hash/],
    ['changed bytes', input => { input.bytes.set(input.equipment.items[0].models.standard.universal.file, Buffer.from('changed')); }, /hash mismatch/]
])('rejects %s before producing a catalog', (_label, change, error) => {
    const input = fixture(); change(input);
    expect(() => buildAuthoredEquipmentRuntime(input)).toThrow(error);
});

test('shared model references retain correct version IDs at every catalog occurrence', async () => {
    const input = fixture(), item = input.equipment.items[0];
    item.models.legendary.universal = { ...item.models.standard.universal };
    const result = buildAuthoredEquipmentRuntime(input);
    expect(result.verifiedPaths).toBe(21); expect(input.readBytes).toHaveBeenCalledTimes(29);
    const module = new SourceTextModule(result.source);
    await module.link(() => { throw new Error('Generated catalog must not import modules'); });
    await module.evaluate();
    const versions = module.namespace.AUTHORED_ASSET_VERSIONS;
    for (const [file, version] of Object.entries(versions)) {
        expect(version).toBe(createHash('sha256').update(input.bytes.get(file.slice(2))).digest('hex').slice(0, 16));
    }
    expect(Object.keys(versions)).toHaveLength(21);
});

test('actual --check is read-only and retains the entire delivered runtime catalog byte-for-byte', () => {
    const target = new URL('../src/assets/authoredEquipment.generated.js', import.meta.url);
    const before = fs.readFileSync(target), modified = fs.statSync(target).mtimeMs;
    const stdout = execFileSync(process.execPath, [new URL('../scripts/generate-authored-equipment.mjs', import.meta.url).pathname, '--check'], { encoding: 'utf8', cwd: os.tmpdir() });
    expect(stdout).toContain('Verified 4 classes and 36 items (744 verified paths)');
    expect(fs.readFileSync(target).equals(before)).toBe(true);
    expect(fs.statSync(target).mtimeMs).toBe(modified);
});

test('import and unknown CLI flags never regenerate the catalog', () => {
    const script = new URL('../scripts/generate-authored-equipment.mjs', import.meta.url);
    const target = new URL('../src/assets/authoredEquipment.generated.js', import.meta.url);
    const before = fs.readFileSync(target), modified = fs.statSync(target).mtimeMs;
    expect(execFileSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(script.href)})`],
        { encoding: 'utf8' })).toBe('');
    try {
        execFileSync(process.execPath, [script.pathname, '--chek'], { encoding: 'utf8', stdio: 'pipe' });
        throw new Error('Unknown generator flags were accepted');
    } catch (error) {
        expect(error.status).toBe(1);
        expect(error.stdout).toBe('');
        expect(error.stderr).toContain('Usage:');
    }
    expect(fs.readFileSync(target).equals(before)).toBe(true);
    expect(fs.statSync(target).mtimeMs).toBe(modified);
});


test.each([
    ['different source delivery', input => { input.runtime.sourceManifestSHA256 = '0'.repeat(64); }, /another delivery/],
    ['missing wearable fit', input => { input.runtime.sources.pop(); }, /Missing wearable runtime fit/],
    ['duplicate wearable fit', input => { input.runtime.sources.push(input.runtime.sources[0]); }, /Duplicate wearable runtime fit/],
    ['different wearable source', input => { input.runtime.sources[0].sourceHash = '0'.repeat(64); }, /source mismatch/],
    ['changed wearable derivative', input => { input.runtime.sources[0].variants = { ...input.runtime.sources[0].variants,
        low: { ...input.runtime.sources[0].variants.low, sha256: '0'.repeat(64) } }; }, /hash mismatch/],
    ['changed selected character', input => { input.runtimeSelection.characters.Rogue.variants.high.sha256 = '0'.repeat(64); }, /hash mismatch/],
    ['missing selected character', input => { delete input.runtimeSelection.characters.Rogue; }, /roster/],
    ['unsafe retained character', input => { input.runtimeSelection.characters.Rogue.previousVariants = {
        high: [{ file: 'assets/../private.glb', sha256: '0'.repeat(64) }], low: [] }; }, /Unsafe character runtime path/]
])('preserves current runtime validation: %s', (_label, change, error) => {
    const input = { ...fixture() }; change(input);
    expect(() => buildAuthoredEquipmentRuntime(input)).toThrow(error);
});


test('actual stale --check refuses to repair output or change its timestamp', () => {
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'eidolon-authored-check-'));
    try {
        fs.mkdirSync(path.join(sandbox, 'scripts'), { recursive: true });
        fs.mkdirSync(path.join(sandbox, 'src/assets'), { recursive: true });
        fs.symlinkSync(new URL('../assets', import.meta.url).pathname, path.join(sandbox, 'assets'));
        fs.symlinkSync(new URL('../src/core', import.meta.url).pathname, path.join(sandbox, 'src/core'));
        fs.symlinkSync(new URL('../scripts/lib', import.meta.url).pathname, path.join(sandbox, 'scripts/lib'));
        const script = path.join(sandbox, 'scripts/generate-authored-equipment.mjs');
        fs.copyFileSync(new URL('../scripts/generate-authored-equipment.mjs', import.meta.url), script);
        fs.writeFileSync(path.join(sandbox, 'package.json'), '{"type":"module"}');
        const target = path.join(sandbox, 'src/assets/authoredEquipment.generated.js');
        fs.writeFileSync(target, '// deliberately stale catalog\n');
        const before = fs.readFileSync(target), modified = fs.statSync(target).mtimeMs;
        let failure;
        try { execFileSync(process.execPath, [script, '--check'], { stdio: 'pipe' }); }
        catch (error) { failure = error; }
        expect(failure?.status).toBe(1);
        expect(failure.stderr.toString()).toContain('Stale authored equipment runtime catalog');
        expect(fs.readFileSync(target).equals(before)).toBe(true);
        expect(fs.statSync(target).mtimeMs).toBe(modified);
    } finally { fs.rmSync(sandbox, { recursive: true, force: true }); }
});
