import { decodeIndices, encodeIndices } from '../src/core/GameplayGeometryIndexCodec.js';

test.each([
    [0, 1, 2, 2, 1, 0], [65535, 0, 65534], [4294967295, 0, 4294967295],
    [0, 0, 0], [128, 16384, 2097152]
])('losslessly preserves triangle order and Uint32 delta endpoints: %j', (...values) => {
    const source = new Uint32Array(values), copy = source.slice();
    const bytes = encodeIndices(source), decoded = decodeIndices(bytes, source.length, 4294967296);
    expect(decoded).toEqual(source); expect(source).toEqual(copy);
    expect(encodeIndices(decoded)).toEqual(bytes);
});

test.each([
    ['truncated', [128], 1, 5], ['overlong zero', [128, 0], 1, 5],
    ['six lanes', [255, 255, 255, 255, 255, 0], 1, 5], ['33-bit overflow', [255, 255, 255, 255, 32], 1, 5],
    ['negative index', [1], 1, 5], ['vertex overflow', [10], 1, 5], ['trailing byte', [0, 0], 1, 5],
    ['empty vertices', [0], 1, 0], ['unsafe output count', [], 4194305, 1], ['fractional count', [], .5, 1]
])('rejects %s before accepting any output', (_name, bytes, count, vertices) => {
    expect(() => decodeIndices(new Uint8Array(bytes), count, vertices)).toThrow();
});
