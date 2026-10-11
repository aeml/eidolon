import { webcrypto } from 'node:crypto';
import { jest } from '@jest/globals';
import { createHash } from 'node:crypto';
import { createGameplayGeometryLookup } from '../src/core/GameplayGeometryPrecomputed.js';
import { encodeIndices } from '../src/core/GameplayGeometryIndexCodec.js';
import { GAMEPLAY_GEOMETRY_ALGORITHM } from '../src/core/GameplayGeometryFingerprint.js';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function fixture() {
    const indices = new Uint32Array([0, 1, 2]), bytes = encodeIndices(indices), sha256 = hash(bytes), key = 'a'.repeat(64);
    const spec = { schemaVersion: 1, version: GAMEPLAY_GEOMETRY_ALGORITHM, bytes: bytes.length, sha256,
        url: `../../assets/gameplay-geometry/indices.${sha256.slice(0, 16)}.bin`, entries: { [key]: {
            kind: 'body', offset: 0, length: bytes.length, count: 3, vertices: 3, sourceIndexCount: 6,
            sha256: hash(new Uint8Array(indices.buffer)), fallback: null } } };
    const source = { index: new Uint32Array(6), attributes: { position: { itemSize: 3, array: new Float32Array(9) } } };
    const fetcher = jest.fn(async () => response(bytes, { headers: { 'Content-Length': bytes.length } }));
    const make = options => createGameplayGeometryLookup(spec, { baseURL: 'https://example.test/game/src/core/ActorGameplayGeometryWorker.1234567890abcdef.js?release=sample', fetcher, ...options });
    return { indices, bytes, spec, key, source, fetcher, make };
}

test('known rows share one immutable fetch and return independent exact Uint32 outputs', async () => {
    const f = fixture(), lookup = f.make();
    const [a, b] = await Promise.all([lookup(f.key, 'body', f.source), lookup(f.key, 'body', f.source)]);
    expect(a.indices).toEqual(f.indices); expect(b.indices).toEqual(f.indices);
    a.indices[0] = 2; expect(b.indices).toEqual(f.indices); expect(a.fallback).toBeNull(); expect(a.precomputed).toBe(true);
    expect(f.fetcher).toHaveBeenCalledTimes(1);
    expect(String(f.fetcher.mock.calls[0][0])).toBe(`https://example.test/game/assets/gameplay-geometry/indices.${f.spec.sha256.slice(0, 16)}.bin`);
});

test('unknown source and mismatched kind avoid all data requests', async () => {
    const f = fixture(), lookup = f.make();
    expect(await lookup('b'.repeat(64), 'body', f.source)).toBeNull();
    expect(await lookup(f.key, 'rigid', f.source)).toBeNull(); expect(f.fetcher).not.toHaveBeenCalled();
});

test('transparent compressed responses validate decoded size rather than encoded Content-Length', async () => {
    const f = fixture(); f.fetcher.mockResolvedValue(response(f.bytes, { headers: { 'Content-Encoding': 'gzip', 'Content-Length': 22 } }));
    expect((await f.make()(f.key, 'body', f.source)).indices).toEqual(f.indices);
});

test.each(['network', 'http', 'length', 'oversized', 'truncated', 'content-hash', 'output-hash', 'decode', 'source-count', 'vertices', 'version', 'foreign-url'])(
    '%s failure falls back and never retries the provider', async mode => {
        const f = fixture();
        if (mode === 'network') f.fetcher.mockRejectedValue(Error('offline'));
        if (mode === 'http') f.fetcher.mockResolvedValue(response('', { status: 503 }));
        if (mode === 'length') f.fetcher.mockResolvedValue(response(f.bytes, { headers: { 'Content-Length': 99 } }));
        if (mode === 'oversized') f.fetcher.mockResolvedValue(response(new Uint8Array([...f.bytes, 0])));
        if (mode === 'truncated') f.fetcher.mockResolvedValue(response(f.bytes.subarray(1)));
        if (mode === 'content-hash') f.fetcher.mockResolvedValue(response(new Uint8Array([1, 2, 3])));
        if (mode === 'output-hash') f.spec.entries[f.key].sha256 = '0'.repeat(64);
        if (mode === 'decode') { const bytes = new Uint8Array([1, 2, 3]); f.spec.sha256 = hash(bytes); f.spec.url = `../../assets/gameplay-geometry/indices.${f.spec.sha256.slice(0, 16)}.bin`; f.fetcher.mockResolvedValue(response(bytes)); }
        if (mode === 'source-count') f.spec.entries[f.key].sourceIndexCount = 9;
        if (mode === 'vertices') f.spec.entries[f.key].vertices = 4;
        if (mode === 'version') f.spec.version = 'obsolete';
        if (mode === 'foreign-url') f.spec.url = 'https://elsewhere.test/indices.bin';
        const lookup = f.make(); expect(await lookup(f.key, 'body', f.source)).toBeNull(); expect(await lookup(f.key, 'body', f.source)).toBeNull();
        expect(f.fetcher.mock.calls.length).toBeLessThanOrEqual(1);
    });

test('the bounded timeout aborts the request and subsequent requests fall back immediately', async () => {
    const f = fixture(); let aborted = false;
    f.fetcher.mockImplementation((_url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => { aborted = true; reject(Error('aborted')); })));
    const lookup = f.make({ timeoutMs: 10 });
    expect(await lookup(f.key, 'body', f.source)).toBeNull(); expect(aborted).toBe(true);
    expect(await lookup(f.key, 'body', f.source)).toBeNull(); expect(f.fetcher).toHaveBeenCalledTimes(1);
});

const previousSubtle = Object.getOwnPropertyDescriptor(globalThis.crypto, 'subtle');
beforeAll(() => Object.defineProperty(globalThis.crypto, 'subtle', { configurable: true, value: webcrypto.subtle }));
afterAll(() => { if (previousSubtle) Object.defineProperty(globalThis.crypto, 'subtle', previousSubtle); else delete globalThis.crypto.subtle; });

function response(bytes, { headers = {}, status = 200 } = {}) {
    bytes = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
    const values = new Map(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value)]));
    return { ok: status >= 200 && status < 300, headers: { get: name => values.get(name) ?? null }, body: { getReader() {
        let read = false;
        return { read: async () => read ? { done: true } : (read = true, { value: bytes, done: false }), cancel: async () => {} };
    } } };
}
