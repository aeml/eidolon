import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const [destination] = process.argv.slice(2);
if (!destination || !path.isAbsolute(destination) || !fs.statSync(destination).isDirectory() || fs.readdirSync(destination).length) {
    throw new Error('Use a new, empty, existing absolute output directory');
}
const manifestBytes = fs.readFileSync('assets/equipment/authored/manifest.json');
const manifest = JSON.parse(manifestBytes);
const sources = [];
for (const item of manifest.items) for (const [tier, fits] of Object.entries(item.models)) {
    for (const [actorClass, model] of Object.entries(fits)) {
        const directory = path.join(destination, actorClass);
        fs.mkdirSync(directory, { recursive: true });
        const result = spawnSync(process.execPath, ['scripts/derive-wearable-pilot.mjs', item.name, actorClass, directory, tier], {
            encoding: 'utf8', env: process.env
        });
        if (result.status !== 0) {
            // Fail the generation; do not silently skip a failed rig/asset or
            // use stronger simplification error until a contract happens to pass.
            throw new Error(`${item.name}/${tier}/${actorClass}: ${result.stderr.slice(-2000)}`);
        }
        const stem = path.basename(model.file, '.glb');
        const receipt = JSON.parse(fs.readFileSync(path.join(directory, `${stem}-pilot.json`)));
        sources.push({ item: item.name, itemID: item.id, slot: item.slot, actorClass, tier,
            source: model.file, sourceHash: receipt.sourceHash, originalTriangles: receipt.originalTriangles,
            variants: receipt.variants });
        console.log(`${sources.length}: ${item.name}/${tier}/${actorClass} ${receipt.originalTriangles} -> ${receipt.variants.high.triangles}/${receipt.variants.low.triangles}`);
    }
}
const total = key => sources.reduce((sum, row) => sum + (key ? row.variants[key].triangles : row.originalTriangles), 0);
if (fs.readFileSync('assets/equipment/authored/manifest.json').compare(manifestBytes) !== 0) throw new Error('Source manifest changed during generation');
fs.writeFileSync(path.join(destination, 'runtime-catalog.json'), JSON.stringify({ schema: 1,
    sourceManifestSHA256: createHash('sha256').update(manifestBytes).digest('hex'),
    status: 'derived-contracts-only-rendered-fit-and-runtime-integration-required',
    tools: { gltfTransform: '4.5.1', meshoptimizer: '1.2.0' }, vertexLayout: 'separate', sources,
    totals: { sources: sources.length, originalTriangles: total(), highTriangles: total('high'), lowTriangles: total('low') }
}, null, 2) + '\n');
console.log(`Generated ${sources.length} immutable-source model pairs; visual/runtime approval remains separate.`);
