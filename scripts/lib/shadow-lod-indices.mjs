import { MeshoptSimplifier } from 'meshoptimizer';

await MeshoptSimplifier.ready;

// Exact surviving source vertices, all bone interpolation channels per triangle
// partition and fixed position-morph/depth seams. This prepares indices only;
// native animated shadow review remains separate from the error estimate.
function partitionedIndices(index, positions, blends, fixed, maximumError, depthSignatures) {
    const groups = [];
    for (let offset = 0; offset < index.length; offset += 3) {
        const triangle = Array.from(index.slice(offset, offset + 3));
        const bones = new Set(triangle.flatMap(vertex => [...blends[vertex].keys()]));
        if (bones.size > 32) throw new Error('Triangle exceeds full bone channels');
        let group = null, added = Infinity;
        for (const candidate of groups) {
            const extra = [...bones].filter(bone => !candidate.bones.has(bone)).length;
            if (candidate.bones.size + extra <= 32 && extra < added) { group = candidate; added = extra; }
        }
        if (!group) { group = { bones: new Set(), indices: [] }; groups.push(group); }
        for (const bone of bones) group.bones.add(bone);
        group.indices.push(...triangle);
    }
    const uses = new Uint16Array(blends.length), locks = fixed.slice();
    for (const group of groups) for (const vertex of new Set(group.indices)) uses[vertex]++;
    let shared = 0;
    for (let vertex = 0; vertex < uses.length; vertex++) if (uses[vertex] > 1) { locks[vertex] = 1; shared++; }
    const output = [], parts = [];
    let error = 0;
    for (const group of groups) {
        const bones = [...group.bones].sort((a, b) => a - b), stride = bones.length;
        for (const vertex of new Set(group.indices)) if ([...blends[vertex].keys()].some(bone => !group.bones.has(bone))) throw new Error('Unconstrained referenced bone');
        const attributes = new Float32Array(blends.length * stride);
        for (let vertex = 0; vertex < blends.length; vertex++) for (let channel = 0; channel < stride; channel++) attributes[vertex * stride + channel] = blends[vertex].get(bones[channel]) || 0;
        const [indices, reportedError] = MeshoptSimplifier.simplifyWithAttributes(new Uint32Array(group.indices), positions, 3,
            attributes, stride, Array(stride).fill(.1), locks, Math.floor(group.indices.length * .06 / 3) * 3, maximumError, ['LockBorder', 'Permissive']);
        if (!Number.isFinite(reportedError) || reportedError > maximumError || indices.length > group.indices.length) throw new Error('Invalid partition result');
        const sourceVertices = new Set(group.indices), retained = new Set(indices);
        if ([...retained].some(vertex => !sourceVertices.has(vertex))) throw new Error('New partition vertex');
        const retainedDepth = new Set([...retained].map(vertex => depthSignatures[vertex]));
        if ([...sourceVertices].some(vertex => locks[vertex] && !retainedDepth.has(depthSignatures[vertex]))) throw new Error('Fixed partition depth signature removed');
        output.push(...indices); error = Math.max(error, reportedError);
        parts.push({ activeBones: stride, inputTriangles: group.indices.length / 3, candidateTriangles: indices.length / 3 });
    }
    return [new Uint32Array(output), error, { groups: parts, sharedVertexLocks: shared }];
}


export function shadowLodIndices(primitive, maximumError = .006) {
    const position = primitive.getAttribute('POSITION'), index = primitive.getIndices();
    if (!Number.isFinite(maximumError) || maximumError <= 0 || maximumError > .05 ||
        !position || !(position.getArray() instanceof Float32Array) || position.getElementSize() !== 3 ||
        !index || index.getCount() % 3 || !index.getCount() ||
        !position.getArray().every(Number.isFinite) ||
        [...index.getArray()].some(vertex => !Number.isInteger(vertex) || vertex < 0 || vertex >= position.getCount())) throw new Error('Invalid source shadow geometry/error');
    for (const name of ['JOINTS_0', 'WEIGHTS_0']) {
        const accessor = primitive.getAttribute(name);
        if (accessor && (accessor.getElementSize() !== 4 || accessor.getCount() !== position.getCount())) throw new Error('Invalid source skin shape');
    }
    for (const morph of primitive.listTargets()) {
        const accessor = morph.getAttribute('POSITION');
        if (!accessor || accessor.getElementSize() !== 3 || accessor.getCount() !== position.getCount() ||
            !(accessor.getArray() instanceof Float32Array) || !accessor.getArray().every(Number.isFinite)) throw new Error('Invalid position morph shape');
    }
    const count = position.getCount(), joints = primitive.getAttribute('JOINTS_0'), skin = primitive.getAttribute('WEIGHTS_0');
    if (Boolean(joints) !== Boolean(skin)) throw new Error('Incomplete skin pair');
    const blends = [];
    for (let vertex = 0; vertex < count; vertex++) {
        const js = joints?.getElement(vertex, []) || [], ws = skin?.getElement(vertex, []) || [], blend = new Map();
        for (let channel = 0; channel < js.length; channel++) {
            if (!Number.isInteger(js[channel]) || js[channel] < 0 || !Number.isFinite(ws[channel]) || ws[channel] < 0) throw new Error('Invalid supplied skin');
            if (ws[channel]) blend.set(js[channel], (blend.get(js[channel]) || 0) + ws[channel]);
        }
        blends.push(blend);
    }
    const bones = [...new Set(blends.flatMap(blend => [...blend.keys()]))].sort((a, b) => a - b);
    // Partition a primitive exceeding 32 active bones into triangle sets.
    // Each set constrains every referenced bone; shared vertices are fixed.
    const stride = bones.length <= 32 ? bones.length : 0;
    const attributes = new Float32Array(count * stride), locks = new Uint8Array(count);
    for (let vertex = 0; vertex < count; vertex++) for (let channel = 0; channel < stride; channel++) attributes[vertex * stride + channel] = blends[vertex].get(bones[channel]) || 0;
    const remap = MeshoptSimplifier.generatePositionRemap(position.getArray(), 3), conflicts = new Set();
    const signatures = blends.map(blend => JSON.stringify([...blend].sort((a, b) => a[0] - b[0])));
    for (let vertex = 0; vertex < count; vertex++) if (signatures[vertex] !== signatures[remap[vertex]]) conflicts.add(remap[vertex]);
    for (let vertex = 0; vertex < count; vertex++) if (conflicts.has(remap[vertex])) locks[vertex] = 1;
    for (const target of primitive.listTargets()) {
        const delta = target.getAttribute('POSITION');
        for (let vertex = 0; vertex < count; vertex++) if (delta.getElement(vertex, []).some(value => value !== 0)) locks[vertex] = 1;
    }
    const depthSignatures = blends.map((blend, vertex) => JSON.stringify([position.getElement(vertex, []),
        [...blend].sort((a, b) => a[0] - b[0]), primitive.listTargets().map(target => target.getAttribute('POSITION').getElement(vertex, []))]));
    const ratio = .06, target = Math.floor(index.getCount() * ratio / 3) * 3;
    const [indices, reportedError, partition] = bones.length > 32 ? partitionedIndices(new Uint32Array(index.getArray()), position.getArray(), blends, locks, maximumError, depthSignatures) : MeshoptSimplifier.simplifyWithAttributes(new Uint32Array(index.getArray()), position.getArray(), 3,
        attributes, stride, Array(stride).fill(.1), locks, target, maximumError, ['LockBorder', 'Permissive']);
    if (!Number.isFinite(reportedError) || reportedError > maximumError || indices.length > index.getCount()) throw new Error('Invalid depth-only screen result');
    const referenced = new Set(index.getArray()), retained = new Set(indices);
    if ([...retained].some(vertex => !referenced.has(vertex))) throw new Error('New depth-only vertex');
    const retainedDepth = new Set([...retained].map(vertex => depthSignatures[vertex]));
    const protectedVertices = [...referenced].filter(vertex => locks[vertex]);
    if (protectedVertices.some(vertex => !retainedDepth.has(depthSignatures[vertex]))) throw new Error('Fixed depth-only signature removed');
    const lockedDepthSignaturesVerified = new Set(protectedVertices.map(vertex => depthSignatures[vertex])).size;
    // Some small/degenerate primitives simplify to an empty result without
    // Prune. Keep their exact supplied index rather than omit that content.
    if (!indices.length) return { indices: new Uint32Array(index.getArray()), reportedError: 0, ratio, maximumError,
        lockedDepthSignaturesVerified, activeBones: bones.length, partition,
        skinInterpolation: bones.length > 32 ? 'partitioned-canonical-dense-weight0.1' : 'canonical-dense-weight0.1',
        lockedVertices: locks.reduce((sum, value) => sum + value, 0), fallbackReason: 'empty-result-exact-source' };
    return { indices, reportedError, ratio, maximumError, lockedDepthSignaturesVerified, activeBones: bones.length,
        partition, skinInterpolation: bones.length > 32 ? 'partitioned-canonical-dense-weight0.1' : 'canonical-dense-weight0.1',
        lockedVertices: locks.reduce((sum, value) => sum + value, 0) };
}
