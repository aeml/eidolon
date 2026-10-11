import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { gameplayBodyIndices } from './lib/gameplay-body-indices.mjs';

const [output, errorArgument = '.006'] = process.argv.slice(2), error = Number(errorArgument);
if (process.argv.slice(2).length > 2 || !output || !path.isAbsolute(output) || fs.existsSync(output) || !fs.statSync(path.dirname(output)).isDirectory() ||
    !Number.isFinite(error) || error <= 0 || error > .02) throw new Error('Use a new absolute output JSON and error in (0,.02]');
const selection = JSON.parse(fs.readFileSync('assets/archetypes/runtime-selection.json'));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS), rows = [];
const semantics = { position: 'POSITION', normal: 'NORMAL', tangent: 'TANGENT', uv: 'TEXCOORD_0', skinIndex: 'JOINTS_0', skinWeight: 'WEIGHTS_0' };
for (const [actorClass, character] of Object.entries(selection.characters)) for (const quality of ['high', 'low']) {
    const input = character.variants[quality], bytes = fs.readFileSync(input.file);
    if (createHash('sha256').update(bytes).digest('hex') !== input.sha256) throw new Error('Body source hash mismatch');
    const document = await io.read(input.file), mesh = document.getRoot().listNodes().find(node => node.getName() === `${actorClass}_Body`)?.getMesh();
    if (mesh?.listPrimitives().length !== 1) throw new Error('Expected one supplied body primitive');
    const primitive = mesh.listPrimitives()[0];
    if (primitive.listSemantics().sort().join(',') !== Object.values(semantics).sort().join(',')) throw new Error('Unsupported body semantics');
    const pack = attr => ({ itemSize: attr.getElementSize(), array: new Float32Array(attr.getArray()) });
    const source = { attributes: Object.fromEntries(Object.entries(semantics).map(([name, semantic]) => [name, pack(primitive.getAttribute(semantic))])),
        index: new Uint32Array(primitive.getIndices().getArray()), morphTargetsRelative: true,
        morphTargets: primitive.listTargets().map(target => {
            if (target.listSemantics().sort().join(',') !== 'NORMAL,POSITION') throw new Error('Unsupported body morph semantics');
            return { position: pack(target.getAttribute('POSITION')), normal: pack(target.getAttribute('NORMAL')) };
        }) };
    const before = createHash('sha256').update(JSON.stringify(source)).digest('hex'), start = performance.now();
    const result = gameplayBodyIndices(source, { error });
    delete result.indices;
    if (createHash('sha256').update(JSON.stringify(source)).digest('hex') !== before) throw new Error('Source body mutated');
    rows.push({ actorClass, quality, file: input.file, sha256: input.sha256, preparationMilliseconds: performance.now() - start, ...result });
}
fs.writeFileSync(output, JSON.stringify({ schema: 1,
    scope: 'Count-only unmasked current High/Low body index experiment; original GLBs, all raw attributes/morphs and selection unchanged. No native, fit, posed interpolation, runtime LOD or whole-game qualification.', rows }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
for (const quality of ['high', 'low']) {
    const selected = rows.filter(row => row.quality === quality);
    console.log(JSON.stringify({ quality, inputTriangles: selected.reduce((sum, row) => sum + row.inputTriangles, 0),
        candidateTriangles: selected.reduce((sum, row) => sum + row.candidateTriangles, 0),
        exactTriangles: selected.reduce((sum, row) => sum + row.exactTriangles, 0) }));
}
