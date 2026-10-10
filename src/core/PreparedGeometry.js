import { BufferAttribute } from 'three';

// Keep the exact selected triangles, including every raw skin/morph/custom
// attribute value they read. Only unreferenced rows of the independent copy
// are removed; the source and its conservative bounds remain unchanged.
export function clonePreparedGeometry(source, indices) {
    const geometry = source.clone();
    const count = source.attributes.position.count;
    const attributes = [...Object.values(geometry.attributes), ...Object.values(geometry.morphAttributes).flat()];
    const supportsCompaction = Number.isSafeInteger(count) && count > 0 && count < 0xffffffff && indices.every(vertex => vertex < count) && attributes.every(attribute =>
        !attribute.isInstancedBufferAttribute && !attribute.data?.isInstancedInterleavedBuffer &&
        attribute.count === count && ArrayBuffer.isView(attribute.isInterleavedBufferAttribute ? attribute.data.array : attribute.array));
    if (!supportsCompaction) { geometry.setIndex(new BufferAttribute(indices.slice(), 1)); return geometry; }
    const mapping = new Uint32Array(count); mapping.fill(0xffffffff);
    const vertices = [], remapped = new Uint32Array(indices.length);
    for (let i = 0; i < indices.length; i++) {
        const vertex = indices[i];
        if (mapping[vertex] === 0xffffffff) { mapping[vertex] = vertices.length; vertices.push(vertex); }
        remapped[i] = mapping[vertex];
    }
    if (vertices.length === count) { geometry.setIndex(new BufferAttribute(indices.slice(), 1)); return geometry; }
    const streams = new Set();
    for (const attribute of attributes) {
        const stream = attribute.isInterleavedBufferAttribute ? attribute.data : attribute;
        if (streams.has(stream)) continue;
        streams.add(stream);
        const stride = attribute.isInterleavedBufferAttribute ? stream.stride : attribute.itemSize;
        const original = stream.array, compact = new original.constructor(vertices.length * stride);
        // Typed-array row copies preserve float16 encodings, normalized
        // integers, interleaved padding, signed zero and floating-point bits.
        for (let i = 0; i < vertices.length; i++) {
            compact.set(original.subarray(vertices[i] * stride, (vertices[i] + 1) * stride), i * stride);
        }
        stream.array = compact; stream.count = vertices.length;
    }
    geometry.setIndex(new BufferAttribute(remapped, 1));
    return geometry;
}
