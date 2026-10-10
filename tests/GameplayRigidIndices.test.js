import * as THREE from 'three';
import { jest } from '@jest/globals';
import { MeshoptSimplifier } from 'meshoptimizer';
import { gameplayRigidIndices } from '../src/art/GameplayRigidIndices.js';

function pack(geometry) {
    return { index: new Uint32Array(geometry.index.array), attributes: Object.fromEntries(Object.entries(geometry.attributes)
        .map(([name, attribute]) => [name, { itemSize: attribute.itemSize, array: new Float32Array(attribute.array) }])) };
}
function boundaries(source, indices) {
    const remap = MeshoptSimplifier.generatePositionRemap(source.attributes.position.array, 3), edges = new Map();
    for (let i = 0; i < indices.length; i += 3) for (let j = 0; j < 3; j++) {
        const a = remap[indices[i + j]], b = remap[indices[i + (j + 1) % 3]];
        if (a === b) continue;
        const key = a < b ? `${a}:${b}` : `${b}:${a}`; edges.set(key, (edges.get(key) || 0) + 1);
    }
    return [...edges].filter(([, count]) => count !== 2).sort();
}

test.each([.006, .012])('curved UV/hard-normal seams keep geometric continuity at error%s', error => {
    const geometry = new THREE.CylinderGeometry(.3, .3, 2, 48, 12), source = pack(geometry), before = JSON.stringify(source);
    const result = gameplayRigidIndices(source, { error });
    expect(result.indices.length).toBeLessThan(source.index.length);
    expect(boundaries(source, result.indices)).toEqual(boundaries(source, source.index));
    expect(result.reportedError).toBeLessThanOrEqual(error);
    const referenced = new Set(source.index); expect(result.indices.every(vertex => referenced.has(vertex))).toBe(true);
    expect(JSON.stringify(source)).toBe(before); geometry.dispose();
});

test('open material-patch borders keep their exact positions and all source attributes', () => {
    const geometry = new THREE.PlaneGeometry(2, 2, 20, 20), source = pack(geometry), result = gameplayRigidIndices(source);
    expect(result.indices.length).toBeLessThan(source.index.length);
    expect(boundaries(source, result.indices)).toEqual(boundaries(source, source.index)); geometry.dispose();
});

test('a simplifier opening a crack gets exact source collars or the full original fallback', () => {
    const geometry = new THREE.PlaneGeometry(2, 2, 12, 12), source = pack(geometry);
    const mock = jest.spyOn(MeshoptSimplifier, 'simplifyWithAttributes').mockImplementation(indices => [indices.slice(0, 3), 0]);
    try {
        const result = gameplayRigidIndices(source);
        expect(boundaries(source, result.indices)).toEqual(boundaries(source, source.index));
        expect(result.fallback || result.protectedSourceTriangles > 0).toBeTruthy();
    } finally { mock.mockRestore(); geometry.dispose(); }
});

test.each(['morph', 'skin', 'color'])('unsupported %s attributes retain the complete original indices', change => {
    const geometry = new THREE.PlaneGeometry(), source = pack(geometry);
    if (change === 'morph') source.morphTargets = [];
    if (change === 'skin') source.attributes.skinWeight = source.attributes.normal;
    if (change === 'color') source.attributes.color = source.attributes.normal;
    expect(gameplayRigidIndices(source).indices).toEqual(source.index); geometry.dispose();
});

test.each(['index', 'normal-width', 'nonfinite', 'error', 'ratio'])('invalid %s fails before accepting a derivative', change => {
    const geometry = new THREE.PlaneGeometry(), source = pack(geometry);
    if (change === 'index') source.index[0] = 9999;
    if (change === 'normal-width') source.attributes.normal.itemSize = 2;
    if (change === 'nonfinite') source.attributes.uv.array[0] = NaN;
    expect(() => gameplayRigidIndices(source, change === 'error' ? { error: .03 } : change === 'ratio' ? { ratio: 0 } : {})).toThrow(); geometry.dispose();
});
