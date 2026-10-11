export const GAMEPLAY_GEOMETRY_ALGORITHM = 'supplied-indices-v1-.006-.12-collars';

// Exact decoded bytes, typed-array layouts, morph order and algorithm options.
export async function gameplayGeometryFingerprint(kind, source) {
    const buffers = [source.index], layout = { version: GAMEPLAY_GEOMETRY_ALGORITHM, kind,
        relative: source.morphTargetsRelative, ...(kind === 'rigid' ? { rigidVersion: 'boundary-collars-v1', quality: source.quality } : {}), attributes: [], morphs: [] };
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

