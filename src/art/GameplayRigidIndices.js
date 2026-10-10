import { MeshoptSimplifier } from 'meshoptimizer';

await MeshoptSimplifier.ready;

// Index-only derivatives of delivered rigid hand equipment. Every referenced
// row remains an exact source row. Weighted UV/normal/tangent error constrains
// appearance; independent edge validation rejects new cracks or lost borders.
export function gameplayRigidIndices(source, { error = .006, ratio = .12, normalWeight = .15 } = {}) {
    const attrs = source?.attributes, input = source?.index, position = attrs?.position;
    if (!(input instanceof Uint32Array) || !input.length || input.length % 3 ||
        !(position?.array instanceof Float32Array) || position.itemSize !== 3 ||
        !Number.isFinite(error) || error <= 0 || error > .02 || !Number.isFinite(ratio) || ratio <= 0 || ratio > 1 ||
        !Number.isFinite(normalWeight) || normalWeight <= 0) throw Error('Invalid rigid geometry source/options');
    const fallback = reason => ({ indices: input.slice(), fallback: reason, error, ratio, normalWeight });
    const widths = { position: 3, normal: 3, tangent: 4, uv: 2 };
    if (Object.keys(attrs).some(name => !Object.hasOwn(widths, name)) || source.morphTargets ||
        !attrs.normal || !attrs.uv) return fallback('unsupported-rigid-attributes');
    const count = position.array.length / 3;
    if (!Number.isSafeInteger(count) || count <= 0 || input.some(vertex => vertex >= count)) throw Error('Invalid rigid geometry index');
    for (const [name, attr] of Object.entries(attrs)) if (attr.itemSize !== widths[name] ||
        !(attr.array instanceof Float32Array) || attr.array.length !== count * attr.itemSize || !attr.array.every(Number.isFinite))
        throw Error('Invalid rigid geometry attribute');
    const scale = MeshoptSimplifier.getScale(position.array, 3);
    if (!Number.isFinite(scale) || scale <= 0) return fallback('degenerate-rigid-scale');
    const basis = ['normal', 'tangent', 'uv'].filter(name => attrs[name]);
    const stride = basis.reduce((sum, name) => sum + attrs[name].itemSize, 0), values = new Float32Array(count * stride), weights = [];
    for (const name of basis) weights.push(...Array(attrs[name].itemSize).fill(name === 'uv' ? .1 : normalWeight));
    for (let vertex = 0; vertex < count; vertex++) {
        let offset = vertex * stride;
        for (const name of basis) {
            const attr = attrs[name]; values.set(attr.array.subarray(vertex * attr.itemSize, (vertex + 1) * attr.itemSize), offset); offset += attr.itemSize;
        }
    }
    const referenced = new Set(input), remap = MeshoptSimplifier.generatePositionRemap(position.array, 3);
    // Position edges ignore the duplicated UV/normal rows at hard seams. A
    // mismatched collapse across those rows would create a new open edge or
    // T-junction. Preserve every original boundary/nonmanifold edge exactly.
    const edges = indices => {
        const result = new Map();
        for (let i = 0; i < indices.length; i += 3) for (let side = 0; side < 3; side++) {
            const a = remap[indices[i + side]], b = remap[indices[i + (side + 1) % 3]];
            if (a === b) continue;
            const key = a < b ? `${a}:${b}` : `${b}:${a}`;
            result.set(key, (result.get(key) || 0) + 1);
        }
        return result;
    };
    const originalEdges = edges(input), locks = new Uint8Array(count), fixed = new Set();
    for (const [key, incidence] of originalEdges) if (incidence !== 2) {
        for (const vertex of key.split(':')) fixed.add(Number(vertex));
    }
    for (const vertex of referenced) if (fixed.has(remap[vertex])) locks[vertex] = 1;
    let remaining = input, indices, reportedError = 0, repairRounds = 0;
    const exact = [];
    for (;;) {
        if (!remaining.length) { indices = new Uint32Array(exact); break; }
        let candidate;
        [candidate, reportedError] = MeshoptSimplifier.simplifyWithAttributes(remaining, position.array, 3, values, stride,
            weights, locks, Math.floor(remaining.length * ratio / 3) * 3, error, ['LockBorder', 'Permissive']);
        const remainingVertices = new Set(remaining);
        if (!Number.isFinite(reportedError) || reportedError > error || candidate.length > remaining.length || candidate.length % 3 ||
            candidate.some(vertex => !remainingVertices.has(vertex))) throw Error('Invalid rigid geometry result');
        if (!candidate.length) { candidate = remaining; reportedError = 0; }
        indices = new Uint32Array([...exact, ...candidate]);
        const candidateEdges = edges(indices), affected = new Set();
        const mark = key => { for (const vertex of key.split(':')) affected.add(Number(vertex)); };
        for (const [key, incidence] of originalEdges) if (incidence !== 2 && candidateEdges.get(key) !== incidence) mark(key);
        for (const [key, incidence] of candidateEdges) if (incidence !== 2 && originalEdges.get(key) !== incidence) mark(key);
        if (!affected.size) break;
        if (repairRounds === 8) return fallback('rigid-boundary-repair-limit');
        const next = [];
        for (let offset = 0; offset < remaining.length; offset += 3) {
            const triangle = Array.from(remaining.subarray(offset, offset + 3));
            (triangle.some(vertex => affected.has(remap[vertex])) ? exact : next).push(...triangle);
        }
        if (next.length === remaining.length) return fallback('rigid-boundary-unrepairable');
        const collarPositions = new Set(exact.map(vertex => remap[vertex]));
        for (const vertex of next) if (collarPositions.has(remap[vertex])) locks[vertex] = 1;
        remaining = new Uint32Array(next); repairRounds++;
    }
    return { indices, error, ratio, normalWeight, inputTriangles: input.length / 3, candidateTriangles: indices.length / 3,
        protectedBoundaryPositions: fixed.size, protectedSourceTriangles: exact.length / 3, repairRounds, reportedError };
}
