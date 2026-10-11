import { MeshoptSimplifier } from 'meshoptimizer';

await MeshoptSimplifier.ready;

// Unselected gameplay-camera experiment. Only indices change. Approximate
// endpoint/skin penalties do not bound every animated pose or rendered pixel.
export function gameplayBodyIndices(source, { error = .006, ratio = .12, normalWeight = .25 } = {}) {
    const attrs = source.attributes, input = source.index, position = attrs?.position;
    if (!(position?.array instanceof Float32Array) || position.itemSize !== 3 ||
        !(input instanceof Uint32Array) || !input.length || input.length % 3 ||
        !Number.isFinite(error) || error <= 0 || error > .02 || !Number.isFinite(ratio) || ratio <= 0 || ratio > 1 ||
        !Number.isFinite(normalWeight) || normalWeight <= 0) throw new Error('Invalid gameplay body source/options');
    const count = position.array.length / 3;
    if (!Number.isInteger(count) || [...input].some(v => v >= count)) throw new Error('Invalid body index');
    const fallback = reason => ({ indices: input.slice(), fallback: reason, error, ratio, normalWeight });
    const widths = { position: 3, normal: 3, tangent: 4, uv: 2, skinIndex: 4, skinWeight: 4 };
    const targets = source.morphTargets;
    if (Object.keys(attrs).some(name => !Object.hasOwn(widths, name)) || Object.entries(widths).some(([name, width]) => attrs[name]?.itemSize !== width) ||
        source.morphTargetsRelative !== true || !Array.isArray(targets) || targets.length !== 2 ||
        targets.some(target => Object.keys(target).sort().join(',') !== 'normal,position' ||
            target.position?.itemSize !== 3 || target.normal?.itemSize !== 3)) return fallback('unsupported-body-or-blink-basis');
    for (const attr of [...Object.values(attrs), ...targets.flatMap(target => Object.values(target))]) {
        if (!(attr.array instanceof Float32Array) || attr.array.length !== count * attr.itemSize || !attr.array.every(Number.isFinite)) throw new Error('Invalid body attribute');
    }
    const scale = MeshoptSimplifier.getScale(position.array, 3);
    if (!Number.isFinite(scale) || scale <= 0) return fallback('degenerate-body-scale');
    const referenced = new Set(input), blends = Array.from({ length: count }, () => new Map()), moving = new Uint8Array(count);
    for (const vertex of referenced) {
        for (let channel = 0; channel < 4; channel++) {
            const bone = attrs.skinIndex.array[vertex * 4 + channel], weight = attrs.skinWeight.array[vertex * 4 + channel];
            if (!Number.isInteger(bone) || bone < 0 || weight < 0) throw new Error('Invalid supplied body skin');
            if (weight) blends[vertex].set(bone, (blends[vertex].get(bone) || 0) + weight);
        }
        if (![1, -1].includes(attrs.tangent.array[vertex * 4 + 3])) return fallback('unsupported-tangent-handedness');
        for (const target of targets) for (let axis = 0; axis < 3; axis++) if (target.position.array[vertex * 3 + axis] !== 0) moving[vertex] = 1;
    }
    const categories = new Map(), exact = [], exactReasons = { mixedHandedness: 0, triangleBoneCapacity: 0 };
    for (let offset = 0; offset < input.length; offset += 3) {
        const triangle = Array.from(input.subarray(offset, offset + 3)), handedness = attrs.tangent.array[triangle[0] * 4 + 3];
        if (triangle.some(v => attrs.tangent.array[v * 4 + 3] !== handedness)) { exact.push(...triangle); exactReasons.mixedHandedness++; continue; }
        const hasMovement = triangle.some(v => moving[v]), basisWidth = hasMovement ? 26 : 17, capacity = 32 - basisWidth;
        const bones = new Set(triangle.flatMap(v => [...blends[v].keys()]));
        if (bones.size > capacity) { exact.push(...triangle); exactReasons.triangleBoneCapacity++; continue; }
        const key = `${handedness}:${hasMovement}`;
        if (!categories.has(key)) categories.set(key, []);
        let chosen = null, minimum = Infinity;
        for (const group of categories.get(key)) {
            const added = [...bones].filter(bone => !group.bones.has(bone)).length;
            if (group.bones.size + added <= capacity && added < minimum) { chosen = group; minimum = added; }
        }
        if (!chosen) { chosen = { bones: new Set(), indices: [], hasMovement, handedness, basisWidth }; categories.get(key).push(chosen); }
        for (const bone of bones) chosen.bones.add(bone);
        chosen.indices.push(...triangle);
    }
    const groups = [...categories.values()].flat(), locks = new Uint8Array(count), uses = new Uint32Array(count);
    for (const group of groups) for (const vertex of new Set(group.indices)) uses[vertex]++;
    for (const vertex of new Set(exact)) uses[vertex]++;
    const remap = MeshoptSimplifier.generatePositionRemap(position.array, 3), signatures = new Map(), conflicts = new Set();
    for (const vertex of referenced) {
        const signature = JSON.stringify([[...blends[vertex]].sort((a, b) => a[0] - b[0]),
            targets.map(target => Array.from(target.position.array.subarray(vertex * 3, vertex * 3 + 3))), attrs.tangent.array[vertex * 4 + 3]]);
        if (signatures.has(remap[vertex]) && signatures.get(remap[vertex]) !== signature) conflicts.add(remap[vertex]);
        signatures.set(remap[vertex], signature);
    }
    const fixedPositions = new Set([...referenced].filter(vertex => uses[vertex] > 1 || conflicts.has(remap[vertex])).map(vertex => remap[vertex]));
    for (const vertex of referenced) if (fixedPositions.has(remap[vertex])) locks[vertex] = 1;
    const signatureAttributes = [...Object.keys(widths).sort().map(name => attrs[name]), ...targets.flatMap(target => [target.position, target.normal])];
    // Repair rounds revisit the same exact rows. Keep these strings local to
    // this invocation so later coverage/morph changes are always recomputed.
    const vertexSignatures = new Array(count);
    const vertexSignature = vertex => vertexSignatures[vertex] ??= JSON.stringify(signatureAttributes.flatMap(attr =>
        Array.from(attr.array.subarray(vertex * attr.itemSize, (vertex + 1) * attr.itemSize))));
    const output = [...exact], parts = [];
    for (const group of groups) {
        const bones = [...group.bones].sort((a, b) => a - b), stride = group.basisWidth + bones.length;
        const vertices = new Set(group.indices), values = new Float32Array(count * stride);
        const weights = [...Array(6).fill(normalWeight), .1, .1, ...Array(9).fill(normalWeight),
            ...Array(group.hasMovement ? 9 : 0).fill(1), ...bones.map(() => .1)];
        for (const vertex of vertices) {
            let offset = vertex * stride;
            for (const name of ['normal', 'tangent', 'uv']) {
                const attr = attrs[name], width = name === 'tangent' ? 3 : attr.itemSize;
                values.set(attr.array.subarray(vertex * attr.itemSize, vertex * attr.itemSize + width), offset); offset += width;
            }
            for (const name of ['normal', ...(group.hasMovement ? ['position'] : [])]) {
                // Base geometry and all three independent blink endpoints.
                // Position attributes use full-mesh extent units, matching the
                // relative positional error scale. No tiny delta is removed.
                for (const mask of [1, 2, 3]) for (let axis = 0; axis < 3; axis++) values[offset++] =
                    (attrs[name].array[vertex * 3 + axis] + (mask & 1 ? targets[0][name].array[vertex * 3 + axis] : 0) +
                        (mask & 2 ? targets[1][name].array[vertex * 3 + axis] : 0)) / (name === 'position' ? scale : 1);
            }
            if ([...blends[vertex].keys()].some(bone => !group.bones.has(bone))) throw new Error('Unconstrained body bone');
            for (const bone of bones) values[offset++] = blends[vertex].get(bone) || 0;
        }
        const original = new Uint32Array(group.indices), partLocks = locks.slice(), exactCollar = [];
        let remaining = original, indices, reportedError = 0, emptyFallback = false, fixedSignatureFallback = false, repairRounds = 0;
        for (;;) {
            if (!remaining.length) { indices = new Uint32Array(exactCollar); break; }
            let candidate;
            const remainingVertices = new Set(remaining);
            [candidate, reportedError] = MeshoptSimplifier.simplifyWithAttributes(remaining, position.array, 3, values, stride,
                weights, partLocks, Math.floor(remaining.length * ratio / 3) * 3, error, ['LockBorder']);
            if (!Number.isFinite(reportedError) || reportedError > error || candidate.length > remaining.length ||
                [...candidate].some(v => !remainingVertices.has(v))) throw new Error('Invalid body candidate');
            if (!candidate.length) { candidate = remaining; reportedError = 0; emptyFallback = true; }
            indices = new Uint32Array([...exactCollar, ...candidate]);
            const retained = new Set([...new Set(indices)].map(vertexSignature));
            const missing = [...vertices].filter(v => partLocks[v] && !retained.has(vertexSignature(v)));
            if (!missing.length) break;
            if (repairRounds === 8) { indices = original; reportedError = 0; fixedSignatureFallback = true; break; }
            // Retain every source triangle incident to an affected position,
            // then lock the new shared boundary. This grows an exact collar;
            // it never accepts a missing protected signature or changes data.
            const affected = new Set(missing.map(v => remap[v])), next = [];
            for (let offset = 0; offset < remaining.length; offset += 3) {
                const triangle = Array.from(remaining.subarray(offset, offset + 3));
                (triangle.some(v => affected.has(remap[v])) ? exactCollar : next).push(...triangle);
            }
            if (next.length === remaining.length) throw new Error('No source triangles for missing body seam');
            const exactPositions = new Set(exactCollar.map(v => remap[v]));
            for (const vertex of next) if (exactPositions.has(remap[vertex])) partLocks[vertex] = 1;
            remaining = new Uint32Array(next); repairRounds++;
        }
        output.push(...indices);
        parts.push({ inputTriangles: original.length / 3, candidateTriangles: indices.length / 3, activeBones: bones.length,
            attributeWidth: stride, positionEndpoints: group.hasMovement ? 3 : 0, normalEndpoints: 3,
            handedness: group.handedness, reportedError, emptyFallback, fixedSignatureFallback,
            repairRounds, protectedSourceTriangles: exactCollar.length / 3 });
    }
    if (!output.length || output.length > input.length) throw new Error('Invalid body output');
    return { indices: new Uint32Array(output), error, ratio, normalWeight, scale,
        inputTriangles: input.length / 3, candidateTriangles: output.length / 3, exactTriangles: exact.length / 3, exactReasons,
        movingReferencedVertices: [...referenced].filter(v => moving[v]).length,
        lockedVertices: locks.reduce((sum, value) => sum + value, 0), parts };
}
