import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Import generated binary artifacts only. Never replace supplied fitted assets.
const [directory] = process.argv.slice(2);
const destination = 'assets/equipment/runtime';
if (!directory || !path.isAbsolute(directory) || fs.existsSync(destination)) {
    throw new Error('Provide a generated absolute catalog directory; runtime destination must not exist');
}
const bytes = fs.readFileSync('assets/equipment/authored/manifest.json');
const source = JSON.parse(bytes), derived = JSON.parse(fs.readFileSync(path.join(directory, 'runtime-catalog.json')));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
if (derived.schema !== 1 || derived.vertexLayout !== 'separate' || derived.sourceManifestSHA256 !== hash(bytes) ||
    derived.tools.gltfTransform !== '4.5.1' || derived.tools.meshoptimizer !== '1.2.0') throw new Error('Unqualified derivative catalog');
const expected = source.items.flatMap(item => Object.entries(item.models).flatMap(([tier, fits]) =>
    Object.entries(fits).map(([actorClass, model]) => ({ item, tier, actorClass, model }))));
if (expected.length !== derived.sources.length) throw new Error('Derivative catalog does not cover delivered fits');
const rows = [], copies = [], seen = new Set();
for (const { item, tier, actorClass, model } of expected) {
    const row = derived.sources.find(row => row.item === item.name && row.tier === tier && row.actorClass === actorClass);
    if (!row || row.itemID !== item.id || row.slot !== item.slot || row.source !== model.file || row.sourceHash !== model.sha256 ||
        hash(fs.readFileSync(model.file)) !== model.sha256) throw new Error('Delivered identity/hash mismatch');
    const variants = {};
    for (const quality of ['high', 'low']) {
        const variant = row.variants[quality];
        if (!variant || !path.resolve(variant.file).startsWith(`${path.resolve(directory)}${path.sep}`)) throw new Error('Invalid artifact path');
        const data = fs.readFileSync(variant.file);
        if (hash(data) !== variant.sha256 || !Number.isInteger(variant.triangles) || variant.triangles > row.originalTriangles ||
            variant.reduced !== (variant.triangles < row.originalTriangles)) throw new Error('Invalid derivative hash/geometry');
        const json = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
        const triangles = json.meshes.reduce((sum, mesh) => sum + mesh.primitives.reduce((sum, primitive) => {
            if ((primitive.mode ?? 4) !== 4) throw new Error('Unsupported generated primitive');
            return sum + json.accessors[primitive.indices].count / 3;
        }, 0), 0);
        if (triangles !== variant.triangles) throw new Error('Generated triangle receipt mismatch');
        for (const mesh of json.meshes) for (const primitive of mesh.primitives) for (const index of Object.values(primitive.attributes)) {
            const accessor = json.accessors[index], view = json.bufferViews[accessor.bufferView];
            const width = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[accessor.type] *
                { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }[accessor.componentType];
            if (!width || view.byteStride && view.byteStride !== width) throw new Error('Incompatible generated attribute layout');
        }
        // Error-constrained tiny pieces can remain unchanged. Reuse the actual
        // delivered file rather than shipping a duplicate binary for each LOD.
        const file = variant.reduced ? `${destination}/${actorClass}/${item.id}-${tier}-${quality}.glb` : model.file;
        variants[quality] = { ...variant, file, sha256: variant.reduced ? variant.sha256 : model.sha256 };
        if (variant.reduced) {
            if (seen.has(file)) throw new Error('Duplicate derivative output');
            seen.add(file); copies.push({ file, data });
        }
    }
    rows.push({ item: row.item, itemID: row.itemID, slot: row.slot, actorClass, tier, source: model.file,
        sourceHash: model.sha256, originalTriangles: row.originalTriangles, variants });
}
// Validate every input first; a corrupt catalog cannot produce a partial import.
fs.mkdirSync(destination);
for (const { file, data } of copies) {
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data, { flag: 'wx' });
}
fs.writeFileSync(`${destination}/manifest.json`, JSON.stringify({ schema: 1,
    sourceManifestSHA256: hash(bytes), tools: derived.tools, vertexLayout: derived.vertexLayout,
    status: 'staged-runtime-copies-not-production-world-approval', sources: rows, totals: derived.totals
}, null, 2) + '\n', { flag: 'wx' });
console.log(`Imported ${copies.length} reduced wearable binaries; ${rows.length * 2 - copies.length} unchanged fits reuse originals.`);
