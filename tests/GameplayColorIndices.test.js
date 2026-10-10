import { gameplayColorIndices } from '../scripts/lib/gameplay-color-indices.mjs';
import { MeshoptSimplifier } from 'meshoptimizer';
import { jest } from '@jest/globals';

function fixture() {
    const width = 36, height = 7, count = width * height, index = [];
    const attributes = Object.fromEntries([['position', 3], ['normal', 3], ['uv', 2], ['skinIndex', 4], ['skinWeight', 4],
        ['fittedDiffuseRoughness', 4], ['fittedEmissiveMetalness', 4]].map(([name, itemSize]) =>
        [name, { itemSize, array: new Float32Array(count * itemSize) }]));
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const vertex = y * width + x;
        attributes.position.array.set([x / (width - 1), y / (height - 1), 0], vertex * 3);
        attributes.normal.array.set([0, 0, 1], vertex * 3);
        attributes.uv.array.set([x / (width - 1), y / (height - 1)], vertex * 2);
        attributes.skinIndex.array[vertex * 4] = x;
        attributes.skinWeight.array[vertex * 4] = 1;
        attributes.fittedDiffuseRoughness.array.set([x < 18 ? 1 : .2, .5, .3, .7], vertex * 4);
        attributes.fittedEmissiveMetalness.array.set([0, 0, 0, .1], vertex * 4);
        if (x < width - 1 && y < height - 1) index.push(vertex, vertex + 1, vertex + width, vertex + 1, vertex + width + 1, vertex + width);
    }
    return { attributes, index: new Uint32Array(index) };
}

test('all material regions and mixed-factor triangles survive with full bone channels', () => {
    const source = fixture(), result = gameplayColorIndices(source);
    expect(result.materialRegions).toBe(2); expect(result.exactMixedTriangles).toBe(12);
    expect(result.parts.every(part => part.attributeWidth <= 32 && part.activeBones > 0)).toBe(true);
    expect(result.parts.every(part => part.candidateTriangles > 0 && part.reportedError <= .006)).toBe(true);
    expect(result.candidateTriangles).toBeLessThan(result.inputTriangles);
    const mixed = [];
    for (let i = 0; i < source.index.length; i += 3) {
        const tri = source.index.subarray(i, i + 3), colors = new Set([...tri].map(v => source.attributes.fittedDiffuseRoughness.array[v * 4]));
        if (colors.size > 1) mixed.push(...tri);
    }
    expect(Array.from(result.indices.subarray(0, mixed.length))).toEqual(mixed);
});

test('over32-bone single-material surface is partitioned without dropping its interpolation channels', () => {
    const source = fixture(); delete source.attributes.fittedDiffuseRoughness; delete source.attributes.fittedEmissiveMetalness;
    const result = gameplayColorIndices(source);
    expect(result.parts.length).toBeGreaterThan(1);
    expect(result.parts.every(part => part.attributeWidth <= 32)).toBe(true);
    expect(result.lockedVertices).toBeGreaterThan(0);
    expect([...result.indices].every(vertex => new Set(source.index).has(vertex))).toBe(true);
});

test('source indices and every supplied attribute remain unchanged', () => {
    const source = fixture(), before = { index: source.index.slice(), attributes: Object.fromEntries(
        Object.entries(source.attributes).map(([name, attr]) => [name, { ...attr, array: attr.array.slice() }])) };
    gameplayColorIndices(source, { error: .012 });
    expect(source).toEqual(before);
});

test('unknown attributes and body morphs retain exact original indices', () => {
    const source = fixture(); source.morphTargets = 2;
    expect(gameplayColorIndices(source).indices).toEqual(source.index);
    delete source.morphTargets; source.attributes.customColor = source.attributes.normal;
    expect(gameplayColorIndices(source).fallback).toBe('unsupported-attributes-or-morphs');
});

test('a simplifier that loses fixed seam signatures retains every exact source triangle', () => {
    const source = fixture(), simplifier = jest.spyOn(MeshoptSimplifier, 'simplifyWithAttributes')
        .mockImplementation(indices => [indices.slice(0, 3), 0]);
    try {
        const result = gameplayColorIndices(source);
        expect(result.parts.every(part => part.fixedSignatureFallback)).toBe(true);
        expect(result.candidateTriangles).toBe(result.inputTriangles);
        const triangles = array => Array.from({ length: array.length / 3 }, (_, i) => Array.from(array.subarray(i * 3, i * 3 + 3)).join(',')).sort();
        expect(triangles(result.indices)).toEqual(triangles(source.index));
    } finally { simplifier.mockRestore(); }
});

test.each(['negative-weight', 'new-index', 'nonfinite-normal', 'invalid-error'])('invalid %s fails before returning a candidate', kind => {
    const source = fixture();
    if (kind === 'negative-weight') source.attributes.skinWeight.array[0] = -.1;
    if (kind === 'new-index') source.index[0] = 99999;
    if (kind === 'nonfinite-normal') source.attributes.normal.array[0] = NaN;
    expect(() => gameplayColorIndices(source, kind === 'invalid-error' ? { error: .2 } : {})).toThrow();
});
