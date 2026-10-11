import { webcrypto } from 'node:crypto';
import { gameplayGeometryFingerprint } from '../src/core/GameplayGeometryFingerprint.js';

function source() {
    return { index: new Uint32Array([0, 1, 2]), morphTargetsRelative: true, quality: 'high', attributes: {
        position: { itemSize: 3, array: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]) },
        normal: { itemSize: 3, array: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]) }
    }, morphTargets: [{ position: { itemSize: 3, array: new Float32Array(9) } }, { position: { itemSize: 3, array: new Float32Array(9).fill(1) } }] };
}

test('keys exact views, ignores neighboring allocation bytes and canonicalizes attribute names', async () => {
    const a = source(), b = source();
    const allocation = new Float32Array(15).fill(999); allocation.set(a.attributes.position.array, 3);
    b.attributes.position.array = allocation.subarray(3, 12);
    b.attributes = { normal: b.attributes.normal, position: b.attributes.position };
    expect(await gameplayGeometryFingerprint('body', a)).toBe(await gameplayGeometryFingerprint('body', b));
    expect(a.index).toEqual(new Uint32Array([0, 1, 2])); expect(allocation[0]).toBe(999);
});

test.each(['positions', 'indices', 'width', 'array-type', 'morph-order', 'morph-bytes', 'relative', 'kind', 'rigid-quality'])(
    'a changed %s cannot reuse another exact source key', async change => {
        const a = source(), b = source(); let kind = 'body', otherKind = 'body';
        if (change === 'positions') b.attributes.position.array[0] = .001;
        if (change === 'indices') b.index[0] = 2;
        if (change === 'width') b.attributes.normal.itemSize = 1;
        if (change === 'array-type') b.attributes.normal.array = new Uint32Array(b.attributes.normal.array.buffer);
        if (change === 'morph-order') b.morphTargets.reverse();
        if (change === 'morph-bytes') b.morphTargets[0].position.array[0] = .001;
        if (change === 'relative') b.morphTargetsRelative = false;
        if (change === 'kind') otherKind = 'color';
        if (change === 'rigid-quality') { kind = otherKind = 'rigid'; b.quality = 'low'; }
        expect(await gameplayGeometryFingerprint(kind, a)).not.toBe(await gameplayGeometryFingerprint(otherKind, b));
    });

const previousSubtle = Object.getOwnPropertyDescriptor(globalThis.crypto, 'subtle');
beforeAll(() => Object.defineProperty(globalThis.crypto, 'subtle', { configurable: true, value: webcrypto.subtle }));
afterAll(() => { if (previousSubtle) Object.defineProperty(globalThis.crypto, 'subtle', previousSubtle); else delete globalThis.crypto.subtle; });
