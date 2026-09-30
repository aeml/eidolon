import * as THREE from 'three';
import { CollisionManager } from '../src/core/CollisionManager.js';
import { createCasinoShell, createCasinoInterior, disposeCasinoObject } from '../src/art/ProceduralCasino.js';

test('town casino no longer constructs the retired walk-in lounge or stair markers', () => {
    const shell = createCasinoShell();
    expect(shell.userData.casinoUpstairs).toBeUndefined();
    expect(shell.userData.casinoStairMarkers).toBeUndefined();
    expect(shell.getObjectByName('casino-vip-lounge')).toBeUndefined();
    expect(shell.getObjectByName('casino-stairs-public')).toBeUndefined();
    expect(shell.getObjectByName('casino-stairs-vip')).toBeUndefined();
    expect(shell.userData.casinoFacade.visible).toBe(true);
    expect(shell.userData.casinoDoor.name).toBe('casino-town-door');
    disposeCasinoObject(shell);
});

test('production-sized door and walls prevent walking into the exterior while preserving approach space', () => {
    const shell = createCasinoShell(), collision = new CollisionManager();
    for (const wall of shell.userData.casinoWalls) collision.addCollider(new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(wall.position[0], wall.position[1], 170 + wall.position[2]), new THREE.Vector3(...wall.size)));
    collision.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(0, 2.4, 178.35), new THREE.Vector3(5, 4.8, .5)));
    expect(collision.checkCollision(new THREE.Vector3(0, 0, 181), 1.25, new THREE.Vector3(0, 0, 182))).toBeNull();
    expect(collision.checkCollision(new THREE.Vector3(0, 0, 178.5), 1.25, new THREE.Vector3(0, 0, 181))).not.toBeNull();
    expect(collision.checkCollision(new THREE.Vector3(6, 0, 178), 1.25, new THREE.Vector3(6, 0, 181))).not.toBeNull();
    disposeCasinoObject(shell);
});

test.each([['public', 0], ['vip', 8]])('actual shared %s floor retains independent height and full-room boundaries', (floor, height) => {
    const collision = new CollisionManager();
    const interior = createCasinoInterior(new THREE.Scene(), collision);
    collision.casinoVIPFloor = floor === 'vip';
    const constrained = collision.checkCollision(new THREE.Vector3(80, 3, 230), 1.25, new THREE.Vector3(53, height, 205));
    expect(constrained.toArray()).toEqual([54, height, 206]);
    expect(interior.userData.floors.public).not.toBe(interior.userData.floors.vip);
    expect(interior.userData.floors.public.visible).toBe(true);
    expect(interior.userData.floors.vip.visible).toBe(false);
    disposeCasinoObject(interior);
});
