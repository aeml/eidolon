import { Document } from '@gltf-transform/core';
import { bodyLodIndices } from '../scripts/lib/body-lod-indices.mjs';

function surface() {
    const document = new Document(), buffer = document.createBuffer(), side = 13, count = side * side;
    const accessor = (type, array) => document.createAccessor().setBuffer(buffer).setType(type).setArray(array);
    const positions = new Float32Array(count * 3), normals = new Float32Array(count * 3);
    const tangents = new Float32Array(count * 4), uv = new Float32Array(count * 2), indices = [];
    for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
        const i = y * side + x;
        positions.set([x / 12, y / 12, 0], i * 3); normals[i * 3 + 2] = 1;
        tangents.set([1, 0, 0, 1], i * 4); uv.set([x / 12, y / 12], i * 2);
        if (x < side - 1 && y < side - 1) indices.push(i, i + 1, i + side, i + 1, i + side + 1, i + side);
    }
    const primitive = document.createPrimitive().setAttribute('POSITION', accessor('VEC3', positions))
        .setAttribute('NORMAL', accessor('VEC3', normals)).setAttribute('TANGENT', accessor('VEC4', tangents))
        .setAttribute('TEXCOORD_0', accessor('VEC2', uv)).setIndices(accessor('SCALAR', new Uint16Array(indices)));
    const moving = [5 * side + 5, 7 * side + 7];
    for (let target = 0; target < 2; target++) {
        const delta = new Float32Array(count * 3), normalDelta = new Float32Array(count * 3);
        delta[moving[target] * 3 + 2] = .02;
        for (let i = 0; i < count; i++) normalDelta[i * 3] = 1e-7;
        normalDelta[moving[target] * 3] = .2;
        primitive.addTarget(document.createPrimitiveTarget().setAttribute('POSITION', accessor('VEC3', delta))
            .setAttribute('NORMAL', accessor('VEC3', normalDelta)));
    }
    return { primitive, moving, document };
}

test('normal-only blink deltas no longer freeze an otherwise reducible surface, while moving eyelid vertices remain', () => {
    const { primitive, moving } = surface();
    const previous = bodyLodIndices(primitive, .25, .002);
    const candidate = bodyLodIndices(primitive, .25, .002, .5, true);
    expect(previous.indices.length).toBe(primitive.getIndices().getCount());
    expect(candidate.indices.length).toBeLessThan(previous.indices.length * .75);
    for (const index of moving) expect(new Set(candidate.indices).has(index)).toBe(true);
    expect(candidate.lockedMorphVertices).toBe(moving.length);
    expect(candidate.reportedError).toBeLessThanOrEqual(.002);
});

test('endpoint simplification does not mutate any supplied base or blink attribute', () => {
    const { primitive, document } = surface();
    const arrays = document.getRoot().listAccessors().map(accessor => accessor.getArray());
    const before = arrays.map(array => array.slice());
    const candidate = bodyLodIndices(primitive, .25, .002, .5, true);
    arrays.forEach((array, i) => expect(array).toEqual(before[i]));
    expect([...candidate.indices].every(index => index < primitive.getAttribute('POSITION').getCount())).toBe(true);
});

test('unsupported morph semantics or missing independent blink target fail explicitly', () => {
    const first = surface();
    first.primitive.removeTarget(first.primitive.listTargets()[1]);
    expect(() => bodyLodIndices(first.primitive, .25, .002, .5, true)).toThrow(/two supplied/);
    const second = surface();
    second.primitive.listTargets()[0].setAttribute('TANGENT', second.primitive.getAttribute('TANGENT'));
    expect(() => bodyLodIndices(second.primitive, .25, .002, .5, true)).toThrow(/two supplied/);
});
