import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

// Generated assets only. Never overwrite the delivered source or install into
// another worktree's shared dependencies. A pilot is not runtime activation.
const [name, actorClass, outputDirectory, tier = 'standard'] = process.argv.slice(2);
if (!name || !actorClass || !outputDirectory || !path.isAbsolute(outputDirectory) || !['standard', 'legendary'].includes(tier)) {
    throw new Error('Usage: derive-wearable-pilot.mjs <item name> <class> <new absolute output directory> [standard|legendary]');
}
const manifest = JSON.parse(fs.readFileSync('assets/equipment/authored/manifest.json', 'utf8'));
const asset = manifest.items.find(item => item.name === name)?.models[tier]?.[actorClass];
if (!asset) throw new Error(`No delivered ${tier} fitted model for this item/class`);
const source = path.resolve(asset.file), destination = path.resolve(outputDirectory);
if (!fs.statSync(destination).isDirectory() || destination === path.dirname(source)) {
    throw new Error('Use a separate, existing owned output directory');
}
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceHash = hash(fs.readFileSync(source));
if (sourceHash !== asset.sha256) throw new Error('Delivered model differs from its pinned manifest');
const sourceBytes = fs.readFileSync(source);
const sourceJSON = JSON.parse(sourceBytes.subarray(20, 20 + sourceBytes.readUInt32LE(12)).toString());
const sourceNodes = new Map(sourceJSON.nodes.map(node => [node.name, node]));
if (sourceNodes.size !== sourceJSON.nodes.length || sourceNodes.has(undefined)) throw new Error('Pilot requires uniquely named nodes');
const preserveDeliveredTransforms = output => {
    // NodeIO omits near-default transforms. Keep the delivered exact matrix/TRS
    // values rather than repeatedly widening a numerical contract tolerance.
    // This changes only generated JSON; retain its BIN chunk byte-for-byte.
    const bytes = fs.readFileSync(output), length = bytes.readUInt32LE(12);
    const json = JSON.parse(bytes.subarray(20, 20 + length).toString());
    for (const node of json.nodes) {
        const original = sourceNodes.get(node.name);
        if (!original) throw new Error('Generated node has no delivered identity');
        for (const field of ['matrix', 'translation', 'rotation', 'scale']) {
            delete node[field];
            if (original[field]) node[field] = original[field];
        }
    }
    const encoded = Buffer.from(JSON.stringify(json)), paddedLength = Math.ceil(encoded.length / 4) * 4;
    const chunk = Buffer.alloc(8 + paddedLength, 0x20);
    chunk.writeUInt32LE(paddedLength, 0); chunk.writeUInt32LE(0x4e4f534a, 4); encoded.copy(chunk, 8);
    const header = Buffer.from(bytes.subarray(0, 12)), binary = bytes.subarray(20 + length);
    header.writeUInt32LE(12 + chunk.length + binary.length, 8);
    fs.writeFileSync(output, Buffer.concat([header, chunk, binary]));
};
const settings = JSON.parse(fs.readFileSync('package.json', 'utf8')).devDependencies;
const importTool = async name => {
    if (!process.env.EIDOLON_ASSET_TOOL_MODULES) return import(name);
    const directory = path.join(process.env.EIDOLON_ASSET_TOOL_MODULES, name);
    const metadata = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
    if (metadata.version !== settings[name]) throw new Error(`Unqualified tool version for ${name}`);
    return import(pathToFileURL(path.join(directory, metadata.module || metadata.main)).href);
};
const { NodeIO, VertexLayout } = await importTool('@gltf-transform/core');
const { ALL_EXTENSIONS } = await importTool('@gltf-transform/extensions');
const { weld, simplifyPrimitive } = await importTool('@gltf-transform/functions');
const { MeshoptSimplifier } = await importTool('meshoptimizer');
await MeshoptSimplifier.ready;
// Delivered gear uses separate attribute buffers. Interleaved export prevents
// the renderer's exact compatible-gear batching; keep its mergeable layout.
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).setVertexLayout(VertexLayout.SEPARATE);
const contract = document => {
    const root = document.getRoot();
    return {
        nodes: root.listNodes().map(node => [node.getName(), node.listChildren().map(child => child.getName()),
            node.getTranslation(), node.getRotation(), node.getScale(), node.getSkin()?.getName()]).sort((a, b) => a[0].localeCompare(b[0])),
        skins: root.listSkins().map(skin => [skin.getName(), skin.listJoints().map(joint => joint.getName()),
            Array.from(skin.getInverseBindMatrices().getArray())]),
        animations: root.listAnimations().map(animation => animation.getName()),
        textures: root.listTextures().map(texture => [texture.getName(), hash(texture.getImage())]),
        primitives: root.listMeshes().map(mesh => [mesh.getName(), mesh.listPrimitives().map(primitive =>
            [primitive.listSemantics().sort(), primitive.getMaterial()?.getName(), primitive.listTargets().length])])
    };
};
const triangles = document => document.getRoot().listMeshes().reduce((total, mesh) => total +
    mesh.listPrimitives().reduce((sum, primitive) => sum + primitive.getIndices().getCount() / 3, 0), 0);
const original = await io.read(source), originalContract = contract(original), originalTriangles = triangles(original);
const stem = path.basename(source, '.glb'), variants = {};
for (const [quality, ratio, error] of [['high', .12, .002], ['low', .04, .006]]) {
    const output = path.join(destination, `${stem}-pilot-${quality}.glb`);
    if (fs.existsSync(output)) throw new Error('Refusing to overwrite an existing pilot');
    const document = await io.read(source);
    await document.transform(weld({ overwrite: false }));
    for (const mesh of document.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
        simplifyPrimitive(primitive, { simplifier: MeshoptSimplifier, ratio, error, lockBorder: true });
    }
    if (JSON.stringify(contract(document)) !== JSON.stringify(originalContract)) {
        throw new Error('Rig, transforms, materials, UV/skin semantics, morphs or texture payload changed');
    }
    if (triangles(document) > originalTriangles) throw new Error('Pilot increased geometry');
    await io.write(output, document);
    preserveDeliveredTransforms(output);
    const verified = await io.read(output);
    const outputBytes = fs.readFileSync(output);
    const outputJSON = JSON.parse(outputBytes.subarray(20, 20 + outputBytes.readUInt32LE(12)).toString());
    for (const mesh of outputJSON.meshes) for (const primitive of mesh.primitives) {
        for (const index of Object.values(primitive.attributes)) {
            const accessor = outputJSON.accessors[index], view = outputJSON.bufferViews[accessor.bufferView];
            const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[accessor.type];
            const bytes = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }[accessor.componentType];
            if (!components || !bytes || view.byteStride && view.byteStride !== components * bytes) {
                throw new Error('Serialized wearable is not separately mergeable');
            }
        }
    }
    const outputContract = contract(verified);
    for (const field of Object.keys(originalContract)) {
        if (JSON.stringify(outputContract[field]) !== JSON.stringify(originalContract[field])) {
            throw new Error(`Serialized pilot changed its ${field} contract`);
        }
    }
    variants[quality] = { file: output, sha256: hash(fs.readFileSync(output)), triangles: triangles(verified), ratio,
        maximumError: error, reduced: triangles(verified) < originalTriangles };
    console.log(`${quality}: ${originalTriangles} -> ${variants[quality].triangles} triangles`);
}
if (hash(fs.readFileSync(source)) !== sourceHash) throw new Error('Original source changed during derivation');
const receipt = path.join(destination, `${stem}-pilot.json`);
if (fs.existsSync(receipt)) throw new Error('Refusing to overwrite an existing pilot receipt');
fs.writeFileSync(receipt, JSON.stringify({ name, actorClass, tier, source, sourceHash, originalTriangles,
    vertexLayout: 'separate', status: 'derived-contract-only-not-visual-or-runtime-approval', variants }, null, 2) + '\n');
console.log(`Pilot evidence: ${receipt}`);
