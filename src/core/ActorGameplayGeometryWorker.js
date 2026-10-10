// Register the message listener before awaiting the WASM-backed algorithms.
// A first job arriving during compilation must not be lost.
let algorithms;

// Session-local bounded cache. SHA-256 covers exact decoded attributes, source
// indices (including body coverage), morph order and the algorithm/options.
const cache = new Map(), maxBytes = 16 * 1024 * 1024, maxEntries = 128;
let cacheBytes = 0;
async function keyOf(kind, source) {
    const buffers = [source.index], layout = { version: 'supplied-indices-v1-.006-.12-collars', kind,
        relative: source.morphTargetsRelative, attributes: [], morphs: [] };
    const append = (attrs, output) => {
        for (const name of Object.keys(attrs).sort()) {
            const { itemSize, array } = attrs[name];
            output.push([name, itemSize, array.constructor.name, array.length]); buffers.push(array);
        }
    };
    append(source.attributes, layout.attributes);
    for (const target of source.morphTargets || []) { const attrs = []; append(target, attrs); layout.morphs.push(attrs); }
    layout.index = [source.index.constructor.name, source.index.length];
    const header = new TextEncoder().encode(JSON.stringify(layout)), size = header.length + buffers.reduce((sum, array) => sum + array.byteLength, 0);
    const bytes = new Uint8Array(size); bytes.set(header); let offset = header.length;
    for (const array of buffers) { bytes.set(new Uint8Array(array.buffer, array.byteOffset, array.byteLength), offset); offset += array.byteLength; }
    return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

self.addEventListener('message', async ({ data: { id, kind, source } }) => {
    try {
        if (!['body', 'color'].includes(kind)) throw new Error('Unsupported geometry kind');
        algorithms ||= Promise.all([import('../art/GameplayBodyIndices.js'), import('../art/GameplayColorIndices.js')]);
        const [{ gameplayBodyIndices }, { gameplayColorIndices }] = await algorithms;
        const key = await keyOf(kind, source);
        let row = cache.get(key), cacheHit = Boolean(row);
        if (row) { cache.delete(key); cache.set(key, row); }
        else {
            const result = kind === 'body' ? gameplayBodyIndices(source) : gameplayColorIndices(source, { repairSeams: true });
            row = { indices: result.indices, fallback: result.fallback || null };
            if (row.indices.byteLength <= maxBytes) {
                while (cache.size && (cache.size >= maxEntries || cacheBytes + row.indices.byteLength > maxBytes)) {
                    const oldest = cache.keys().next().value; cacheBytes -= cache.get(oldest).indices.byteLength; cache.delete(oldest);
                }
                cache.set(key, row); cacheBytes += row.indices.byteLength;
            }
        }
        const indices = row.indices.slice();
        self.postMessage({ id, key, indices, fallback: row.fallback, cacheHit, cacheBytes, cacheEntries: cache.size }, [indices.buffer]);
    } catch { self.postMessage({ id, error: 'geometry-preparation-failed' }); }
});
