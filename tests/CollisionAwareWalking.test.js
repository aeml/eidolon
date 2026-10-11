import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { URL as NodeURL } from 'node:url';
import { CollisionManager } from '../src/core/CollisionManager.js';
import { WorldGenerator } from '../src/world/WorldGenerator.js';
import { compileRockSolids } from '../src/core/RockCollision.js';
import { EARTH_ELEVATION } from '../src/data/worldElevation.js';
import { isEarnedRetreatPathClear } from './wizardHuntControls.js';
import { planCollisionAwareWalk } from './collisionAwareWalking.js';

function assertClear(manager, start, radius, result) {
    expect(result).not.toBeNull();
    let previous = start.clone();
    for (const target of result.waypoints) {
        expect(isEarnedRetreatPathClear(manager, previous, radius,
            { x: target.x - previous.x, z: target.z - previous.z })).toBe(true);
        previous.x = target.x; previous.z = target.z;
    }
}

test('an unobstructed path preserves the exact requested destination and detached state', () => {
    const manager = new CollisionManager(), start = new THREE.Vector3(0, 0, 200), before = start.clone();
    const target = { x: 18, z: 200 };
    expect(planCollisionAwareWalk(manager, start, 1.25, target)).toMatchObject({ waypoints: [target], detour: false });
    expect(start.equals(before)).toBe(true);
});

test('a body-clear detour avoids a real box across the direct walking chord', () => {
    const manager = new CollisionManager(), start = new THREE.Vector3(0, 0, 200);
    const box = new THREE.Box3(new THREE.Vector3(5, -5, 195), new THREE.Vector3(10, 10, 205));
    manager.addCollider(box);
    const before = box.clone(), target = { x: 18, z: 200 };
    expect(isEarnedRetreatPathClear(manager, start, 1.25, { x: 18, z: 0 })).toBe(false);
    const plan = planCollisionAwareWalk(manager, start, 1.25, target);
    assertClear(manager, start, 1.25, plan);
    expect(plan.detour).toBe(true); expect(plan.waypoints.at(-1)).toEqual(target);
    expect(box.equals(before)).toBe(true); expect(start.toArray()).toEqual([0, 0, 200]);
});

test('the retained off-road combat position can walk around actual generated scenery', async () => {
    const manager = new CollisionManager();
    const data = JSON.parse(readFileSync(new NodeURL('../server/internal/game/content/earth-outcrops.json', import.meta.url)));
    const solids = compileRockSolids(data.solids); manager.setOverworldRockSolids(solids);
    await new WorldGenerator(new THREE.Scene(), manager, { terrainElevation: EARTH_ELEVATION }).loadTrees(0, 200);
    const original = JSON.stringify(solids), radius = 1.25;
    const start = new THREE.Vector3(432.4066162109375, 6.363770243988398, 245.2550811767578);
    expect(isEarnedRetreatPathClear(manager, start, radius, { x: 11.501785156499238, z: -13.845899689573583 })).toBe(false);
    const target = { x: 470, z: 200 };
    const plan = planCollisionAwareWalk(manager, start, radius, target,
        { sampleHeight: (x, z) => EARTH_ELEVATION.sample(x, z) });
    assertClear(manager, start, radius, plan);
    expect(plan.detour).toBe(true); expect(plan.waypoints.at(-1)).toEqual(target);
    expect(JSON.stringify(solids)).toBe(original);
});

test('blocked destination and exhausted search refuse a plan rather than moving through geometry', () => {
    const manager = new CollisionManager(), start = new THREE.Vector3(0, 0, 200);
    manager.addCollider(new THREE.Box3(new THREE.Vector3(5, -5, 195), new THREE.Vector3(10, 10, 205)));
    expect(planCollisionAwareWalk(manager, start, 1.25, { x: 8, z: 200 })).toBeNull();
    expect(planCollisionAwareWalk(manager, start, 1.25, { x: 18, z: 200 }, { maxQueries: 1 })).toBeNull();
    expect(planCollisionAwareWalk(manager, start, 1.25, { x: NaN, z: 200 })).toBeNull();
});

test('negotiated convex outcrops also receive a body-clear walking detour', () => {
    const manager = new CollisionManager();
    const data = JSON.parse(readFileSync(new NodeURL('../server/internal/game/content/earth-outcrops.json', import.meta.url)));
    manager.setOverworldRockSolids(compileRockSolids(data.solids));
    const start = new THREE.Vector3(-102, 0, -345), target = { x: -102, z: -290 };
    expect(isEarnedRetreatPathClear(manager, start, 1.25, { x: 0, z: 55 })).toBe(false);
    const plan = planCollisionAwareWalk(manager, start, 1.25, target);
    assertClear(manager, start, 1.25, plan);
    expect(plan.detour).toBe(true); expect(plan.waypoints.at(-1)).toEqual(target);
});
