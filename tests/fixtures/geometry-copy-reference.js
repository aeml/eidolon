// Frozen copy producer from84b295e6; baseline for actual-input ABBA timings.
import { BufferAttribute, InterleavedBufferAttribute } from 'three';

// Staged delivery; callers explicitly own tracking, the worker and controller.
// Never transfer a live Three buffer or keep source copies queued on the UI thread.
function copyAttribute(attribute) {
    // Supplied packed floats need no component decoding. Copy only this view,
    // preserving source ownership. Normalized and custom readers retain their
    // original component-reading path below.
    if (attribute.isBufferAttribute && attribute.normalized === false &&
        attribute.array instanceof Float32Array && attribute.array.length === attribute.count * attribute.itemSize &&
        attribute.getComponent === BufferAttribute.prototype.getComponent) {
        return { itemSize: attribute.itemSize, array: new Float32Array(attribute.array) };
    }
    const array = new Float32Array(attribute.count * attribute.itemSize);
    // GLTFLoader retains the supplied files' interleaved float views. Gather
    // their lanes without per-component division or method dispatch; padding
    // and neighboring attributes never enter the worker's copied payload.
    if (attribute.isInterleavedBufferAttribute && attribute.normalized === false &&
        attribute.array instanceof Float32Array &&
        attribute.getComponent === InterleavedBufferAttribute.prototype.getComponent) {
        let output = 0;
        for (let vertex = 0; vertex < attribute.count; vertex++) {
            const start = vertex * attribute.data.stride + attribute.offset;
            for (let component = 0; component < attribute.itemSize; component++) array[output++] = attribute.array[start + component];
        }
        return { itemSize: attribute.itemSize, array };
    }
    for (let i = 0; i < array.length; i++) array[i] = attribute.getComponent(Math.floor(i / attribute.itemSize), i % attribute.itemSize);
    return { itemSize: attribute.itemSize, array };
}

export function copyGameplayGeometry(generation, maxBytes) {
    const geometry = generation.source;
    const attributes = Object.values(geometry.attributes);
    const morphs = Object.values(geometry.morphAttributes).flat();
    const bytes = geometry.index.count * 4 + [...attributes, ...morphs].reduce((sum, attr) => sum + attr.count * attr.itemSize * 4, 0);
    if (bytes > maxBytes) return null;
    const rigid = generation.kind === 'rigid';
    const body = !rigid && /_Body$/.test(generation.mesh.name);
    if (body && (Object.keys(generation.mesh.morphTargetDictionary || {}).sort().join(',') !== 'Blink_L,Blink_R' ||
        Object.keys(geometry.morphAttributes).sort().join(',') !== 'normal,position' ||
        geometry.morphAttributes.position.length !== 2 || geometry.morphAttributes.normal.length !== 2)) return null;
    if (!body && morphs.length) return null;
    const source = { attributes: Object.fromEntries(Object.entries(geometry.attributes).map(([name, attr]) => [name, copyAttribute(attr)])),
        index: new Uint32Array(geometry.index.array), morphTargetsRelative: geometry.morphTargetsRelative, ...(rigid ? { quality: generation.quality } : {}) };
    if (body) source.morphTargets = geometry.morphAttributes.position.map((attr, index) => ({
        position: copyAttribute(attr), normal: copyAttribute(geometry.morphAttributes.normal[index]) }));
    const transfers = [source.index.buffer, ...Object.values(source.attributes).map(attr => attr.array.buffer),
        ...(source.morphTargets || []).flatMap(target => Object.values(target).map(attr => attr.array.buffer))];
    return { kind: rigid ? 'rigid' : body ? 'body' : 'color', source, bytes, transfers };
}
