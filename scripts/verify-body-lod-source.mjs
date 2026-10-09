import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const [directory, output] = process.argv.slice(2);
if (!directory || !path.isAbsolute(directory) || !output || !path.isAbsolute(output) || fs.existsSync(output)) throw new Error('Use absolute pilot directory and new output JSON');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS), hash = bytes => createHash('sha256').update(bytes).digest('hex');
const attributes = primitive => {
    const rows = primitive.listSemantics().sort().map(name => [name, primitive.getAttribute(name)]);
    primitive.listTargets().forEach((target, i) => target.listSemantics().sort().forEach(name => rows.push([`morph${i}/${name}`, target.getAttribute(name)])));
    return rows;
};
const signatures = primitive => {
    const rows = attributes(primitive), count = primitive.getAttribute('POSITION').getCount();
    const layout = rows.map(([name, accessor]) => [name, accessor.getType(), accessor.getComponentType(), accessor.getNormalized()]);
    const result = [];
    for (let vertex = 0; vertex < count; vertex++) {
        const digest = createHash('sha256');
        for (const [, accessor] of rows) {
            const array = accessor.getArray(), offset = array.byteOffset + vertex * accessor.getElementSize() * array.BYTES_PER_ELEMENT;
            digest.update(Buffer.from(array.buffer, offset, accessor.getElementSize() * array.BYTES_PER_ELEMENT));
        }
        result.push(digest.digest('hex'));
    }
    return { layout, vertices: result };
};
const rows = [];
for (const actorClass of ['Fighter', 'Rogue', 'Wizard', 'Cleric']) {
    const stem = actorClass.toLowerCase(), receipt = JSON.parse(fs.readFileSync(path.join(directory, actorClass, `${stem}-body-pilot.json`)));
    const sourceBytes = fs.readFileSync(receipt.source);
    if (hash(sourceBytes) !== receipt.sourceHash) throw new Error('Original source hash mismatch');
    const source = await io.read(receipt.source), bodyOf = document => document.getRoot().listNodes().find(node => node.getName() === `${actorClass}_Body`).getMesh();
    const originals = bodyOf(source).listPrimitives().map(signatures);
    for (const quality of ['high', 'low']) {
        const variant = receipt.variants[quality], bytes = fs.readFileSync(variant.file);
        if (hash(bytes) !== variant.sha256) throw new Error('Candidate hash mismatch');
        const candidate = await io.read(variant.file), primitives = bodyOf(candidate).listPrimitives();
        if (primitives.length !== originals.length) throw new Error('Primitive roster differs');
        let vertices = 0;
        for (const [i, primitive] of primitives.entries()) {
            const chosen = signatures(primitive), original = originals[i], sourceVertices = new Set(original.vertices);
            if (JSON.stringify(chosen.layout) !== JSON.stringify(original.layout)) throw new Error('Body or morph attribute layout differs');
            for (const vertex of chosen.vertices) if (!sourceVertices.has(vertex)) throw new Error('Derived vertex has attributes or morph deltas absent from original');
            vertices += chosen.vertices.length;
        }
        rows.push({ actorClass, quality, sourceSHA256: receipt.sourceHash, candidateSHA256: variant.sha256, vertices,
            allVertexPositionNormalUVSkinAndMorphRawBytesMatchOriginalVertex: true });
    }
}
fs.writeFileSync(output, JSON.stringify({ classification: 'Independent all-vertex source-subset proof. Checks raw typed values including all morph semantics, component type and normalization; SHA256 per vertex. Does not prove re-triangulated surface/pose/image equivalence.', rows }, null, 2) + '\n', { flag: 'wx' });
console.log(`Verified original-source vertex attributes and morph deltas for all ${rows.length} variants.`);
