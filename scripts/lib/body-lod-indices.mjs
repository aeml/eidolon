import { MeshoptSimplifier } from 'meshoptimizer';

await MeshoptSimplifier.ready;

// Index-only strict collapse, with additional surface-basis error and fixed
// blink vertices. No Permissive, no geometry update, no weaker positional error.
// Skin weights remain exact at retained vertices; posed interpolation still
// needs native motion review and is not proven by these attribute constraints.
export function bodyLodIndices(primitive, ratio, error, basisWeight = .25, morphBasis = false) {
    const position = primitive.getAttribute('POSITION'), positions = position.getArray(), count = position.getCount();
    const semantics = ['NORMAL', 'TANGENT', 'TEXCOORD_0'];
    if (!(positions instanceof Float32Array) || semantics.some(name => !primitive.getAttribute(name))) throw new Error('Body requires delivered float positions/normals/tangents/UV');
    const targets = primitive.listTargets();
    if (morphBasis && (targets.length !== 2 || targets.some(target =>
        target.listSemantics().some(name => !['POSITION', 'NORMAL'].includes(name)) ||
        !target.getAttribute('POSITION') || !target.getAttribute('NORMAL')))) throw new Error('Endpoint basis requires two supplied position/normal blink targets');
    const widths = semantics.map(name => primitive.getAttribute(name).getElementSize());
    const baseStride = widths.reduce((sum, n) => sum + n, 0), stride = baseStride + (morphBasis ? 9 : 0);
    const attributes = new Float32Array(count * stride), weights = [];
    semantics.forEach((name, i) => { for (let j = 0; j < widths[i]; j++) weights.push(name === 'TEXCOORD_0' ? .1 : basisWeight); });
    if (morphBasis) weights.push(...Array(9).fill(basisWeight));
    for (let vertex = 0; vertex < count; vertex++) {
        let offset = vertex * stride;
        for (const name of semantics) { const row = primitive.getAttribute(name).getElement(vertex, []); attributes.set(row, offset); offset += row.length; }
        if (morphBasis) {
            const normal = primitive.getAttribute('NORMAL').getElement(vertex, []);
            const deltas = targets.map(target => target.getAttribute('NORMAL').getElement(vertex, []));
            // All four corners of independent Blink_L/R in [0,1], including
            // the base normal above. Include every delta in this Float32
            // error basis; the supplied morph attributes remain untouched.
            for (const mask of [1, 2, 3]) for (let axis = 0; axis < 3; axis++) {
                attributes[offset++] = normal[axis] + (mask & 1 ? deltas[0][axis] : 0) + (mask & 2 ? deltas[1][axis] : 0);
            }
        }
    }
    const locks = new Uint8Array(count);
    for (const target of targets) for (const name of target.listSemantics()) {
        if (morphBasis && name !== 'POSITION') continue;
        const accessor = target.getAttribute(name), array = accessor.getArray(), width = accessor.getElementSize();
        for (let vertex = 0; vertex < count; vertex++) {
            for (let channel = 0; channel < width; channel++) if (array[vertex * width + channel] !== 0) { locks[vertex] = 1; break; }
        }
    }
    const indices = new Uint32Array(primitive.getIndices().getArray()), target = Math.floor(indices.length * ratio / 3) * 3;
    const [result, reportedError] = MeshoptSimplifier.simplifyWithAttributes(indices, positions, 3, attributes, stride, weights,
        locks, target, error, ['LockBorder']);
    if (result.length > indices.length || !Number.isFinite(reportedError) || reportedError > error) throw new Error('Invalid constrained body result');
    return { indices: result, reportedError, lockedMorphVertices: locks.reduce((sum, value) => sum + value, 0),
        morphBasis, attributeWidth: stride };
}
