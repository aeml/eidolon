import catalog from '../data/gameplayGeometryPrecomputed.js';
import { GAMEPLAY_GEOMETRY_ALGORITHM } from './GameplayGeometryFingerprint.js';
import { decodeIndices } from './GameplayGeometryIndexCodec.js';
const hex = bytes => [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('');

export function createGameplayGeometryLookup(spec, { fetcher = (...args) => fetch(...args), timeoutMs = 1500, baseURL = import.meta.url } = {}) {
    let loaded, disabled = false;
    const valid = spec?.schemaVersion === 1 && spec.version === GAMEPLAY_GEOMETRY_ALGORITHM && spec.entries && Object.keys(spec.entries).length <= 256 &&
        Number.isFinite(timeoutMs) && timeoutMs > 0 && timeoutMs <= 1500 && Number.isSafeInteger(spec.bytes) &&
        spec.bytes > 0 && spec.bytes <= 2 * 1024 * 1024 && /^[a-f0-9]{64}$/.test(spec.sha256) &&
        spec.url === `../../assets/gameplay-geometry/indices.${spec.sha256.slice(0, 16)}.bin`;
    const load = async () => {
        const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetcher(new URL(spec.url, baseURL), { signal: controller.signal });
            if (!response.ok || !response.body) throw Error('Precomputed response unavailable');
            const declared = response.headers.get('content-length');
            if (!response.headers.get('content-encoding') && declared !== null && Number(declared) !== spec.bytes) throw Error('Unexpected response length');
            const bytes = new Uint8Array(spec.bytes), reader = response.body.getReader(); let offset = 0;
            try {
                for (;;) {
                    const chunk = await reader.read(); if (chunk.done) break;
                    if (offset + chunk.value.byteLength > bytes.length) throw Error('Oversized precomputed response');
                    bytes.set(chunk.value, offset); offset += chunk.value.byteLength;
                }
            } finally { await reader.cancel(); }
            if (offset !== bytes.length || hex(await crypto.subtle.digest('SHA-256', bytes)) !== spec.sha256) throw Error('Precomputed content identity mismatch');
            return bytes;
        } finally { clearTimeout(timeout); }
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
            loaded ||= load();
            const blob = await loaded, vertices = source.attributes.position.array.length / source.attributes.position.itemSize;
            const indices = decodeIndices(blob.subarray(row.offset, row.offset + row.length), row.count, vertices);
            if (hex(await crypto.subtle.digest('SHA-256', indices)) !== row.sha256) throw Error('Output identity mismatch');
            return { indices, fallback: row.fallback, precomputed: true };
        } catch { disabled = true; return null; }
    };
}

// Worker-owned state disappears when the delivery owner terminates its worker.
export const gameplayGeometryPrecomputed = createGameplayGeometryLookup(catalog);
