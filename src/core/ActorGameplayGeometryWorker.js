import { gameplayGeometryFingerprint } from './GameplayGeometryFingerprint.js';
import { gameplayGeometryPrecomputed } from './GameplayGeometryPrecomputed.js';

// Register the message listener before awaiting the WASM-backed algorithms.
// A first job arriving during compilation must not be lost.
let algorithms;

// Session-local bounded cache. SHA-256 covers exact decoded attributes, source
// indices (including body coverage), morph order and the algorithm/options.
const cache = new Map(), maxBytes = 16 * 1024 * 1024, maxEntries = 128;
let cacheBytes = 0;

self.addEventListener('message', async ({ data: { id, kind, source } }) => {
    try {
        if (!['body', 'color', 'rigid'].includes(kind)) throw new Error('Unsupported geometry kind');
        const key = await gameplayGeometryFingerprint(kind, source);
        let row = cache.get(key), cacheHit = Boolean(row);
        if (row) { cache.delete(key); cache.set(key, row); }
        else {
            row = await gameplayGeometryPrecomputed(key, kind, source);
            if (!row) {
                algorithms ||= import('./GameplayGeometryPreparation.js');
                const { prepareGameplayGeometry } = await algorithms;
                const result = prepareGameplayGeometry(kind, source);
                row = { indices: result.indices, fallback: result.fallback || null };
            }
            if (row.indices.byteLength <= maxBytes) {
                while (cache.size && (cache.size >= maxEntries || cacheBytes + row.indices.byteLength > maxBytes)) {
                    const oldest = cache.keys().next().value; cacheBytes -= cache.get(oldest).indices.byteLength; cache.delete(oldest);
                }
                cache.set(key, row); cacheBytes += row.indices.byteLength;
            }
        }
        const indices = row.indices.slice();
        self.postMessage({ id, key, indices, fallback: row.fallback, cacheHit, cacheBytes, cacheEntries: cache.size, precomputed: row.precomputed === true }, [indices.buffer]);
    } catch { self.postMessage({ id, error: 'geometry-preparation-failed' }); }
});
