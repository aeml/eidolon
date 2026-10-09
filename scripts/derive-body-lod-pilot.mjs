import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplifyPrimitive, compactPrimitive, copyToDocument, unpartition } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import { validateBytes } from 'gltf-validator';
import { bodyLodIndices } from './lib/body-lod-indices.mjs';

// Isolated derivative only: never overwrite source or selected runtime assets.
// Simplify directly from the pinned original, avoiding compounded LOD error.
const [actorClass, destination, mode = 'strict'] = process.argv.slice(2);
if (!['Fighter', 'Rogue', 'Wizard', 'Cleric'].includes(actorClass) || !destination ||
    !path.isAbsolute(destination) || !fs.statSync(destination).isDirectory() || fs.readdirSync(destination).length || !['strict', 'attributes'].includes(mode)) {
    throw new Error('Usage: derive-body-lod-pilot.mjs <class> <existing empty absolute output directory> [strict|attributes]');
}
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const directory = `assets/archetypes/${actorClass}`, stem = actorClass.toLowerCase(), bodyName = `${actorClass}_Body`;
const manifest = JSON.parse(fs.readFileSync(`${directory}/${stem}-runtime.manifest.json`));
const source = `${directory}/${stem}.glb`, sourceHash = hash(fs.readFileSync(source));
if (sourceHash !== manifest.source.sha256) throw new Error('Original model differs from pinned provenance');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
await MeshoptSimplifier.ready;
const bodyOf = document => document.getRoot().listNodes().find(node => node.getName() === bodyName)?.getMesh();
const triangles = mesh => mesh.listPrimitives().reduce((sum, primitive) => sum + primitive.getIndices().getCount() / 3, 0);
const accessorContract = accessor => accessor && [accessor.getType(), accessor.getComponentType(), accessor.getNormalized(),
    accessor.getCount(), hash(Buffer.from(accessor.getArray().buffer, accessor.getArray().byteOffset, accessor.getArray().byteLength))];
const primitiveAccessors = primitive => [primitive.getIndices(), ...primitive.listSemantics().map(name => primitive.getAttribute(name)),
    ...primitive.listTargets().flatMap(target => target.listSemantics().map(name => target.getAttribute(name)))];
const sorted = rows => rows.sort((a, b) => a[0].localeCompare(b[0]));
const contract = document => {
    const root = document.getRoot(), body = bodyOf(document);
    return {
        nodes: sorted(root.listNodes().map(node => [node.getName(), node.listChildren().map(child => child.getName()),
            node.getTranslation(), node.getRotation(), node.getScale(), node.getMesh()?.getName(), node.getSkin()?.getName(), node.getWeights(), node.getExtras()])),
        skins: sorted(root.listSkins().map(skin => [skin.getName(), skin.listJoints().map(joint => joint.getName()),
            skin.getSkeleton()?.getName(), accessorContract(skin.getInverseBindMatrices())])),
        animations: sorted(root.listAnimations().map(animation => [animation.getName(), animation.listChannels().map(channel => {
            const sampler = channel.getSampler();
            return [channel.getTargetNode()?.getName(), channel.getTargetPath(), sampler.getInterpolation(),
                accessorContract(sampler.getInput()), accessorContract(sampler.getOutput())];
        }), animation.getExtras()])),
        textures: sorted(root.listTextures().map(texture => [texture.getName(), texture.getMimeType(), hash(texture.getImage()), texture.getExtras()])),
        materials: sorted(root.listMaterials().map(material => [material.getName(), material.getBaseColorFactor(),
            material.getMetallicFactor(), material.getRoughnessFactor(), material.getEmissiveFactor(), material.getDoubleSided(),
            material.getAlphaMode(), material.getAlphaCutoff(), material.getNormalScale(), material.getOcclusionStrength(), material.getExtras()])),
        meshes: sorted(root.listMeshes().map(mesh => [mesh.getName(), mesh.getWeights(), mesh.getExtras(), mesh.listPrimitives().map(primitive => [
            primitive.getMode(), primitive.getMaterial()?.getName(), primitive.listSemantics().sort(),
            primitive.listTargets().map(target => target.listSemantics().sort()), primitive.getExtras(),
            mesh === body ? null : primitiveAccessors(primitive).map(accessorContract)
        ])]))
    };
};
const cornerDigest = primitive => {
    const digest = createHash('sha256'), indices = primitive.getIndices().getArray();
    const attributes = primitive.listSemantics().sort().map(name => [name, primitive.getAttribute(name)]);
    primitive.listTargets().forEach((target, index) => target.listSemantics().sort().forEach(name => attributes.push([`morph${index}/${name}`, target.getAttribute(name)])));
    for (const [name, accessor] of attributes) {
        const array = accessor.getArray(), width = accessor.getElementSize(), corners = new array.constructor(indices.length * width);
        for (let i = 0; i < indices.length; i++) for (let j = 0; j < width; j++) corners[i * width + j] = array[indices[i] * width + j];
        digest.update(name + ':' + accessor.getComponentType() + ':' + accessor.getNormalized());
        digest.update(Buffer.from(corners.buffer));
    }
    return digest.digest('hex');
};
const exactTransforms = (file, referenceBytes) => {
    const referenceJSON = JSON.parse(referenceBytes.subarray(20, 20 + referenceBytes.readUInt32LE(12)).toString());
    const nodes = new Map(referenceJSON.nodes.map(node => [node.name, node]));
    if (nodes.size !== referenceJSON.nodes.length || nodes.has(undefined)) throw new Error('Unique node names required');
    const bytes = fs.readFileSync(file), length = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + length).toString());
    for (const node of json.nodes) {
        const reference = nodes.get(node.name);
        if (!reference) throw new Error('Unexpected generated node');
        for (const key of ['matrix', 'translation', 'rotation', 'scale']) { delete node[key]; if (reference[key]) node[key] = reference[key]; }
    }
    const encoded = Buffer.from(JSON.stringify(json)), padded = Math.ceil(encoded.length / 4) * 4, chunk = Buffer.alloc(8 + padded, 0x20);
    chunk.writeUInt32LE(padded); chunk.writeUInt32LE(0x4e4f534a, 4); encoded.copy(chunk, 8);
    const header = Buffer.from(bytes.subarray(0, 12)), binary = bytes.subarray(20 + length);
    header.writeUInt32LE(12 + chunk.length + binary.length, 8); fs.writeFileSync(file, Buffer.concat([header, chunk, binary]));
};
const variants = {};
for (const [quality, ratio, error] of [['high', .20, .002], ['low', .08, .006]]) {
    const baselineFile = `${directory}/${stem}-runtime-${quality}.glb`, baselineBytes = fs.readFileSync(baselineFile);
    if (hash(baselineBytes) !== manifest.variants[quality].sha256) throw new Error('Reviewed baseline differs from manifest');
    const baseline = await io.read(baselineFile), before = contract(baseline), body = bodyOf(baseline);
    const document = await io.read(source);
    await document.transform(weld({ overwrite: false }));
    const originalBody = bodyOf(document), originalTriangles = triangles(originalBody), baselineTriangles = triangles(body);
    if (!body || !originalBody || body.listPrimitives().length !== originalBody.listPrimitives().length) throw new Error('Body roster differs');
    const details = [];
    for (const primitive of originalBody.listPrimitives()) {
        if (mode === 'strict') simplifyPrimitive(primitive, { simplifier: MeshoptSimplifier, ratio, error, lockBorder: true });
        else {
            const candidate = bodyLodIndices(primitive, ratio, error), previous = primitive.getIndices();
            primitive.setIndices(document.createAccessor(previous.getName()).setType('SCALAR').setBuffer(previous.getBuffer()).setArray(candidate.indices));
            if (previous.listParents().length === 1) previous.dispose();
            compactPrimitive(primitive);
            if (primitive.getAttribute('POSITION').getCount() <= 65534) primitive.getIndices().setArray(new Uint16Array(primitive.getIndices().getArray()));
            details.push({ reportedError: candidate.reportedError, lockedMorphVertices: candidate.lockedMorphVertices });
        }
    }
    const candidateTriangles = triangles(originalBody), cornerSHA256 = originalBody.listPrimitives().map(cornerDigest);
    const file = path.join(destination, `${stem}-body-pilot-${quality}.glb`);
    if (candidateTriangles >= baselineTriangles) {
        // A quality with no geometry benefit retains exact reviewed bytes.
        // Report the failed candidate counts; do not relax its error/locks.
        const validation = await validateBytes(new Uint8Array(baselineBytes), { uri: path.basename(file), maxIssues: 32 });
        if (validation.issues.numErrors || validation.issues.numWarnings) throw new Error('Reviewed fallback fails glTF validation');
        fs.writeFileSync(file, baselineBytes, { flag: 'wx' });
        variants[quality] = { file, sha256: hash(baselineBytes), bytes: baselineBytes.length, baselineFile, baselineSHA256: hash(baselineBytes),
            originalBodyTriangles: originalTriangles, baselineBodyTriangles: baselineTriangles, bodyTriangles: baselineTriangles,
            attemptedBodyTriangles: candidateTriangles, algorithm: 'exact-reviewed-runtime', ratio, maximumError: error,
            mode, details, cornerSHA256: body.listPrimitives().map(cornerDigest), gltfErrors: 0, gltfWarnings: 0 };
        console.log(`${actorClass}/${quality}: candidate${candidateTriangles} >= baseline${baselineTriangles}; retain exact reviewed bytes`);
        continue;
    }
    // Copy geometry accessors only. All reviewed non-body meshes, texture bytes,
    // materials, rig and animation accessors remain in the baseline document.
    const sourceAccessors = [...new Set(originalBody.listPrimitives().flatMap(primitiveAccessors))];
    const copied = copyToDocument(baseline, document, sourceAccessors);
    for (const [index, primitive] of body.listPrimitives().entries()) {
        const original = originalBody.listPrimitives()[index];
        primitive.setIndices(copied.get(original.getIndices()));
        for (const name of original.listSemantics()) primitive.setAttribute(name, copied.get(original.getAttribute(name)));
        for (const [i, target] of primitive.listTargets().entries()) {
            for (const name of original.listTargets()[i].listSemantics()) target.setAttribute(name, copied.get(original.listTargets()[i].getAttribute(name)));
        }
    }
    for (const accessor of baseline.getRoot().listAccessors()) if (accessor.listParents().length === 1) accessor.dispose();
    await baseline.transform(unpartition());
    if (JSON.stringify(contract(baseline)) !== JSON.stringify(before)) throw new Error('Reviewed non-body/rig/material/morph/animation contract changed');
    if (JSON.stringify(body.listPrimitives().map(cornerDigest)) !== JSON.stringify(cornerSHA256)) throw new Error('Copy changed body/morph corners');
    await io.write(file, baseline); exactTransforms(file, baselineBytes);
    const verified = await io.read(file), bytes = fs.readFileSync(file);
    if (JSON.stringify(contract(verified)) !== JSON.stringify(before)) throw new Error('Serialized reviewed contract changed');
    if (JSON.stringify(bodyOf(verified).listPrimitives().map(cornerDigest)) !== JSON.stringify(cornerSHA256)) throw new Error('Serialized body/morph corners changed');
    const validation = await validateBytes(new Uint8Array(bytes), { uri: path.basename(file), maxIssues: 32 });
    if (validation.issues.numErrors || validation.issues.numWarnings) throw new Error('Generated body fails glTF validation');
    variants[quality] = { file, sha256: hash(bytes), bytes: bytes.length, baselineFile, baselineSHA256: hash(baselineBytes),
        originalBodyTriangles: originalTriangles, baselineBodyTriangles: baselineTriangles, bodyTriangles: candidateTriangles,
        ratio, maximumError: error, mode, algorithm: mode, details, cornerSHA256, gltfErrors: 0, gltfWarnings: 0 };
    console.log(`${actorClass}/${quality}: body${baselineTriangles}->${candidateTriangles}; other meshes/textures/rig/morph roster/animation data exact`);
}
if (hash(fs.readFileSync(source)) !== sourceHash) throw new Error('Original source changed');
fs.writeFileSync(path.join(destination, `${stem}-body-pilot.json`), JSON.stringify({ actorClass, source, sourceHash,
    classification: 'Body-only original-source strict LOD pilot, unchanged error bounds. Exact reviewed other geometry/rig/animation/texture payloads. Native morph/motion/fit and visual approval required.',
    variants }, null, 2) + '\n', { flag: 'wx' });
