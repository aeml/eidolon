import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

// Count-only feasibility screen. No runtime, model or material is written.
// Depth-only candidates ignore color/normal/UV detail but retain every opaque
// source primitive and use supplied positions/skin/morph data. These counts
// do not qualify a shadow silhouette, posed fit, rollout or whole-scene budget.
const [output, errorArgument = '.006'] = process.argv.slice(2), maximumError = Number(errorArgument);
if (!output || !path.isAbsolute(output) || fs.existsSync(output) || !fs.statSync(path.dirname(output)).isDirectory() ||
    !Number.isFinite(maximumError) || maximumError <= 0 || maximumError > .05) {
    throw new Error('Use a new absolute output JSON in an existing owned directory and optional shadow error in (0,0.05]');
}
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const selection = JSON.parse(fs.readFileSync('assets/archetypes/runtime-selection.json'));
const wearables = JSON.parse(fs.readFileSync('assets/equipment/runtime/manifest.json'));
const inputs = [
    ...Object.entries(selection.characters).map(([actorClass, row]) => ({ actorClass, kind: 'character', ...row.variants.high })),
    ...wearables.sources.map(row => ({ actorClass: row.actorClass, item: row.item, tier: row.tier, kind: 'equipment', ...row.variants.high }))
];

function partitionedIndices(index, positions, blends, fixed, maximumError, depthSignatures) {
    const groups = [];
    for (let offset = 0; offset < index.length; offset += 3) {
        const triangle = Array.from(index.slice(offset, offset + 3));
        const bones = new Set(triangle.flatMap(vertex => [...blends[vertex].keys()]));
        if (bones.size > 32) throw new Error('Triangle exceeds full bone channels');
        let group = null, added = Infinity;
        for (const candidate of groups) {
            const extra = [...bones].filter(bone => !candidate.bones.has(bone)).length;
            if (candidate.bones.size + extra <= 32 && extra < added) { group = candidate; added = extra; }
        }
        if (!group) { group = { bones: new Set(), indices: [] }; groups.push(group); }
        for (const bone of bones) group.bones.add(bone);
        group.indices.push(...triangle);
    }
    const uses = new Uint16Array(blends.length), locks = fixed.slice();
    for (const group of groups) for (const vertex of new Set(group.indices)) uses[vertex]++;
    let shared = 0;
    for (let vertex = 0; vertex < uses.length; vertex++) if (uses[vertex] > 1) { locks[vertex] = 1; shared++; }
    const output = [], parts = [];
    let error = 0;
    for (const group of groups) {
        const bones = [...group.bones].sort((a, b) => a - b), stride = bones.length;
        for (const vertex of new Set(group.indices)) if ([...blends[vertex].keys()].some(bone => !group.bones.has(bone))) throw new Error('Unconstrained referenced bone');
        const attributes = new Float32Array(blends.length * stride);
        for (let vertex = 0; vertex < blends.length; vertex++) for (let channel = 0; channel < stride; channel++) attributes[vertex * stride + channel] = blends[vertex].get(bones[channel]) || 0;
        const [indices, reportedError] = MeshoptSimplifier.simplifyWithAttributes(new Uint32Array(group.indices), positions, 3,
            attributes, stride, Array(stride).fill(.1), locks, Math.floor(group.indices.length * .06 / 3) * 3, maximumError, ['LockBorder', 'Permissive']);
        if (!Number.isFinite(reportedError) || reportedError > maximumError || indices.length > group.indices.length) throw new Error('Invalid partition result');
        const sourceVertices = new Set(group.indices), retained = new Set(indices);
        if ([...retained].some(vertex => !sourceVertices.has(vertex))) throw new Error('New partition vertex');
        const retainedDepth = new Set([...retained].map(vertex => depthSignatures[vertex]));
        if ([...sourceVertices].some(vertex => locks[vertex] && !retainedDepth.has(depthSignatures[vertex]))) throw new Error('Fixed partition depth signature removed');
        output.push(...indices); error = Math.max(error, reportedError);
        parts.push({ activeBones: stride, inputTriangles: group.indices.length / 3, candidateTriangles: indices.length / 3 });
    }
    return [new Uint32Array(output), error, { groups: parts, sharedVertexLocks: shared }];
}

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
        const count = position.getCount(), joints = primitive.getAttribute('JOINTS_0'), skin = primitive.getAttribute('WEIGHTS_0');
        if (Boolean(joints) !== Boolean(skin)) throw new Error('Incomplete skin pair');
        const blends = [];
        for (let vertex = 0; vertex < count; vertex++) {
            const js = joints?.getElement(vertex, []) || [], ws = skin?.getElement(vertex, []) || [], blend = new Map();
            for (let channel = 0; channel < js.length; channel++) {
                if (!Number.isInteger(js[channel]) || js[channel] < 0 || !Number.isFinite(ws[channel]) || ws[channel] < 0) throw new Error('Invalid supplied skin');
                if (ws[channel]) blend.set(js[channel], (blend.get(js[channel]) || 0) + ws[channel]);
            }
            blends.push(blend);
        }
        const bones = [...new Set(blends.flatMap(blend => [...blend.keys()]))].sort((a, b) => a - b);
        // Partition a primitive exceeding 32 active bones into triangle sets.
        // Each set constrains every referenced bone; shared vertices are fixed.
        const stride = bones.length <= 32 ? bones.length : 0;
        const attributes = new Float32Array(count * stride), locks = new Uint8Array(count);
        for (let vertex = 0; vertex < count; vertex++) for (let channel = 0; channel < stride; channel++) attributes[vertex * stride + channel] = blends[vertex].get(bones[channel]) || 0;
        const remap = MeshoptSimplifier.generatePositionRemap(position.getArray(), 3), conflicts = new Set();
        const signatures = blends.map(blend => JSON.stringify([...blend].sort((a, b) => a[0] - b[0])));
        for (let vertex = 0; vertex < count; vertex++) if (signatures[vertex] !== signatures[remap[vertex]]) conflicts.add(remap[vertex]);
        for (let vertex = 0; vertex < count; vertex++) if (conflicts.has(remap[vertex])) locks[vertex] = 1;
        for (const target of primitive.listTargets()) {
            const delta = target.getAttribute('POSITION');
            for (let vertex = 0; vertex < count; vertex++) if (delta.getElement(vertex, []).some(value => value !== 0)) locks[vertex] = 1;
        }
        const depthSignatures = blends.map((blend, vertex) => JSON.stringify([position.getElement(vertex, []),
            [...blend].sort((a, b) => a[0] - b[0]), primitive.listTargets().map(target => target.getAttribute('POSITION').getElement(vertex, []))]));
        const ratio = .06, target = Math.floor(index.getCount() * ratio / 3) * 3;
        const [indices, reportedError, partition] = bones.length > 32 ? partitionedIndices(new Uint32Array(index.getArray()), position.getArray(), blends, locks, maximumError, depthSignatures) : MeshoptSimplifier.simplifyWithAttributes(new Uint32Array(index.getArray()), position.getArray(), 3,
            attributes, stride, Array(stride).fill(.1), locks, target, maximumError, ['LockBorder', 'Permissive']);
        if (!Number.isFinite(reportedError) || reportedError > maximumError || indices.length > index.getCount()) throw new Error('Invalid depth-only screen result');
        const referenced = new Set(index.getArray()), retained = new Set(indices);
        if ([...retained].some(vertex => !referenced.has(vertex))) throw new Error('New depth-only vertex');
        const retainedDepth = new Set([...retained].map(vertex => depthSignatures[vertex]));
        const protectedVertices = [...referenced].filter(vertex => locks[vertex]);
        if (protectedVertices.some(vertex => !retainedDepth.has(depthSignatures[vertex]))) throw new Error('Fixed depth-only signature removed');
        const lockedDepthSignaturesVerified = new Set(protectedVertices.map(vertex => depthSignatures[vertex])).size;
        after += indices.length / 3;
        const constrainedTriangles = indices.length / 3;
        denseSkinConstrainedAfter += constrainedTriangles;
        primitives.push({ mesh: mesh.getName(), triangles, candidateTriangles: indices.length / 3, ratio, maximumError, reportedError,
            denseSkinConstrainedCandidateTriangles: constrainedTriangles,
            lockedDepthSignaturesVerified, activeBones: bones.length, partition, skinInterpolation: bones.length > 32 ? 'partitioned-canonical-dense-weight0.1' : 'canonical-dense-weight0.1',
            lockedVertices: locks.reduce((sum, value) => sum + value, 0), disposition: 'index-only-count' });
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
