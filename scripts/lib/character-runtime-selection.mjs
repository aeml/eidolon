import { createHash } from 'node:crypto';

// Validate the entire selection before generating or writing the catalog.
// Legacy derivatives remain hash-pinned assets, not silent loader fallbacks.
export function characterRuntimeSelection(selection, characters, readBytes) {
    const names = Object.keys(characters).sort();
    if (selection?.schemaVersion !== 1 ||
        JSON.stringify(Object.keys(selection.characters || {}).sort()) !== JSON.stringify(names)) {
        throw new Error('Character runtime selection roster/schema mismatch');
    }
    const digest = file => createHash('sha256').update(readBytes(file)).digest('hex');
    const verify = (file, expected, name) => {
        if (typeof file !== 'string' || !new RegExp(`^assets/archetypes/${name}/[a-z0-9-]+\\.(?:glb)$`).test(file)) {
            throw new Error('Unsafe character runtime path');
        }
        if (!/^[a-f0-9]{64}$/.test(expected) || digest(file) !== expected) {
            throw new Error(`Character runtime hash mismatch: ${file}`);
        }
    };
    for (const name of names) {
        const row = selection.characters[name], character = characters[name];
        const baseline = JSON.parse(readBytes(character.reference.replace(/\.[^.]+$/, '-runtime.manifest.json')));
        if (row.source?.file !== character.reference || row.source?.sha256 !== baseline.source.sha256) {
            throw new Error('Character runtime source mismatch');
        }
        verify(row.source.file, row.source.sha256, name);
        if (JSON.stringify(Object.keys(row.variants || {}).sort()) !== JSON.stringify(['high', 'low'])) {
            throw new Error('Character runtime quality roster mismatch');
        }
        for (const quality of ['high', 'low']) {
            const variant = row.variants[quality];
            const baselineFile = character.reference.replace(/\.[^.]+$/, `-runtime-${quality}.glb`);
            if (variant.baselineFile !== baselineFile || variant.baselineSHA256 !== baseline.variants[quality].sha256) {
                throw new Error('Character runtime baseline mismatch');
            }
            verify(baselineFile, variant.baselineSHA256, name);
            verify(variant.file, variant.sha256, name);
        }
    }
    return selection.characters;
}
