import * as THREE from 'three';
import { jest } from '@jest/globals';
import { cacheUnchangedLocalMatrix } from '../src/core/UnchangedLocalMatrix.js';

test('owned cached groups match ordinary Three through TRS edits, direct matrix writes, flags and queries', () => {
    const ordinary = new THREE.Group(), cached = new THREE.Group();
    const restore = cacheUnchangedLocalMatrix(cached);
    const check = mutate => {
        mutate(ordinary); mutate(cached);
        ordinary.updateMatrixWorld(); cached.updateMatrixWorld();
        expect(cached.matrix.elements).toEqual(ordinary.matrix.elements);
        expect(cached.matrixWorld.elements).toEqual(ordinary.matrixWorld.elements);
    };
    try {
        check(() => {}); check(node => { node.position.x = 4; node.rotation.y = .8; node.scale.set(2, 3, 4); });
        check(node => node.matrix.makeTranslation(100, 200, 300)); // automatic TRS still wins
        check(node => { node.matrixAutoUpdate = false; node.matrix.makeTranslation(10, 20, 30); node.matrixWorldNeedsUpdate = true; });
        check(node => { node.matrixAutoUpdate = true; node.position.z = 9; });
        const query = new THREE.Vector3(), expected = ordinary.getWorldPosition(new THREE.Vector3());
        expect(cached.getWorldPosition(query).toArray()).toEqual(expected.toArray());
        check(node => { node.matrixWorldAutoUpdate = false; node.position.y = 11; });
        check(node => { node.matrixWorldAutoUpdate = true; node.position.y = 12; });
    } finally { restore(); }
});

test('manual foliage matrices and reparenting into an already settled cached group remain immediate', () => {
    const scene = new THREE.Scene(), first = new THREE.Group(), second = new THREE.Group();
    first.position.x = 2; second.position.x = 17; scene.add(first, second);
    const cell = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 1);
    cell.matrixAutoUpdate = false; first.add(cell);
    const restorers = [scene, first, second].map(cacheUnchangedLocalMatrix);
    try {
        scene.updateMatrixWorld(); scene.updateMatrixWorld(); expect(cell.matrixWorld.elements[12]).toBe(2);
        second.add(cell); scene.updateMatrixWorld(); expect(cell.matrixWorld.elements[12]).toBe(17);
        cell.matrix.makeTranslation(8, 4, 0); cell.matrixWorldNeedsUpdate = true; scene.updateMatrixWorld();
        expect(cell.matrixWorld.elements[12]).toBe(25); expect(cell.matrixWorld.elements[13]).toBe(4);
        scene.updateMatrixWorld(true); expect(cell.matrixWorld.elements[12]).toBe(25);
    } finally { restorers.forEach(restore => restore()); cell.geometry.dispose(); cell.material.dispose(); }
});

test('unsafe node/custom methods are left untouched and teardown never overwrites a later owner hook', () => {
    expect(cacheUnchangedLocalMatrix(new THREE.Bone())).toBeNull();
    expect(cacheUnchangedLocalMatrix(new THREE.SkinnedMesh())).toBeNull();
    expect(cacheUnchangedLocalMatrix(new THREE.InstancedMesh())).toBeNull();
    const custom = new THREE.Group(); custom.updateMatrix = jest.fn();
    expect(cacheUnchangedLocalMatrix(custom)).toBeNull();
    const group = new THREE.Group(), update = group.updateMatrix, world = group.updateMatrixWorld;
    const restore = cacheUnchangedLocalMatrix(group);
    restore(); restore(); expect(group.updateMatrix).toBe(update); expect(group.updateMatrixWorld).toBe(world);
    const restoreAgain = cacheUnchangedLocalMatrix(group), wrapper = group.updateMatrix;
    const later = jest.fn(function() { return wrapper.call(this); });
    group.updateMatrix = later; restoreAgain();
    expect(group.updateMatrix).toBe(later); group.position.x = 23; group.updateMatrixWorld();
    expect(group.matrixWorld.elements[12]).toBe(23);
});


test.each([
    ['manual local matrix followed by automatic TRS', [
        node => { node.position.x = 3; },
        node => { node.matrixAutoUpdate = false; node.matrix.makeTranslation(20, 0, 0); node.matrixWorldNeedsUpdate = true; },
        node => { node.matrixAutoUpdate = true; }
    ]],
    ['direct world write with automatic TRS', [
        node => { node.position.x = 3; },
        node => { node.matrixWorld.makeTranslation(99, 0, 0); }
    ]],
    ['world updates re-enabled without a new TRS edit', [
        node => { node.position.x = 3; },
        node => { node.matrixWorldAutoUpdate = false; node.position.x = 7; },
        node => { node.matrixWorldAutoUpdate = true; }
    ]]
])('cached groups preserve Three invalidation through %s', (_name, steps) => {
    const ordinary = new THREE.Group(), cached = new THREE.Group();
    const ordinaryChild = new THREE.Object3D(), cachedChild = new THREE.Object3D();
    ordinaryChild.matrixAutoUpdate = cachedChild.matrixAutoUpdate = false;
    ordinaryChild.matrix.makeTranslation(2, 4, 6); cachedChild.matrix.copy(ordinaryChild.matrix);
    ordinary.add(ordinaryChild); cached.add(cachedChild);
    const restore = cacheUnchangedLocalMatrix(cached);
    try {
        for (const mutate of steps) {
            mutate(ordinary); mutate(cached);
            ordinary.updateMatrixWorld(); cached.updateMatrixWorld();
            expect(cached.matrix.elements).toEqual(ordinary.matrix.elements);
            expect(cached.matrixWorld.elements).toEqual(ordinary.matrixWorld.elements);
            expect(cachedChild.matrixWorld.elements).toEqual(ordinaryChild.matrixWorld.elements);
        }
    } finally { restore(); }
});

test('manual local/world control keeps ordinary explicit invalidation semantics', () => {
    const ordinary = new THREE.Group(), cached = new THREE.Group();
    const restore = cacheUnchangedLocalMatrix(cached);
    const steps = [
        node => { node.matrixAutoUpdate = false; node.matrix.makeTranslation(3, 0, 0); node.matrixWorldNeedsUpdate = true; },
        node => { node.matrix.makeTranslation(22, 0, 0); },
        node => { node.matrixWorld.makeTranslation(99, 0, 0); },
        node => { node.matrixWorldAutoUpdate = false; node.matrixWorld.makeTranslation(77, 0, 0); },
        node => { node.matrixWorldAutoUpdate = true; },
        node => { node.matrixWorldNeedsUpdate = true; }
    ];
    try {
        for (const mutate of steps) {
            mutate(ordinary); mutate(cached);
            ordinary.updateMatrixWorld(); cached.updateMatrixWorld();
            expect(cached.matrix.elements).toEqual(ordinary.matrix.elements);
            expect(cached.matrixWorld.elements).toEqual(ordinary.matrixWorld.elements);
        }
    } finally { restore(); }
});

test('unchanged composition is cached while ordinary world-force propagation stays live', () => {
    const group = new THREE.Group(), child = new THREE.Object3D();
    child.matrixAutoUpdate = false; child.matrix.makeTranslation(2, 4, 6); group.add(child);
    const compose = jest.spyOn(group.matrix, 'compose'), multiply = jest.spyOn(child.matrixWorld, 'multiplyMatrices');
    const restore = cacheUnchangedLocalMatrix(group);
    try {
        group.updateMatrixWorld(); compose.mockClear(); multiply.mockClear();
        group.updateMatrixWorld();
        expect(compose).not.toHaveBeenCalled(); expect(multiply).toHaveBeenCalledTimes(1);
        child.matrix.makeTranslation(22, 4, 6); group.updateMatrixWorld();
        expect(child.matrixWorld.elements[12]).toBe(22);
        group.position.x = 9; group.updateMatrixWorld();
        expect(compose).toHaveBeenCalledTimes(1); expect(multiply).toHaveBeenCalledTimes(3);
        expect(child.matrixWorld.elements[12]).toBe(31);
    } finally { restore(); compose.mockRestore(); multiply.mockRestore(); }
});

test.each(['manual-child-local', 'manual-child-world', 'manual-group-world'])(
    '%s without a dirty flag still receives ordinary ancestor force', kind => {
        const build = cached => {
            const scene = new THREE.Scene(), group = new THREE.Group(), child = new THREE.Object3D();
            scene.add(group); group.add(child);
            child.matrixAutoUpdate = false; child.matrix.makeTranslation(3, 0, 0);
            if (kind === 'manual-group-world') { group.matrixAutoUpdate = false; group.matrix.makeTranslation(7, 0, 0); }
            const restores = cached ? [scene, group].map(cacheUnchangedLocalMatrix) : [];
            scene.updateMatrixWorld(); scene.updateMatrixWorld();
            return { scene, group, child, restores };
        };
        const ordinary = build(false), cached = build(true);
        try {
            for (const f of [ordinary, cached]) {
                if (kind === 'manual-child-local') f.child.matrix.makeTranslation(22, 0, 0);
                if (kind === 'manual-child-world') f.child.matrixWorld.makeTranslation(99, 0, 0);
                if (kind === 'manual-group-world') f.group.matrixWorld.makeTranslation(88, 0, 0);
                f.scene.updateMatrixWorld();
            }
            expect(cached.group.matrixWorld.elements).toEqual(ordinary.group.matrixWorld.elements);
            expect(cached.child.matrixWorld.elements).toEqual(ordinary.child.matrixWorld.elements);
        } finally { cached.restores.forEach(restore => restore()); }
    });
