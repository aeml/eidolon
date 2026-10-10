import * as THREE from 'three';
import { clonePreparedGeometry } from '../src/core/PreparedGeometry.js';

const rawRow = (attribute, index) => {
    const interleaved = attribute.isInterleavedBufferAttribute;
    const array = interleaved ? attribute.data.array : attribute.array;
    const offset = (index * (interleaved ? attribute.data.stride : attribute.itemSize) + (interleaved ? attribute.offset : 0)) * array.BYTES_PER_ELEMENT;
    return new Uint8Array(array.buffer, array.byteOffset + offset, attribute.itemSize * array.BYTES_PER_ELEMENT).slice();
};

function sourceGeometry() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(Array.from({ length: 18 }, (_, i) => i / 7), 3));
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(Array.from({ length: 24 }, (_, i) => i % 4), 4));
    geometry.setAttribute('skinWeight', new THREE.Uint8BufferAttribute(Array.from({ length: 24 }, (_, i) => i * 10), 4, true));
    geometry.setAttribute('uv', new THREE.Float16BufferAttribute(Array.from({ length: 12 }, (_, i) => 14000 + i), 2));
    geometry.attributes.uv.name = 'encoded-half'; geometry.attributes.uv.setUsage(THREE.DynamicDrawUsage);
    const data = new THREE.InterleavedBuffer(new Float32Array(Array.from({ length: 42 }, (_, i) => i / 11)), 7);
    geometry.setAttribute('normal', new THREE.InterleavedBufferAttribute(data, 3, 0));
    geometry.setAttribute('color', new THREE.InterleavedBufferAttribute(data, 3, 4));
    geometry.morphAttributes.position = [0, 1].map(n => new THREE.Float32BufferAttribute(Array.from({ length: 18 }, (_, i) => i * (n + 1)), 3));
    geometry.morphAttributes.normal = [0, 1].map(n => new THREE.Float32BufferAttribute(Array.from({ length: 18 }, (_, i) => i - n), 3));
    // Distinct NaN payloads and signed zero must survive raw typed-array copying.
    new Uint32Array(geometry.attributes.position.array.buffer)[9] = 0x7fc01234;
    geometry.attributes.position.array[10] = -0;
    geometry.setIndex([0, 1, 2, 3, 4, 5]);
    geometry.name = 'prepared-fixture'; geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(1, 2, 3), 99);
    return geometry;
}

test.each([false, true])('compaction preserves all selected raw vertex and independent morph rows (relative=%s)', relative => {
    const source = sourceGeometry(); source.morphTargetsRelative = relative;
    const indices = new Uint32Array([3, 1, 2, 2, 1, 3]);
    const original = [...Object.values(source.attributes), ...Object.values(source.morphAttributes).flat()].map(a =>
        (a.isInterleavedBufferAttribute ? a.data.array : a.array).slice());
    const candidate = clonePreparedGeometry(source, indices);
    try {
        expect([...candidate.index.array]).toEqual([0, 1, 2, 2, 1, 0]);
        expect(candidate.attributes.position.count).toBe(3);
        expect(candidate.attributes.normal.data).toBe(candidate.attributes.color.data);
        expect(candidate.attributes.normal.data.array.length).toBe(21);
        const originals = [source.attributes, ...Object.values(source.morphAttributes).map(targets => Object.fromEntries(targets.map((a, i) => [i, a])))];
        const copies = [candidate.attributes, ...Object.values(candidate.morphAttributes).map(targets => Object.fromEntries(targets.map((a, i) => [i, a])))];
        originals.forEach((attributes, group) => Object.entries(attributes).forEach(([name, attribute]) => {
            const copy = copies[group][name];
            for (let corner = 0; corner < indices.length; corner++) expect(rawRow(copy, candidate.index.array[corner])).toEqual(rawRow(attribute, indices[corner]));
            const buffer = a => (a.isInterleavedBufferAttribute ? a.data.array : a.array).buffer;
            expect(buffer(copy)).not.toBe(buffer(attribute));
        }));
        expect(candidate.attributes.uv.isFloat16BufferAttribute).toBe(true);
        expect(candidate.attributes.uv.usage).toBe(THREE.DynamicDrawUsage);
        expect(candidate.attributes.uv.name).toBe('encoded-half');
        expect(candidate.attributes.skinWeight.normalized).toBe(true);
        expect(candidate.morphTargetsRelative).toBe(relative);
        expect(candidate.morphAttributes.position[0].array.buffer).not.toBe(candidate.morphAttributes.position[1].array.buffer);
        expect(candidate.boundingSphere.equals(source.boundingSphere)).toBe(true);
        expect(candidate.name).toBe(source.name);
        const current = [...Object.values(source.attributes), ...Object.values(source.morphAttributes).flat()];
        current.forEach((a, i) => expect(a.isInterleavedBufferAttribute ? a.data.array : a.array).toEqual(original[i]));
    } finally { source.dispose(); candidate.dispose(); }
});

test.each(['different-count', 'instanced', 'invalid-index', 'all-vertices'])('uncompactable %s retains independent full storage and original indices', reason => {
    const source = sourceGeometry();
    let indices = new Uint32Array([3, 1, 2]);
    if (reason === 'different-count') source.setAttribute('custom', new THREE.Float32BufferAttribute([1], 1));
    if (reason === 'instanced') source.setAttribute('custom', new THREE.InstancedBufferAttribute(new Float32Array(6), 1));
    if (reason === 'invalid-index') indices = new Uint32Array([3, 1, 200]);
    if (reason === 'all-vertices') indices = new Uint32Array([3, 1, 2, 4, 5, 0]);
    const candidate = clonePreparedGeometry(source, indices);
    try {
        expect(candidate.attributes.position.array).toEqual(source.attributes.position.array);
        expect(candidate.attributes.position.array).not.toBe(source.attributes.position.array);
        expect(candidate.index.array).toEqual(indices); expect(candidate.index.array).not.toBe(indices);
    } finally { source.dispose(); candidate.dispose(); }
});

test.each([false, true])('distinct interleaved views keep their source rows (full=%s)', full => {
    const source = sourceGeometry(), values = new Float32Array(84);
    for (let i = 0; i < values.length; i++) values[i] = i + 0.25;
    const first = new THREE.InterleavedBuffer(values.subarray(0, 42), 7);
    const second = new THREE.InterleavedBuffer(values.subarray(42), 7);
    source.setAttribute('normal', new THREE.InterleavedBufferAttribute(first, 3, 0));
    source.setAttribute('color', new THREE.InterleavedBufferAttribute(second, 3, 4));
    const indices = new Uint32Array(full ? [3, 1, 2, 0, 4, 5] : [3, 1, 2]), candidate = clonePreparedGeometry(source, indices);
    try {
        for (const name of ['normal', 'color']) for (let i = 0; i < indices.length; i++)
            expect(rawRow(candidate.attributes[name], candidate.index.array[i])).toEqual(rawRow(source.attributes[name], indices[i]));
        expect(candidate.attributes.normal.data.array.buffer).not.toBe(candidate.attributes.color.data.array.buffer);
    } finally { source.dispose(); candidate.dispose(); }
});
