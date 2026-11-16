import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

// Read-only screening of original delivered meshes. No GLBs/catalog/runtime
// paths are written. Report only index reductions; rendered fit remains open.
const [output] = process.argv.slice(2);
if (!output || !path.isAbsolute(output) || fs.existsSync(output)) throw new Error('Provide a new absolute JSON output path');
const sourceManifest = fs.readFileSync('assets/equipment/authored/manifest.json');
const manifest = JSON.parse(sourceManifest), runtime = JSON.parse(fs.readFileSync('assets/equipment/runtime/manifest.json'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
await MeshoptSimplifier.ready;
const rows = [];
for (const actorClass of ['Fighter', 'Rogue', 'Wizard', 'Cleric']) {
    for (const name of ['Plate Greaves', 'Plate Mail', 'Robes', 'Leather Pants']) {
        const item = manifest.items.find(item => item.name === name), model = item.models.standard[actorClass];
        const bytes = fs.readFileSync(model.file);
        if (hash(bytes) !== model.sha256) throw new Error('Supplied source hash mismatch');
        const document = await io.read(model.file); await document.transform(weld({ overwrite: false }));
        const variants = [];
        for (const [quality, ratio, error] of [['high', .12, .002], ['low', .04, .006]]) {
            const totals = { strict: 0, attributeStrict: 0, attributePermissive: 0, skinnedAttributePermissive: 0, weightedSkinPermissive: 0, strictLowerTarget: 0 };
            const primitives = [];
            for (const mesh of document.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
                if (primitive.getMode() !== 4 || primitive.listTargets().length) throw new Error('Unscreened topology/morph primitive');
                const position = primitive.getAttribute('POSITION'), count = position.getCount();
                const indices = new Uint32Array(primitive.getIndices().getArray());
                const positions = position.getArray();
                if (!(positions instanceof Float32Array)) throw new Error('Screen requires Float32 positions');
                const attributes = primitive.listSemantics().filter(semantic => !['POSITION', 'JOINTS_0', 'WEIGHTS_0'].includes(semantic));
                if (attributes.some(semantic => !['NORMAL', 'TEXCOORD_0'].includes(semantic))) throw new Error('Unweighted source semantic');
                const widths = attributes.map(semantic => primitive.getAttribute(semantic).getElementSize());
                const stride = widths.reduce((sum, width) => sum + width, 0), packed = new Float32Array(count * stride), weights = [];
                attributes.forEach((semantic, i) => { for (let j = 0; j < widths[i]; j++) weights.push(semantic === 'NORMAL' ? .5 : .1); });
                for (let i = 0; i < count; i++) {
                    let offset = i * stride;
                    for (const semantic of attributes) {
                        const values = primitive.getAttribute(semantic).getElement(i, []); packed.set(values, offset); offset += values.length;
                    }
                }
                // Lock every vertex at an actual skin-blend transition, and
                // every coincident-position alias with differing skin blends.
                // The index-only simplifier never changes surviving weights.
                const joints = primitive.getAttribute('JOINTS_0'), skinWeights = primitive.getAttribute('WEIGHTS_0');
                const locks = new Uint8Array(count), seamLocks = new Uint8Array(count), skins = [], blends = [];
                if (joints || skinWeights) {
                    if (!joints || !skinWeights) throw new Error('Incomplete source skin attributes');
                    for (let i = 0; i < count; i++) {
                        const js = joints.getElement(i, []), ws = skinWeights.getElement(i, []), blend = new Map();
                        for (let j = 0; j < js.length; j++) if (ws[j] !== 0) blend.set(js[j], (blend.get(js[j]) || 0) + ws[j]);
                        blends.push(blend); skins.push(JSON.stringify([...blend].sort((a, b) => a[0] - b[0])));
                    }
                    for (let i = 0; i < indices.length; i += 3) {
                        const [a, b, c] = indices.subarray(i, i + 3);
                        if (skins[a] !== skins[b] || skins[b] !== skins[c]) locks[a] = locks[b] = locks[c] = 1;
                    }
                    const remap = MeshoptSimplifier.generatePositionRemap(positions, 3), conflicts = new Set();
                    for (let i = 0; i < count; i++) if (skins[i] !== skins[remap[i]]) conflicts.add(remap[i]);
                    for (let i = 0; i < count; i++) if (conflicts.has(remap[i])) locks[i] = seamLocks[i] = 1;
                }
                const target = Math.floor(indices.length * ratio / 3) * 3;
                const strict = MeshoptSimplifier.simplify(indices, positions, 3, target, error, ['LockBorder']);
                const attributeStrict = MeshoptSimplifier.simplifyWithAttributes(indices, positions, 3,
                    packed, stride, weights, locks, target, error, ['LockBorder']);
                const attributePermissive = MeshoptSimplifier.simplifyWithAttributes(indices, positions, 3,
                    packed, stride, weights, locks, target, error, ['LockBorder', 'Permissive']);
                const activeBones = [...new Set(blends.flatMap(blend => [...blend.keys()]))].sort((a, b) => a - b);
                let skinnedAttributePermissive = [indices, 0], weightedSkinPermissive = [indices, 0];
                if (stride + activeBones.length <= 32) {
                    const combinedStride = stride + activeBones.length;
                    const combined = new Float32Array(count * combinedStride);
                    for (let vertex = 0; vertex < count; vertex++) {
                        combined.set(packed.subarray(vertex * stride, (vertex + 1) * stride), vertex * combinedStride);
                        activeBones.forEach((bone, j) => { combined[vertex * combinedStride + stride + j] = blends[vertex].get(bone) || 0; });
                    }
                    // Explicit continuous weights per live bone, rather than
                    // treating numeric JOINTS IDs as a continuous attribute.
                    // Retain all original surviving UV/normal/skin values.
                    const combinedWeights = weights.map(() => .1).concat(activeBones.map(() => 1));
                    skinnedAttributePermissive = MeshoptSimplifier.simplifyWithAttributes(indices, positions, 3,
                        combined, combinedStride, combinedWeights, seamLocks, target, error, ['LockBorder', 'Permissive']);
                    const screenWeights = weights.map(weight => weight === .5 ? .05 : .1).concat(activeBones.map(() => .1));
                    const screenTarget = Math.floor(indices.length * (quality === 'high' ? .04 : .02) / 3) * 3;
                    weightedSkinPermissive = MeshoptSimplifier.simplifyWithAttributes(indices, positions, 3,
                        combined, combinedStride, screenWeights, seamLocks, screenTarget, error, ['LockBorder', 'Permissive']);
                }
                const lowerTarget = Math.floor(indices.length * (quality === 'high' ? .04 : .02) / 3) * 3;
                const strictLowerTarget = MeshoptSimplifier.simplify(indices, positions, 3, lowerTarget, error, ['LockBorder']);
                const outcomes = { strict, attributeStrict, attributePermissive, skinnedAttributePermissive, weightedSkinPermissive, strictLowerTarget };
                for (const [mode, [outIndices, resultError]] of Object.entries(outcomes)) {
                    if (outIndices.length > indices.length || resultError > error || !Number.isFinite(resultError)) throw new Error('Invalid screening result');
                    totals[mode] += outIndices.length / 3;
                }
                primitives.push({ mesh: mesh.getName(), sourceTriangles: indices.length / 3,
                    lockedVertices: locks.reduce((sum, value) => sum + value, 0), protectedSkinSeamVertices: seamLocks.reduce((sum, value) => sum + value, 0), activeBones: activeBones.length, skinnedAttributeSupported: stride + activeBones.length <= 32, vertices: count,
                    outcomes: Object.fromEntries(Object.entries(outcomes).map(([mode, [out, resultError]]) => [mode, { triangles: out.length / 3, reportedCombinedError: resultError }])) });
            }
            const existing = runtime.sources.find(row => row.item === name && row.actorClass === actorClass && row.tier === 'standard').variants[quality];
            if (totals.strict !== existing.triangles) throw new Error('Strict baseline does not reproduce existing runtime triangle count');
            variants.push({ quality, ratio, maximumError: error, existingTriangles: existing.triangles, totals, primitives });
        }
        if (hash(fs.readFileSync(model.file)) !== model.sha256) throw new Error('Original changed during read-only screen');
        rows.push({ name, actorClass, source: model.file, sha256: model.sha256, variants });
    }
}
fs.writeFileSync(output, JSON.stringify({ scope: 'Sixteen original standard fits; no runtime/asset modifications. Same qualified High0.002/Low0.006 positional-plus-weighted-attribute error bounds, original index-only attributes, fixed skin transitions for conservative modes; continuous per-bone blend weights and coincident-skin-seam locks for skinned mode; LockBorder retained. Skinned mode normal/UV weights0.1 and skin weights1; additional weighted-skin screen uses normal0.05/UV0.1/skin0.1 and High0.04/Low0.02 index targets, unchanged maximum error. No runtime quality policy modified. Counts alone are not fit/image/animation/whole-game approval.', toolVersions: { gltfTransform: '4.5.1', meshoptimizer: '1.2.0' }, sourceManifestSHA256: hash(sourceManifest), rows }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(rows.map(row => ({ name: row.name, actorClass: row.actorClass, variants: row.variants.map(v => ({ quality: v.quality, ...v.totals })) }))));
