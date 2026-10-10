import { createHash } from 'node:crypto';
import { characterRuntimeSelection } from '../scripts/lib/character-runtime-selection.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function fixture() {
    const source = 'assets/archetypes/Fighter/fighter.glb';
    const bytes = Buffer.from('immutable-source');
    const files = new Map([[source, bytes]]);
    const variants = {}, baseline = { source: { sha256: hash(bytes) }, variants: {} };
    for (const quality of ['high', 'low']) {
        const baselineFile = `assets/archetypes/Fighter/fighter-runtime-${quality}.glb`;
        const file = `assets/archetypes/Fighter/fighter-runtime-body-v2-${quality}.glb`;
        files.set(baselineFile, Buffer.from(`old-${quality}`)); files.set(file, Buffer.from(`new-${quality}`));
        baseline.variants[quality] = { sha256: hash(files.get(baselineFile)) };
        variants[quality] = { file, sha256: hash(files.get(file)), baselineFile, baselineSHA256: hash(files.get(baselineFile)) };
    }
    files.set(source.replace('.glb', '-runtime.manifest.json'), Buffer.from(JSON.stringify(baseline)));
    return { selection: { schemaVersion: 1, characters: { Fighter: { source: { file: source, sha256: hash(bytes) }, variants } } },
        files, characters: { Fighter: { reference: source } }, read: file => {
            if (!files.has(file)) throw new Error('Unexpected file read');
            return files.get(file);
        } };
}

test('validates selected and retained derivatives against their immutable original', () => {
    const { selection, characters, read } = fixture();
    expect(characterRuntimeSelection(selection, characters, read)).toBe(selection.characters);
});

function withPrevious() {
    const f = fixture(), file = 'assets/archetypes/Fighter/fighter-runtime-body-v1-high.glb';
    f.files.set(file, Buffer.from('retained-high'));
    f.selection.characters.Fighter.previousVariants = { high: [{ file, sha256: hash(f.files.get(file)) }], low: [] };
    return f;
}

test('retained intermediate selection is validated alongside current and original paths', () => {
    const f = withPrevious();
    expect(characterRuntimeSelection(f.selection, f.characters, f.read)).toBe(f.selection.characters);
});

test.each([
    ['missing quality', row => { delete row.previousVariants.low; }, /quality roster/],
    ['invalid list', row => { row.previousVariants.high = {}; }, /must be arrays/],
    ['hash mismatch', row => { row.previousVariants.high[0].sha256 = '0'.repeat(64); }, /hash mismatch/],
    ['unsafe path', row => { row.previousVariants.high[0].file = 'assets/archetypes/Fighter/../Rogue/rogue.glb'; }, /Unsafe/],
    ['duplicate history', row => { row.previousVariants.high.push(row.previousVariants.high[0]); }, /Duplicate/],
    ['current selection reused', row => { row.previousVariants.high = [row.variants.high]; }, /Duplicate/],
    ['baseline reused', row => { const v = row.variants.high; row.previousVariants.high = [{ file: v.baselineFile, sha256: v.baselineSHA256 }]; }, /Duplicate/]
])('rejects retained %s before catalog generation', (_name, mutate, error) => {
    const f = withPrevious(); mutate(f.selection.characters.Fighter);
    expect(() => characterRuntimeSelection(f.selection, f.characters, f.read)).toThrow(error);
});

test.each([
    ['schema', f => { f.selection.schemaVersion = 2; }, /roster\/schema/],
    ['missing class', f => { delete f.selection.characters.Fighter; }, /roster\/schema/],
    ['extra class', f => { f.selection.characters.Other = {}; }, /roster\/schema/],
    ['missing quality', f => { delete f.selection.characters.Fighter.variants.low; }, /quality roster/],
    ['source provenance', f => { f.selection.characters.Fighter.source.sha256 = '0'.repeat(64); }, /source mismatch/],
    ['baseline provenance', f => { f.selection.characters.Fighter.variants.high.baselineSHA256 = '0'.repeat(64); }, /baseline mismatch/],
    ['selected bytes', f => { f.selection.characters.Fighter.variants.high.sha256 = '0'.repeat(64); }, /hash mismatch/],
    ['path traversal', f => { f.selection.characters.Fighter.variants.high.file = 'assets/archetypes/Fighter/../Rogue/rogue.glb'; }, /Unsafe/],
    ['foreign class path', f => { f.selection.characters.Fighter.variants.high.file = 'assets/archetypes/Rogue/rogue.glb'; }, /Unsafe/]
])('rejects %s before catalog generation', (_name, mutate, error) => {
    const f = fixture(); mutate(f);
    expect(() => characterRuntimeSelection(f.selection, f.characters, f.read)).toThrow(error);
});
