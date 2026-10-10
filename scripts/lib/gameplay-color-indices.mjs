import { MeshoptSimplifier } from 'meshoptimizer';

await MeshoptSimplifier.ready;

// Experimental indices for supplied, already fitted opaque gear/eyes. No
// vertex relocation or attribute rewriting. A geometric/weighted error is not
// a pixel or posed-error guarantee; gameplay-camera native review is required.
export function gameplayColorIndices(source, { error = .006, ratio = .12, normalWeight = .15 } = {}) {
    const attrs = source.attributes, position = attrs.position, input = source.index;
    if (!(position?.array instanceof Float32Array) || position.itemSize !== 3 ||
        !input?.length || input.length % 3 || !Number.isFinite(error) || error <= 0 || error > .02 ||
        !Number.isFinite(ratio) || ratio <= 0 || ratio > 1 || !Number.isFinite(normalWeight) || normalWeight <= 0) throw new Error('Invalid gameplay color source/options');
    const count = position.array.length / 3;
    if (!Number.isInteger(count) || [...input].some(vertex => !Number.isInteger(vertex) || vertex < 0 || vertex >= count)) throw new Error('Invalid source triangle index');
    const fallback = reason => ({ indices: new Uint32Array(input), fallback: reason, error, ratio, normalWeight });
    const allowed = ['position', 'normal', 'tangent', 'uv', 'skinIndex', 'skinWeight', 'fittedDiffuseRoughness', 'fittedEmissiveMetalness'];
    if (Object.keys(attrs).some(name => !allowed.includes(name)) || source.morphTargets) return fallback('unsupported-attributes-or-morphs');
    if (!attrs.normal || attrs.normal.itemSize !== 3 || !attrs.skinIndex || !attrs.skinWeight ||
        attrs.skinIndex.itemSize !== 4 || attrs.skinWeight.itemSize !== 4 ||
        Boolean(attrs.fittedDiffuseRoughness) !== Boolean(attrs.fittedEmissiveMetalness) ||
        attrs.fittedDiffuseRoughness && (attrs.fittedDiffuseRoughness.itemSize !== 4 || attrs.fittedEmissiveMetalness.itemSize !== 4) ||
        attrs.uv && attrs.uv.itemSize !== 2 || attrs.tangent && attrs.tangent.itemSize !== 4) return fallback('unsupported-attribute-shape');
    for (const attr of Object.values(attrs)) {
        if (attr.array.length !== count * attr.itemSize || !attr.array.every(Number.isFinite)) throw new Error('Invalid source attribute data');
    }
    const referenced = new Set(input), blends = Array.from({ length: count }, () => new Map());
    for (const vertex of referenced) for (let channel = 0; channel < 4; channel++) {
        const bone = attrs.skinIndex.array[vertex * 4 + channel], weight = attrs.skinWeight.array[vertex * 4 + channel];
        if (!Number.isInteger(bone) || bone < 0 || weight < 0) throw new Error('Invalid supplied skin');
        if (weight) blends[vertex].set(bone, (blends[vertex].get(bone) || 0) + weight);
    }
    const basis = ['normal', 'tangent', 'uv'].filter(name => attrs[name]);
    const basisWidth = basis.reduce((sum, name) => sum + attrs[name].itemSize, 0), capacity = 32 - basisWidth;
    const surfaceNames = ['fittedDiffuseRoughness', 'fittedEmissiveMetalness'].filter(name => attrs[name]);
    const surface = vertex => JSON.stringify(surfaceNames.flatMap(name => Array.from(attrs[name].array.subarray(vertex * 4, vertex * 4 + 4))));
    const materials = new Map(), exactMixed = [];
    for (let offset = 0; offset < input.length; offset += 3) {
        const triangle = Array.from(input.subarray(offset, offset + 3));
        const signature = surface(triangle[0]);
        // Mixed-factor triangles retain their exact corners and interpolation.
        if (triangle.some(vertex => surface(vertex) !== signature)) { exactMixed.push(...triangle); continue; }
        const bones = new Set(triangle.flatMap(vertex => [...blends[vertex].keys()]));
        if (bones.size > capacity) return fallback('triangle-exceeds-full-bone-channels');
        if (!materials.has(signature)) materials.set(signature, []);
        const groups = materials.get(signature);
        let chosen = null, minimum = Infinity;
        for (const group of groups) {
            const added = [...bones].filter(bone => !group.bones.has(bone)).length;
            if (group.bones.size + added <= capacity && added < minimum) { chosen = group; minimum = added; }
        }
        if (!chosen) { chosen = { bones: new Set(), indices: [] }; groups.push(chosen); }
        for (const bone of bones) chosen.bones.add(bone);
        chosen.indices.push(...triangle);
    }
    const groups = [...materials.values()].flat(), locks = new Uint8Array(count), uses = new Uint16Array(count);
    for (const group of groups) for (const vertex of new Set(group.indices)) uses[vertex]++;
    for (const vertex of new Set(exactMixed)) uses[vertex]++;
    const remap = MeshoptSimplifier.generatePositionRemap(position.array, 3), byPosition = new Map(), conflicts = new Set();
    for (const vertex of referenced) {
        const key = remap[vertex], signature = JSON.stringify([...blends[vertex]].sort((a, b) => a[0] - b[0]));
        if (byPosition.has(key) && byPosition.get(key) !== signature) conflicts.add(key);
        byPosition.set(key, signature);
    }
    for (const vertex of referenced) if (uses[vertex] > 1 || conflicts.has(remap[vertex])) locks[vertex] = 1;
    const signatureNames = Object.keys(attrs).sort();
    const vertexSignature = vertex => JSON.stringify(signatureNames.flatMap(name => {
        const attr = attrs[name]; return Array.from(attr.array.subarray(vertex * attr.itemSize, (vertex + 1) * attr.itemSize));
    }));
    const output = [...exactMixed], parts = [];
    for (const group of groups) {
        const bones = [...group.bones].sort((a, b) => a - b), stride = basisWidth + bones.length;
        const vertices = new Set(group.indices), values = new Float32Array(count * stride), weights = [];
        for (const name of basis) weights.push(...Array(attrs[name].itemSize).fill(name === 'uv' ? .1 : normalWeight));
        weights.push(...bones.map(() => .1));
        for (const vertex of vertices) {
            if ([...blends[vertex].keys()].some(bone => !group.bones.has(bone))) throw new Error('Unconstrained referenced bone');
            let offset = vertex * stride;
            for (const name of basis) {
                const attr = attrs[name]; values.set(attr.array.subarray(vertex * attr.itemSize, (vertex + 1) * attr.itemSize), offset); offset += attr.itemSize;
            }
            for (const bone of bones) values[offset++] = blends[vertex].get(bone) || 0;
        }
        const original = new Uint32Array(group.indices);
        let [indices, reportedError] = MeshoptSimplifier.simplifyWithAttributes(original, position.array, 3, values, stride,
            weights, locks, Math.floor(original.length * ratio / 3) * 3, error, ['LockBorder', 'Permissive']);
        const emptyFallback = !indices.length;
        if (emptyFallback) { indices = original; reportedError = 0; }
        if (!Number.isFinite(reportedError) || reportedError > error || indices.length > original.length ||
            [...indices].some(vertex => !vertices.has(vertex))) throw new Error('Invalid gameplay color result');
        const retained = new Set(indices), signatures = new Set([...retained].map(vertexSignature));
        const fixedSignatureFallback = [...vertices].some(vertex => locks[vertex] && !signatures.has(vertexSignature(vertex)));
        if (fixedSignatureFallback) { indices = original; reportedError = 0; }
        output.push(...indices);
        parts.push({ inputTriangles: original.length / 3, candidateTriangles: indices.length / 3, activeBones: bones.length,
            attributeWidth: stride, reportedError, emptyFallback, fixedSignatureFallback });
    }
    if (output.length > input.length || !output.length) throw new Error('Invalid full color output');
    return { indices: new Uint32Array(output), error, ratio, normalWeight,
        inputTriangles: input.length / 3, candidateTriangles: output.length / 3,
        materialRegions: materials.size, exactMixedTriangles: exactMixed.length / 3,
        lockedVertices: locks.reduce((sum, value) => sum + value, 0), parts };
}
