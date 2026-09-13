import * as THREE from 'three';
import { constrainCasinoWalk } from '../src/core/casinoNavigation.js';
import { CollisionManager } from '../src/core/CollisionManager.js';
import { createCasinoShell, updateCasinoCutaway, disposeCasinoObject } from '../src/art/ProceduralCasino.js';

test('full-sized actor can climb and descend with the rendered walls, without walking off upstairs', () => {
    const shell = createCasinoShell(), collision = new CollisionManager(); collision.casinoNavigation = true;
    for (const wall of shell.userData.casinoWalls) collision.addCollider(new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(wall.position[0], wall.position[1], 170 + wall.position[2]), new THREE.Vector3(...wall.size)));
    let position = new THREE.Vector3(0, 0, 180);
    for (const target of [[0, 0, 176.4], [10.5, 0, 176.4], [10.5, 6, 163.5], [0, 6, 163.5], [0, 6, 170],
        [0, 6, 163.5], [10.5, 6, 163.5], [10.5, 0, 176.4], [0, 0, 176.4], [0, 0, 180]]) {
        const destination = new THREE.Vector3(...target);
        // Walk at actual small per-frame increments, through full-size walls.
        for (let frame = 0; frame < 500 && position.distanceTo(destination) > .01; frame++) {
            const delta = destination.clone().sub(position); delta.y = 0;
            delta.clampLength(0, .15);
            const requested = position.clone().add(delta);
            position.copy(collision.checkCollision(requested, 1.25, position) || requested);
        }
        expect(position.distanceTo(destination)).toBeLessThan(.01);
    }
    expect(constrainCasinoWalk({ x: 0, y: 6, z: 170 }, { x: 0, z: 190 }).y).toBe(6);
    expect(constrainCasinoWalk({ x: 0, y: 6, z: 170 }, { x: 11, z: 170 }).x).toBeLessThanOrEqual(8.5);
    updateCasinoCutaway(shell, new THREE.Vector3(0, 0, 170)); expect(shell.userData.casinoUpstairs.visible).toBe(false);
    updateCasinoCutaway(shell, new THREE.Vector3(0, 6, 170)); expect(shell.userData.casinoUpstairs.visible).toBe(true);
    expect(shell.userData.casinoCutaway.visible).toBe(false);
    expect(collision.checkEntityCollision({ position: new THREE.Vector3(10.5, 3, 170) }, {})).toBeNull();
    disposeCasinoObject(shell);
});
