import fs from 'node:fs';
import committedCatalog from '../src/data/gameplayGeometryPrecomputed.js';
import { decodeIndices } from '../src/core/GameplayGeometryIndexCodec.js';
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


function shardedFixture() {
    const f = fixture(), other = new Uint32Array([2, 1, 0]), otherBytes = encodeIndices(other), key = 'b'.repeat(64);
    const descriptor = bytes => ({ bytes: bytes.length, sha256: hash(bytes), url: `../../assets/gameplay-geometry/indices.${hash(bytes).slice(0, 16)}.bin` });
    const joined = new Uint8Array([...f.bytes, ...otherBytes]);
    const spec = { ...f.spec, ...descriptor(joined), schemaVersion: 2, shards: [descriptor(f.bytes), descriptor(otherBytes)], entries: {
        [f.key]: { ...f.spec.entries[f.key], shard: 0, shardOffset: 0 },
        [key]: { ...f.spec.entries[f.key], offset: f.bytes.length, shard: 1, shardOffset: 0, sha256: hash(new Uint8Array(other.buffer)) }
    } };
    const fetcher = jest.fn(async url => response(String(url).includes(spec.shards[0].sha256.slice(0, 16)) ? f.bytes : otherBytes));
    return { ...f, spec, other, key2: key, fetcher, make: options => createGameplayGeometryLookup(spec, { baseURL: 'https://example.test/game/src/core/worker.js', fetcher, ...options }) };
}

test('known rows download only needed shards and repeated lookups share exact independent outputs', async () => {
    const f = shardedFixture(), lookup = f.make();
    const [a, b] = await Promise.all([lookup(f.key, 'body', f.source), lookup(f.key, 'body', f.source)]);
    expect(a.indices).toEqual(f.indices); a.indices[0] = 2; expect(b.indices).toEqual(f.indices);
    expect(f.fetcher).toHaveBeenCalledTimes(1); expect(String(f.fetcher.mock.calls[0][0])).toContain(f.spec.shards[0].sha256.slice(0, 16));
    expect((await lookup(f.key2, 'body', f.source)).indices).toEqual(f.other); expect(f.fetcher).toHaveBeenCalledTimes(2);
});

test('different shards queue a single network request at a time without competing for bandwidth', async () => {
    const f = shardedFixture(); let complete;
    f.fetcher.mockImplementationOnce(() => new Promise(resolve => { complete = () => resolve(response(f.bytes)); }));
    const lookup = f.make(), a = lookup(f.key, 'body', f.source), b = lookup(f.key2, 'body', f.source);
    await Promise.resolve(); expect(f.fetcher).toHaveBeenCalledTimes(1); complete();
    expect((await a).indices).toEqual(f.indices); expect((await b).indices).toEqual(f.other); expect(f.fetcher).toHaveBeenCalledTimes(2);
});

test('invalid metadata retires queued shard fetches and ignores an already active response', async () => {
    const f = shardedFixture(); let complete;
    f.fetcher.mockImplementationOnce(() => new Promise(resolve => { complete = () => resolve(response(f.bytes)); }));
    const lookup = f.make(), a = lookup(f.key, 'body', f.source), b = lookup(f.key2, 'body', f.source);
    await Promise.resolve(); expect(f.fetcher).toHaveBeenCalledTimes(1);
    expect(await lookup(f.key, 'body', { ...f.source, index: new Uint32Array(9) })).toBeNull();
    complete(); expect(await a).toBeNull(); expect(await b).toBeNull(); expect(f.fetcher).toHaveBeenCalledTimes(1);
});

test('one unavailable shard does not retry it or discard a different valid shard', async () => {
    const f = shardedFixture(); f.fetcher.mockRejectedValueOnce(Error('offline'));
    const lookup = f.make(); expect(await lookup(f.key, 'body', f.source)).toBeNull();
    expect((await lookup(f.key2, 'body', f.source)).indices).toEqual(f.other);
    expect(await lookup(f.key, 'body', f.source)).toBeNull(); expect(f.fetcher).toHaveBeenCalledTimes(2);
});

test.each(['size', 'foreign-url', 'total', 'row-index', 'row-offset', 'row-range'])('invalid shard %s fails closed before fetching', async mode => {
    const f = shardedFixture();
    if (mode === 'size') f.spec.shards[0].bytes = 65537;
    if (mode === 'foreign-url') f.spec.shards[0].url = 'https://elsewhere.test/data.bin';
    if (mode === 'total') f.spec.bytes++;
    if (mode === 'row-index') f.spec.entries[f.key].shard = 99;
    if (mode === 'row-offset') f.spec.entries[f.key].shardOffset = -1;
    if (mode === 'row-range') f.spec.entries[f.key].shardOffset = 1;
    expect(await f.make()(f.key, 'body', f.source)).toBeNull(); expect(f.fetcher).not.toHaveBeenCalled();
});

test('a64KiBperSecond transfer completes a needed shard within1500ms while the monolith aborts', async () => {
    jest.useFakeTimers();
    try {
        const spec = JSON.parse(JSON.stringify(committedCatalog)), [key, row] = Object.entries(spec.entries)[0];
        const source = { index: new Uint32Array(row.sourceIndexCount), attributes: { position: { itemSize: 3, array: new Float32Array(row.vertices * 3) } } };
        const full = fs.readFileSync(spec.url.slice(6)), shard = fs.readFileSync(spec.shards[row.shard].url.slice(6)), aborted = [];
        const fetcher = jest.fn(async (url, { signal }) => {
            const bytes = String(url).endsWith(spec.url.split('/').at(-1)) ? full : shard; let read = false;
            return { ok: true, headers: { get: name => name === 'content-length' ? String(bytes.length) : null }, body: { getReader: () => ({
                read: () => read ? Promise.resolve({ done: true }) : (read = true, new Promise((resolve, reject) => {
                    const stop = () => { clearTimeout(timer); aborted.push(bytes.length); reject(Error('aborted')); };
                    const timer = setTimeout(() => { signal.removeEventListener('abort', stop); resolve({ value: bytes, done: false }); }, Math.ceil(bytes.length / (65536 / 1000)));
                    signal.addEventListener('abort', stop, { once: true });
                })), cancel: async () => {}
            }) } };
        });
        const legacy = createGameplayGeometryLookup({ ...spec, schemaVersion: 1 }, { fetcher, baseURL: 'https://example.test/game/src/core/worker.js' });
        const first = legacy(key, row.kind, source); await jest.advanceTimersByTimeAsync(1500); expect(await first).toBeNull(); expect(aborted).toEqual([777321]);
        const modern = createGameplayGeometryLookup(spec, { fetcher, baseURL: 'https://example.test/game/src/core/worker.js' });
        const next = modern(key, row.kind, source); await jest.advanceTimersByTimeAsync(1500);
        expect((await next).indices).toEqual(decodeIndices(new Uint8Array(full.subarray(row.offset, row.offset + row.length)), row.count, row.vertices));
        expect(aborted).toEqual([777321]); expect(fetcher).toHaveBeenCalledTimes(2);
    } finally { jest.useRealTimers(); }
});
