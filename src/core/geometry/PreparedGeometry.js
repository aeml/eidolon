import { BufferAttribute } from 'three';

// Keep the exact selected triangles, including every raw skin/morph/custom
// attribute value they read. Only unreferenced rows of the independent copy
// are removed; the source and its conservative bounds remain unchanged.
export function clonePreparedGeometry(source, indices) {
    const geometry = source.clone();
    const count = source.attributes.position.count;
    const attributes = [...Object.entries(source.attributes).map(([name, attribute]) => [geometry.attributes[name], attribute]),
        ...Object.entries(source.morphAttributes).flatMap(([name, targets]) => targets.map((attribute, index) => [geometry.morphAttributes[name][index], attribute]))];
    const fullCopy = () => {
        const copied = new Set();
        for (const [attribute, original] of attributes) if (original.isInterleavedBufferAttribute && !copied.has(attribute.data)) {
            attribute.data.array = original.data.array.slice(); attribute.data.count = original.data.count;
            copied.add(attribute.data);
        }
        geometry.setIndex(new BufferAttribute(indices.slice(), 1)); return geometry;
    };
    const supportsCompaction = Number.isSafeInteger(count) && count > 0 && count < 0xffffffff && indices.every(vertex => vertex < count) && attributes.every(([, attribute]) =>
        !attribute.isInstancedBufferAttribute && !attribute.data?.isInstancedInterleavedBuffer &&
        attribute.count === count && ArrayBuffer.isView(attribute.isInterleavedBufferAttribute ? attribute.data.array : attribute.array));
    if (!supportsCompaction) return fullCopy();
    const mapping = new Uint32Array(count); mapping.fill(0xffffffff);
    const vertices = [], remapped = new Uint32Array(indices.length);
    for (let i = 0; i < indices.length; i++) {
        const vertex = indices[i];
        if (mapping[vertex] === 0xffffffff) { mapping[vertex] = vertices.length; vertices.push(vertex); }
        remapped[i] = mapping[vertex];
    }
    if (vertices.length === count) return fullCopy();
    const streams = new Set();
    for (const [attribute, sourceAttribute] of attributes) {
        const stream = attribute.isInterleavedBufferAttribute ? attribute.data : attribute;
        if (streams.has(stream)) continue;
        streams.add(stream);
        const stride = attribute.isInterleavedBufferAttribute ? stream.stride : attribute.itemSize;
        // Read the original view, not clone()'s buffer-wide sharing cache:
        // distinct interleaved views can share one backing allocation.
        const original = sourceAttribute.isInterleavedBufferAttribute ? sourceAttribute.data.array : sourceAttribute.array;
        const compact = new original.constructor(vertices.length * stride);
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
