import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplifyPrimitive } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

const [output] = process.argv.slice(2);
if (!output || !path.isAbsolute(output) || fs.existsSync(output)) throw new Error('Use a new absolute JSON output path');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS), hash = bytes => createHash('sha256').update(bytes).digest('hex');
await MeshoptSimplifier.ready;
const rows = [];
for (const actorClass of ['Fighter', 'Rogue', 'Wizard', 'Cleric']) {
    const directory = `assets/archetypes/${actorClass}`, stem = actorClass.toLowerCase();
    const manifest = JSON.parse(fs.readFileSync(`${directory}/${stem}-runtime.manifest.json`));
    const source = `${directory}/${stem}.glb`, sourceBytes = fs.readFileSync(source);
    if (hash(sourceBytes) !== manifest.source.sha256) throw new Error('Source differs from pinned derivation');
    const variants = [];
    for (const [quality, ratios, error] of [['high', [.45, .30, .20, .12], .002], ['low', [.18, .12, .08, .04], .006]]) {
        const baseline = await io.read(`${directory}/${stem}-runtime-${quality}.glb`);
        const bodyTriangles = document => document.getRoot().listNodes().find(node => node.getName() === `${actorClass}_Body`)
            .getMesh().listPrimitives().reduce((sum, primitive) => sum + primitive.getIndices().getCount() / 3, 0);
        for (const ratio of ratios) {
            const document = await io.read(source);
            await document.transform(weld({ overwrite: false }));
            const body = document.getRoot().listNodes().find(node => node.getName() === `${actorClass}_Body`).getMesh();
            const before = bodyTriangles(document);
            for (const primitive of body.listPrimitives()) simplifyPrimitive(primitive, { simplifier: MeshoptSimplifier, ratio, error, lockBorder: true });
            const after = bodyTriangles(document), existing = bodyTriangles(baseline);
            if (ratio === ratios[0] && after !== existing) throw new Error(`Strict baseline differs ${actorClass}/${quality}`);
            variants.push({ quality, ratio, maximumError: error, originalBodyTriangles: before, baselineBodyTriangles: existing,
                candidateBodyTriangles: after, morphTargets: body.getExtras().targetNames,
                morphTargetSemantics: body.listPrimitives().map(primitive => primitive.listTargets().map(target => target.listSemantics())) });
        }
    }
    rows.push({ actorClass, source, sourceSHA256: manifest.source.sha256, variants });
    console.log(actorClass, variants.map(v => `${v.quality}/${v.ratio}:${v.candidateBodyTriangles}`).join(' '));
    if (hash(fs.readFileSync(source)) !== manifest.source.sha256) throw new Error('Source changed during inspection');
}
fs.writeFileSync(output, JSON.stringify({ classification: 'Source-pinned body-only count screening; no asset changes or visual/morph/fit/runtime approval.',
    tools: { gltfTransform: '4.5.1', meshoptimizer: '1.2.0' }, algorithm: 'Same strict index-only simplification and LockBorder, unchanged error bounds; ratio targets only.', rows }, null, 2) + '\n', { flag: 'wx' });
