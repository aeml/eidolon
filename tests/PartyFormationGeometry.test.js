import fs from 'node:fs';
import * as THREE from 'three';
import { CollisionManager } from '../src/core/CollisionManager.js';
import { WorldGenerator } from '../src/world/WorldGenerator.js';
import { partyFollowStep, partyFormationStep, partyPathAvoidsActors } from './partyDungeonControls.js';
import { buildDungeonTraversalRoutes, sampleDungeonTraversalRoute } from './dungeonTraversalRoutes.js';
import { isEarnedRetreatPathClear } from './wizardHuntControls.js';

// Geometry replay of62131, not a recreation of its unknown failure positions
// or browser/camera timing. The Go companion prevents fixture/generator drift.
const layout = JSON.parse(fs.readFileSync('tests/fixtures/party-formation-layout.json', 'utf8'));

test('full-size followers traverse every canonical join of the recorded party seed', async () => {
    expect(layout.generationSeed).toBe('-2339742150727221791');
    const collision = new CollisionManager();
    collision.setDungeonWalkableGeometry(layout.walkRects);
    await new WorldGenerator(new THREE.Group(), collision).createVerdantBastionCatacombs(0, 0, layout);
    let leader = new THREE.Vector3(layout.rooms[0].x, 0, layout.rooms[0].z);
    const followers = [-1, 0, 1].map(offset => leader.clone().add(new THREE.Vector3(offset, 0, 0)));
    let checked = 0;
    for (const route of buildDungeonTraversalRoutes(layout)) {
        for (const anchor of sampleDungeonTraversalRoute(route, 14)) {
            const previous = leader.clone();
            leader = new THREE.Vector3(anchor.x, 0, anchor.z);
            for (const follower of followers) {
                for (let stepIndex = 0; partyFollowStep(follower, leader) && stepIndex < 4; stepIndex++) {
                    const clear = step => isEarnedRetreatPathClear(collision, follower, 1.25, { x: step.dx, z: step.dz });
                    const step = partyFormationStep(follower, leader, previous, clear);
                    expect(step).not.toBeNull();
                    expect(clear(step)).toBe(true);
                    follower.x += step.dx;
                    follower.z += step.dz;
                    checked++;
                }
                expect(partyFollowStep(follower, leader)).toBeNull();
            }
        }
    }
    expect(checked).toBeGreaterThan(100);
});

test('three followers leave room for the last arrival across the recorded floor joins', async () => {
    const collision = new CollisionManager();
    collision.setDungeonWalkableGeometry(layout.walkRects);
    await new WorldGenerator(new THREE.Group(), collision).createVerdantBastionCatacombs(0, 0, layout);
    let leader = new THREE.Vector3(layout.rooms[0].x, 0, layout.rooms[0].z);
    const followers = [0, 1, 2].map(() => leader.clone());
    const offsets = [Math.PI / 3, -Math.PI / 3, 0];
    for (const route of buildDungeonTraversalRoutes(layout)) {
        for (const anchor of sampleDungeonTraversalRoute(route, 14)) {
            const previous = leader.clone();
            leader = new THREE.Vector3(anchor.x, 0, anchor.z);
            for (const [index, follower] of followers.entries()) {
                for (let count = 0; partyFollowStep(follower, leader) && count < 8; count++) {
                    const bodies = [leader, ...followers.filter(other => other !== follower)];
                    const clear = step => isEarnedRetreatPathClear(collision, follower, 1.25, { x: step.dx, z: step.dz }) &&
                        partyPathAvoidsActors(follower, step, bodies);
                    const step = partyFormationStep(follower, leader, previous, clear, 4, offsets[index]);
                    expect(clear(step)).toBe(true);
                    follower.x += step.dx;
                    follower.z += step.dz;
                }
                const unresolved = partyFollowStep(follower, leader);
                if (unresolved) throw new Error(`Blocked formation: ${JSON.stringify({ previous, leader, followers, index, unresolved })}`);
            }
        }
    }
});
