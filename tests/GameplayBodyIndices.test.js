import { jest } from '@jest/globals';
import { MeshoptSimplifier } from 'meshoptimizer';
import { gameplayBodyIndices } from '../scripts/lib/gameplay-body-indices.mjs';

function fixture() {
    const width = 36, height = 7, count = width * height, index = [];
    const attributes = Object.fromEntries(Object.entries({ position: 3, normal: 3, tangent: 4, uv: 2, skinIndex: 4, skinWeight: 4 })
        .map(([name, itemSize]) => [name, { itemSize, array: new Float32Array(count * itemSize) }]));
    const morphTargets = Array.from({ length: 2 }, () => Object.fromEntries(['position', 'normal']
        .map(name => [name, { itemSize: 3, array: new Float32Array(count * 3) }])));
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const vertex = y * width + x;
        attributes.position.array.set([x / 35, y / 6, 0], vertex * 3);
        attributes.normal.array.set([0, 0, 1], vertex * 3);
        attributes.tangent.array.set([1, 0, 0, x < 18 ? 1 : -1], vertex * 4);
        attributes.uv.array.set([x / 35, y / 6], vertex * 2);
        attributes.skinIndex.array.set([x, (x + 1) % 36, 0, 0], vertex * 4);
        attributes.skinWeight.array.set([.75, .25, 0, 0], vertex * 4);
        if (x < 9) morphTargets[0].position.array[vertex * 3 + 1] = .01;
        morphTargets[1].normal.array[vertex * 3] = 5.96e-8;
        if (x < 35 && y < 6) index.push(vertex, vertex + 1, vertex + width, vertex + 1, vertex + width + 1, vertex + width);
    }
    return { attributes, morphTargets, morphTargetsRelative: true, index: new Uint32Array(index) };
}

test('full bone palettes, tangent handedness and moving/nonmoving endpoints fit within32channels', () => {
    const source = fixture(), original = MeshoptSimplifier.simplifyWithAttributes;
    const spy = jest.spyOn(MeshoptSimplifier, 'simplifyWithAttributes').mockImplementation((index, positions, pStride, values, stride, weights, ...rest) => {
        expect(stride).toBeLessThanOrEqual(32); expect(weights).toHaveLength(stride);
        const vertices = new Set(index), bones = [...new Set([...vertices].flatMap(v => [source.attributes.skinIndex.array[v * 4], source.attributes.skinIndex.array[v * 4 + 1]]))].sort((a, b) => a - b);
        const moving = [...vertices].some(v => source.morphTargets[0].position.array[v * 3 + 1] !== 0), basisWidth = moving ? 26 : 17;
        expect(stride).toBe(basisWidth + bones.length);
        for (const v of vertices) {
            expect(values[v * stride + 8]).toBe(0); // left-only endpoint
            expect(values[v * stride + 11]).toBe(source.morphTargets[1].normal.array[v * 3]);
            for (const [i, bone] of bones.entries()) expect(values[v * stride + basisWidth + i]).toBe(
                (source.attributes.skinIndex.array[v * 4] === bone ? .75 : 0) + (source.attributes.skinIndex.array[v * 4 + 1] === bone ? .25 : 0));
            if (moving) {
                expect(values[v * stride + 18]).toBeCloseTo(source.attributes.position.array[v * 3 + 1] + source.morphTargets[0].position.array[v * 3 + 1], 6);
                expect(values[v * stride + 21]).toBe(source.attributes.position.array[v * 3 + 1]);
            }
        }
        return original(index, positions, pStride, values, stride, weights, ...rest);
    });
    try {
        const result = gameplayBodyIndices(source);
        expect(result.parts.some(part => part.positionEndpoints === 3)).toBe(true);
        expect(result.parts.some(part => part.positionEndpoints === 0)).toBe(true);
        expect(result.exactReasons.mixedHandedness).toBe(12);
        expect(result.candidateTriangles).toBeLessThan(result.inputTriangles);
    } finally { spy.mockRestore(); }
});

test('over-capacity moving triangle retains its exact source corners without weakening skin', () => {
    const source = fixture(), triangle = source.index.subarray(0, 3);
    for (const [i, vertex] of [...triangle].entries()) {
        source.attributes.skinIndex.array.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 3], vertex * 4);
        source.attributes.skinWeight.array.set([.25, .25, .25, .25], vertex * 4);
    }
    const result = gameplayBodyIndices(source);
    expect(result.exactReasons.triangleBoneCapacity).toBeGreaterThan(0);
    expect(Array.from(result.indices.subarray(0, 3))).toEqual(Array.from(triangle));
});

test('every raw supplied body and both blink buffers remain exact', () => {
    const source = fixture(), before = JSON.stringify(source);
    gameplayBodyIndices(source, { error: .012 });
    expect(JSON.stringify(source)).toBe(before);
});

test('position endpoints use common mesh extent and duplicate bone channels keep their full summed weight', () => {
    const source = fixture();
    source.attributes.position.array = source.attributes.position.array.map(value => value * 10);
    for (let vertex = 0; vertex < source.attributes.skinIndex.array.length / 4; vertex++) {
        source.attributes.skinIndex.array[vertex * 4 + 1] = source.attributes.skinIndex.array[vertex * 4];
    }
    const spy = jest.spyOn(MeshoptSimplifier, 'simplifyWithAttributes').mockImplementation((indices, _positions, _ps, values, stride) => {
        const vertices = new Set(indices), bones = [...new Set([...vertices].map(v => source.attributes.skinIndex.array[v * 4]))].sort((a, b) => a - b);
        const moving = [...vertices].some(v => source.morphTargets[0].position.array[v * 3 + 1] !== 0), basisWidth = moving ? 26 : 17;
        expect(stride).toBe(basisWidth + bones.length);
        for (const vertex of vertices) {
            expect(values[vertex * stride + basisWidth + bones.indexOf(source.attributes.skinIndex.array[vertex * 4])]).toBe(1);
            if (moving) expect(values[vertex * stride + 18]).toBeCloseTo(
                (source.attributes.position.array[vertex * 3 + 1] + source.morphTargets[0].position.array[vertex * 3 + 1]) / 10, 6);
        }
        return [indices, 0];
    });
    try { expect(gameplayBodyIndices(source).scale).toBe(10); } finally { spy.mockRestore(); }
});

test.each(['absolute-morph', 'extra-target', 'unknown-attribute', 'tangent-sign'])('unsupported %s retains original indices', kind => {
    const source = fixture();
    if (kind === 'absolute-morph') source.morphTargetsRelative = false;
    if (kind === 'extra-target') source.morphTargets.push(source.morphTargets[0]);
    if (kind === 'unknown-attribute') source.attributes.color = source.attributes.normal;
    if (kind === 'tangent-sign') source.attributes.tangent.array[3] = 0;
    expect(gameplayBodyIndices(source).indices).toEqual(source.index);
});

test('lost fixed signatures retain source collars and empty results retain source partitions', () => {
    for (const empty of [false, true]) {
        const calls = [], spy = jest.spyOn(MeshoptSimplifier, 'simplifyWithAttributes').mockImplementation((index, _p, _ps, _a, _as, _w, locks) => {
            calls.push({ indices: index.slice(), locks: locks.slice() });
            return [empty ? new Uint32Array() : index.slice(0, 3), 0];
        });
        try {
            const source = fixture(), result = gameplayBodyIndices(source), retained = new Set(result.indices);
            expect(result.candidateTriangles).toBeLessThanOrEqual(result.inputTriangles);
            expect(result.parts.some(part => empty ? part.emptyFallback : part.protectedSourceTriangles > 0)).toBe(true);
            // This fixture has unique positions: every originally fixed vertex
            // must survive either in an exact collar or the candidate interior.
            for (const call of calls) for (const vertex of new Set(call.indices)) if (call.locks[vertex]) expect(retained.has(vertex)).toBe(true);
            if (empty) {
                const triangles = array => Array.from({ length: array.length / 3 }, (_, i) => Array.from(array.subarray(i * 3, i * 3 + 3)).join(',')).sort();
                expect(triangles(result.indices)).toEqual(triangles(source.index));
            }
        } finally { spy.mockRestore(); }
    }
});

test.each(['negative-weight', 'invalid-bone', 'new-index', 'nonfinite-morph', 'invalid-error'])('invalid %s fails', kind => {
    const source = fixture();
    if (kind === 'negative-weight') source.attributes.skinWeight.array[0] = -.1;
    if (kind === 'invalid-bone') source.attributes.skinIndex.array[0] = .5;
    if (kind === 'new-index') source.index[0] = 99999;
    if (kind === 'nonfinite-morph') source.morphTargets[0].normal.array[0] = NaN;
    expect(() => gameplayBodyIndices(source, kind === 'invalid-error' ? { error: .5 } : {})).toThrow();
});

test('later morph preparation recomputes changed endpoints on the same source buffers', () => {
    const source = fixture(), before = gameplayBodyIndices(source);
    for (let vertex = 0; vertex < source.attributes.position.array.length / 3; vertex++)
        source.morphTargets[0].position.array[vertex * 3 + 1] = .02;
    const cloneAttributes = attributes => Object.fromEntries(Object.entries(attributes)
        .map(([name, attr]) => [name, { ...attr, array: attr.array.slice() }]));
    const copy = { ...source, index: source.index.slice(), attributes: cloneAttributes(source.attributes),
        morphTargets: source.morphTargets.map(cloneAttributes) };
    const after = gameplayBodyIndices(source);
    expect(after.movingReferencedVertices).toBeGreaterThan(before.movingReferencedVertices);
    expect(after).toEqual(gameplayBodyIndices(copy));
    expect(source).toEqual(copy);
});
