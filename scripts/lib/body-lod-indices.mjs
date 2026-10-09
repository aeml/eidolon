import { MeshoptSimplifier } from 'meshoptimizer';

await MeshoptSimplifier.ready;

// Index-only strict collapse, with additional surface-basis error and fixed
// blink vertices. No Permissive, no geometry update, no weaker positional error.
// Skin weights remain exact at retained vertices; posed interpolation still
// needs native motion review and is not proven by these attribute constraints.
export function bodyLodIndices(primitive, ratio, error, basisWeight = .25) {
    const position = primitive.getAttribute('POSITION'), positions = position.getArray(), count = position.getCount();
    const semantics = ['NORMAL', 'TANGENT', 'TEXCOORD_0'];
    if (!(positions instanceof Float32Array) || semantics.some(name => !primitive.getAttribute(name))) throw new Error('Body requires delivered float positions/normals/tangents/UV');
    const widths = semantics.map(name => primitive.getAttribute(name).getElementSize()), stride = widths.reduce((sum, n) => sum + n, 0);
    const attributes = new Float32Array(count * stride), weights = [];
    semantics.forEach((name, i) => { for (let j = 0; j < widths[i]; j++) weights.push(name === 'TEXCOORD_0' ? .1 : basisWeight); });
    for (let vertex = 0; vertex < count; vertex++) {
        let offset = vertex * stride;
        for (const name of semantics) { const row = primitive.getAttribute(name).getElement(vertex, []); attributes.set(row, offset); offset += row.length; }
    }
    const locks = new Uint8Array(count);
    for (const target of primitive.listTargets()) for (const name of target.listSemantics()) {
        const accessor = target.getAttribute(name), array = accessor.getArray(), width = accessor.getElementSize();
        for (let vertex = 0; vertex < count; vertex++) {
            for (let channel = 0; channel < width; channel++) if (array[vertex * width + channel] !== 0) { locks[vertex] = 1; break; }
        }
    }
    const indices = new Uint32Array(primitive.getIndices().getArray()), target = Math.floor(indices.length * ratio / 3) * 3;
    const [result, reportedError] = MeshoptSimplifier.simplifyWithAttributes(indices, positions, 3, attributes, stride, weights,
        locks, target, error, ['LockBorder']);
    if (result.length > indices.length || !Number.isFinite(reportedError) || reportedError > error) throw new Error('Invalid constrained body result');
    return { indices: result, reportedError, lockedMorphVertices: locks.reduce((sum, value) => sum + value, 0) };
}
