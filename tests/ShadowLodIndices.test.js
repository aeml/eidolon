import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { shadowLodIndices } from '../scripts/lib/shadow-lod-indices.mjs';

function surface() {
    const document = new Document(), buffer = document.createBuffer(), columns = 36, rows = 7, count = columns * rows;
    const accessor = (type, array) => document.createAccessor().setBuffer(buffer).setType(type).setArray(array);
    const positions = new Float32Array(count * 3), joints = new Uint16Array(count * 4), weights = new Float32Array(count * 4), indices = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
        const vertex = y * columns + x;
        positions.set([x / (columns - 1), y / (rows - 1), 0], vertex * 3);
        joints[vertex * 4] = x; weights[vertex * 4] = 1;
        if (x < columns - 1 && y < rows - 1) indices.push(vertex, vertex + 1, vertex + columns, vertex + 1, vertex + columns + 1, vertex + columns);
    }
    const moving = 3 * columns + 17, delta = new Float32Array(count * 3); delta[moving * 3 + 2] = .1;
    const primitive = document.createPrimitive().setAttribute('POSITION', accessor('VEC3', positions))
        .setAttribute('JOINTS_0', accessor('VEC4', joints)).setAttribute('WEIGHTS_0', accessor('VEC4', weights))
        .setIndices(accessor('SCALAR', new Uint32Array(indices)))
        .addTarget(document.createPrimitiveTarget().setAttribute('POSITION', accessor('VEC3', delta)));
    return { document, primitive, moving };
}

test('over32 bones stay constrained in independent triangle partitions and moving morph vertices survive', () => {
    const { primitive, moving } = surface(), result = shadowLodIndices(primitive);
    expect(result.activeBones).toBe(36); expect(result.partition.groups.length).toBeGreaterThan(1);
    expect(result.partition.groups.every(group => group.activeBones <= 32)).toBe(true);
    expect(result.partition.sharedVertexLocks).toBeGreaterThan(0);
    expect(new Set(result.indices).has(moving)).toBe(true);
    expect(result.indices.length).toBeLessThan(primitive.getIndices().getCount());
    expect(result.reportedError).toBeLessThanOrEqual(.006);
});

test('depth preparation never mutates supplied indices, positions, weights or morph arrays', () => {
    const { document, primitive } = surface(), arrays = document.getRoot().listAccessors().map(accessor => accessor.getArray());
    const before = arrays.map(array => array.slice()); shadowLodIndices(primitive, .012);
    arrays.forEach((array, index) => expect(array).toEqual(before[index]));
});

test('the supplied small glove primitive keeps exact source indices instead of accepting an empty result', async () => {
    const manifest = JSON.parse(readFileSync('assets/equipment/runtime/manifest.json'));
    const variant = manifest.sources.find(row => row.item === 'Leather Gloves' && row.actorClass === 'Fighter' && row.tier === 'legendary').variants.high;
    expect(createHash('sha256').update(readFileSync(variant.file)).digest('hex')).toBe(variant.sha256);
    const document = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(variant.file);
    const primitive = document.getRoot().listMeshes().flatMap(mesh => mesh.listPrimitives()).find(primitive => primitive.getIndices().getCount() === 216);
    const original = new Uint32Array(primitive.getIndices().getArray());
    const result = shadowLodIndices(primitive);
    expect(result.indices).toEqual(original);
    expect(result.fallbackReason).toBe('empty-result-exact-source');
});

test.each(['negative-weight', 'out-of-range-index', 'missing-skin', 'invalid-morph', 'invalid-error'])('unsupported %s cannot become a shadow candidate', kind => {
    const { primitive } = surface();
    if (kind === 'negative-weight') primitive.getAttribute('WEIGHTS_0').getArray()[0] = -.1;
    if (kind === 'out-of-range-index') primitive.getIndices().getArray()[0] = 10000;
    if (kind === 'missing-skin') primitive.setAttribute('WEIGHTS_0', null);
    if (kind === 'invalid-morph') primitive.listTargets()[0].setAttribute('POSITION', null);
    expect(() => shadowLodIndices(primitive, kind === 'invalid-error' ? NaN : .006)).toThrow();
});
