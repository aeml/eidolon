import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld } from '@gltf-transform/functions';
import { shadowLodIndices } from './lib/shadow-lod-indices.mjs';

// Count-only feasibility screen. No runtime, model or material is written.
// Depth-only candidates ignore color/normal/UV detail but retain every opaque
// source primitive and use supplied positions/skin/morph data. These counts
// do not qualify a shadow silhouette, posed fit, rollout or whole-scene budget.
const [output, errorArgument = '.006'] = process.argv.slice(2), maximumError = Number(errorArgument);
if (!output || !path.isAbsolute(output) || fs.existsSync(output) || !fs.statSync(path.dirname(output)).isDirectory() ||
    !Number.isFinite(maximumError) || maximumError <= 0 || maximumError > .05) {
    throw new Error('Use a new absolute output JSON in an existing owned directory and optional shadow error in (0,0.05]');
}
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const selection = JSON.parse(fs.readFileSync('assets/archetypes/runtime-selection.json'));
const wearables = JSON.parse(fs.readFileSync('assets/equipment/runtime/manifest.json'));
const inputs = [
    ...Object.entries(selection.characters).map(([actorClass, row]) => ({ actorClass, kind: 'character', ...row.variants.high })),
    ...wearables.sources.map(row => ({ actorClass: row.actorClass, item: row.item, tier: row.tier, kind: 'equipment', ...row.variants.high }))
];


const rows = [];
for (const input of inputs) {
    const bytes = fs.readFileSync(input.file);
    if (hash(bytes) !== input.sha256) throw new Error(`Input hash mismatch: ${input.file}`);
    const document = await io.read(input.file);
    for (const mesh of document.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
        // Only opaque depth is considered. Alpha/displacement-dependent routes
        // need their own material-aware implementation, never an invisible skip.
        if (primitive.getMaterial()?.getAlphaMode() !== 'OPAQUE') continue;
        for (const name of primitive.listSemantics()) if (!['POSITION', 'JOINTS_0', 'WEIGHTS_0'].includes(name)) primitive.setAttribute(name, null);
        for (const target of primitive.listTargets()) for (const name of target.listSemantics()) if (name !== 'POSITION') target.setAttribute(name, null);
    }
    await document.transform(weld({ overwrite: false }));
    let before = 0, after = 0, denseSkinConstrainedAfter = 0;
    const primitives = [];
    for (const mesh of document.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
        const position = primitive.getAttribute('POSITION'), index = primitive.getIndices();
        if (!index || !position) throw new Error('Indexed position geometry required');
        const triangles = index.getCount() / 3;
        before += triangles;
        const unsupported = primitive.getMode() !== 4 || primitive.getMaterial()?.getAlphaMode() !== 'OPAQUE' ||
            !(position.getArray() instanceof Float32Array) || primitive.listTargets().some(target => !target.getAttribute('POSITION'));
        if (unsupported) {
            after += triangles;
            denseSkinConstrainedAfter += triangles;
            primitives.push({ mesh: mesh.getName(), triangles, candidateTriangles: triangles,
                denseSkinConstrainedCandidateTriangles: triangles, disposition: 'unsupported-exact-count' });
            continue;
        }
        const result = shadowLodIndices(primitive, maximumError);
        after += result.indices.length / 3;
        denseSkinConstrainedAfter += result.indices.length / 3;
        const { indices, ...details } = result;
        primitives.push({ mesh: mesh.getName(), triangles, candidateTriangles: indices.length / 3,
            denseSkinConstrainedCandidateTriangles: indices.length / 3, ...details, disposition: 'index-only-count' });
    }
    rows.push({ kind: input.kind, actorClass: input.actorClass, item: input.item, tier: input.tier, file: input.file, sha256: input.sha256,
        inputTriangles: before, candidateShadowTriangles: after, denseSkinConstrainedCandidateShadowTriangles: denseSkinConstrainedAfter, primitives });
}
const result = { schema: 1, classification: 'High opaque shadow-only feasibility counts. All color geometry remains unchanged. No derived assets, native silhouette/pose/lifetime checks or runtime selection; whole-scene gates remain open.',
    constraintCaveat: 'Over-32 skin primitives use triangle bone-union partitions with shared depth signatures fixed and all referenced bones constrained. Exact source position/skin/position-morph signatures are checked for fixed vertices. Weight penalties are not a bound on all animated poses; no rendered shadow is qualified.',
    ratio: .06, maximumError, rows };
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
for (const kind of ['character', 'equipment']) {
    const matched = rows.filter(row => row.kind === kind);
    console.log(JSON.stringify({ kind, files: matched.length, inputTriangles: matched.reduce((sum, row) => sum + row.inputTriangles, 0),
        candidateShadowTriangles: matched.reduce((sum, row) => sum + row.candidateShadowTriangles, 0),
        denseSkinConstrainedCandidateShadowTriangles: matched.reduce((sum, row) => sum + row.denseSkinConstrainedCandidateShadowTriangles, 0) }));
}
