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
    expect(group._listeners.childadded).toHaveLength(1);
    restore(); restore(); expect(group.updateMatrix).toBe(update); expect(group.updateMatrixWorld).toBe(world);
    expect(group._listeners.childadded).toHaveLength(0);
    const restoreAgain = cacheUnchangedLocalMatrix(group), wrapper = group.updateMatrixWorld;
    const later = jest.fn(function(force) { return wrapper.call(this, force); });
    group.updateMatrixWorld = later; restoreAgain();
    expect(group.updateMatrixWorld).toBe(later); group.position.x = 23; group.updateMatrixWorld();
    expect(group.matrixWorld.elements[12]).toBe(23);
});
