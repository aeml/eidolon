// Lossless source-index deltas; vertex attributes and index order stay exact.
export function decodeIndices(bytes, count, vertices) {
    if (!(bytes instanceof Uint8Array) || !Number.isSafeInteger(count) || count < 0 || count > 4 * 1024 * 1024 ||
        !Number.isSafeInteger(vertices) || vertices < 1) throw Error('Invalid output bounds');
    const indices = new Uint32Array(count);
    let offset = 0, previous = 0;
    for (let i = 0; i < count; i++) {
        let value = 0, scale = 1, last = 0, lanes = 0;
        do {
            if (offset >= bytes.length || lanes === 5) throw Error('Truncated or excessive varint');
            last = bytes[offset++]; value += (last & 127) * scale; scale *= 128; lanes++;
        } while (last & 128);
        if ((lanes > 1 && !(last & 127)) || value > 8589934590) throw Error('Noncanonical or excessive delta');
        previous += value % 2 ? -(value + 1) / 2 : value / 2;
        if (!Number.isSafeInteger(previous) || previous < 0 || previous > 4294967295 || previous >= vertices) throw Error('Index outside source vertices');
        indices[i] = previous;
    }
    if (offset !== bytes.length) throw Error('Trailing encoded bytes');
    return indices;
}

export function encodeIndices(indices) {
    if (!(indices instanceof Uint32Array)) throw Error('Uint32 indices required');
    const bytes = [];
    let previous = 0;
    for (const index of indices) {
        const delta = index - previous; previous = index;
        let value = delta >= 0 ? delta * 2 : -delta * 2 - 1;
        while (value >= 128) { bytes.push((value % 128) | 128); value = Math.floor(value / 128); }
        bytes.push(value);
    }
    return new Uint8Array(bytes);
}
