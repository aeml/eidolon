import catalog from '../data/gameplayGeometryPrecomputed.js';
import { GAMEPLAY_GEOMETRY_ALGORITHM } from './GameplayGeometryFingerprint.js';
import { decodeIndices } from './GameplayGeometryIndexCodec.js';
const hex = bytes => [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('');
const identity = (spec, maximum) => Number.isSafeInteger(spec?.bytes) && spec.bytes > 0 && spec.bytes <= maximum &&
    /^[a-f0-9]{64}$/.test(spec.sha256) && spec.url === `../../assets/gameplay-geometry/indices.${spec.sha256.slice(0, 16)}.bin`;

export function createGameplayGeometryLookup(spec, { fetcher = (...args) => fetch(...args), timeoutMs = 1500, baseURL = import.meta.url } = {}) {
    const loaded = new Map(); let disabled = false, queue = Promise.resolve();
    const sharded = spec?.schemaVersion === 2;
    const shards = sharded ? spec.shards : [spec];
    const valid = [1, 2].includes(spec?.schemaVersion) && spec.version === GAMEPLAY_GEOMETRY_ALGORITHM && spec.entries && Object.keys(spec.entries).length <= 256 &&
        Number.isFinite(timeoutMs) && timeoutMs > 0 && timeoutMs <= 1500 && identity(spec, 2 * 1024 * 1024) &&
        (!sharded || (Array.isArray(shards) && shards.length > 0 && shards.length <= 64 && shards.every(shard => identity(shard, 64 * 1024)) &&
            shards.reduce((sum, shard) => sum + shard.bytes, 0) === spec.bytes));
    const load = async shard => {
        const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetcher(new URL(shard.url, baseURL), { signal: controller.signal });
            if (!response.ok || !response.body) throw Error('Precomputed response unavailable');
            const declared = response.headers.get('content-length');
            if (!response.headers.get('content-encoding') && declared !== null && Number(declared) !== shard.bytes) throw Error('Unexpected response length');
            const bytes = new Uint8Array(shard.bytes), reader = response.body.getReader(); let offset = 0;
            try {
                for (;;) {
                    const chunk = await reader.read(); if (chunk.done) break;
                    if (offset + chunk.value.byteLength > bytes.length) throw Error('Oversized precomputed response');
                    bytes.set(chunk.value, offset); offset += chunk.value.byteLength;
                }
            } finally { await reader.cancel(); }
            if (offset !== bytes.length || hex(await crypto.subtle.digest('SHA-256', bytes)) !== shard.sha256) throw Error('Precomputed content identity mismatch');
            return bytes;
        } finally { clearTimeout(timeout); }
    };
    const get = shard => {
        if (!loaded.has(shard.sha256)) {
            // One bounded request at a time: first-needed body data need not
            // share its deadline/bandwidth with every queued equipment part.
            // The unchanged delivery owner still retires jobs at30seconds.
            const pending = queue.then(() => disabled ? null : load(shard));
            const settled = pending.catch(() => null);
            loaded.set(shard.sha256, settled); queue = settled;
        }
        return loaded.get(shard.sha256);
    };
    return async (key, kind, source) => {
        const row = valid && Object.hasOwn(spec.entries, key) ? spec.entries[key] : null;
        if (disabled || !valid || !row || row.kind !== kind) return null;
        try {
            if (!Number.isSafeInteger(row.offset) || !Number.isSafeInteger(row.length) || !Number.isSafeInteger(row.count) ||
                row.offset < 0 || row.length < 1 || row.offset + row.length > spec.bytes || row.count < 1 ||
                row.count > source.index.length || row.sourceIndexCount !== source.index.length ||
                row.vertices !== source.attributes.position.array.length / source.attributes.position.itemSize || row.count % 3 || !/^[a-f0-9]{64}$/.test(row.sha256) ||
                (row.fallback !== null && typeof row.fallback !== 'string')) throw Error('Invalid catalog row');
            const shard = sharded && Number.isSafeInteger(row.shard) && row.shard >= 0 ? shards[row.shard] : !sharded ? spec : null;
            const offset = sharded ? row.shardOffset : row.offset;
            if (!shard || !Number.isSafeInteger(offset) || offset < 0 || offset + row.length > shard.bytes) throw Error('Invalid shard row');
            const blob = await get(shard); if (!blob || disabled) return null;
            const vertices = source.attributes.position.array.length / source.attributes.position.itemSize;
            const indices = decodeIndices(blob.subarray(offset, offset + row.length), row.count, vertices);
            if (hex(await crypto.subtle.digest('SHA-256', indices)) !== row.sha256) throw Error('Output identity mismatch');
            return { indices, fallback: row.fallback, precomputed: true };
        } catch { disabled = true; return null; }
    };
}

// Worker-owned bounded caches and its request queue disappear when delivery
// terminates the worker. Failed shards remain cached as unavailable; no retries.
export const gameplayGeometryPrecomputed = createGameplayGeometryLookup(catalog);
