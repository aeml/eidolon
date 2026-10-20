import * as THREE from 'three';
import { constrainOverworldMovement } from '../src/core/OverworldMovementBounds.js';
import { getOverworldRegion } from '../src/data/worldGeography.js';
import { CollisionManager } from '../src/core/CollisionManager.js';
import { intersectEngineGround } from '../src/core/WorldGrounding.js';

test.each([
    [0, 995, 0, 1050], [0, -2195, 0, -2250], [-2995, 200, -3050, 200], [2995, 200, 3050, 200],
    [-1010, -595, -995, -610], [1010, -595, 995, -610]
])('whole movement segment stays on land from %s,%s to %s,%s', (x, z, tx, tz) => {
    const start = { x, z }, end = { x: tx, z: tz };
    const clipped = constrainOverworldMovement(start, end);
    expect(clipped).not.toEqual(end);
    for (let i = 0; i <= 100; i++) expect(getOverworldRegion(x + (clipped.x - x) * i / 100, z + (clipped.z - z) * i / 100)).not.toBeNull();
});

test.each([[0, -590, 0, -610], [-990, 200, -1010, 200], [990, 200, 1010, 200], [0, 200, 20, 220]])('realm gateways and town remain connected', (x, z, tx, tz) => {
    const end = { x: tx, z: tz };
    expect(constrainOverworldMovement({ x, z }, end)).toBe(end);
});

test('stranded player recovers to nearest land before a new movement', () => {
    expect(constrainOverworldMovement({ x: 3050, z: 200 }, { x: 3060, z: 210 })).toEqual({ x: 2997.5, z: 200 });
});

test('walk prediction guards outer edges without changing instance coordinates', () => {
    const collision = new CollisionManager(), from = new THREE.Vector3(2995, 0, 200), end = new THREE.Vector3(3010, 0, 200);
    collision.overworldBoundary = true;
    expect(collision.checkCollision(end, 1, from).x).toBeCloseTo(2999.95);
    collision.clear();
    expect(collision.checkCollision(end, 1, from)).toBeNull();
});

test('pointer cannot treat ocean as an infinite ground plane; instances retain their floor', () => {
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), target = new THREE.Vector3();
    const ray = new THREE.Ray(new THREE.Vector3(3010, 20, 200), new THREE.Vector3(0, -1, 0));
    expect(intersectEngineGround({}, ray, target, plane)).toBeNull();
    expect(intersectEngineGround({ currentInstanceId: 'dungeon_test' }, ray, target, plane)).toEqual(new THREE.Vector3(3010, 0, 200));
});
