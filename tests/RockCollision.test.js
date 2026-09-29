import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { compileRockSolids, insideRockSolids, recoverRockPosition, moveAroundRockSolids } from '../src/core/RockCollision.js';
import { CollisionManager } from '../src/core/CollisionManager.js';
import { Actor } from '../src/entities/Actor.js';
import { installGameEngineMovement } from '../src/core/GameEngineMovement.js';

const data = JSON.parse(readFileSync(new URL('../server/internal/game/content/earth-outcrops.json', import.meta.url)));
const solids = compileRockSolids(data.solids);

test('client sweeps prevent tunnelling, preserve glancing travel and recover overlapping formations', () => {
    const end = moveAroundRockSolids(solids, { x: -102, z: -345 }, { x: -102, z: -290 }, 1.25);
    expect(end.x).toBe(-102); expect(end.z).toBeLessThan(-326);
    for (const source of data.solids) {
        const p = recoverRockPosition(solids, source, 1.25);
        expect(insideRockSolids(solids, p, 1.25)).toBe(false);
        expect(Math.hypot(p.x - source.x, p.z - source.z)).toBeLessThan(25);
        expect(recoverRockPosition(solids, p, 1.25)).toEqual(p);
    }
    const point = { x: -102, z: -326.24 };
    const separated = recoverRockPosition(solids, point, 1.25);
    expect(Math.hypot(separated.x - point.x, separated.z - point.z)).toBeLessThan(.02);
});

test('normal Actor walking consumes optional polygon collisions without changing height', () => {
    const collision = new CollisionManager(); collision.setOverworldRockSolids(solids);
    const actor = new Actor('outcrop-walker', {});
    actor.isMultiplayer = true; actor.radius = 1.25; actor.stats.speed = 12;
    actor.position.set(-102, 7, -345);
    actor.move(new THREE.Vector3(-102, 7, -290));
    for (let step = 0; step < 120; step++) actor.update(1 / 60, collision, null, null);
    expect(actor.position.z).toBeLessThan(-326);
    expect(actor.position.z).toBeGreaterThan(-327);
    expect(actor.position.y).toBe(7);
    expect(insideRockSolids(solids, actor.position, actor.radius)).toBe(false);
    actor.dispose();
});

test('scene reset and instance ownership suppress stale rock geometry', () => {
    const manager = new CollisionManager();
    const start = new THREE.Vector3(-102, 8, -345), end = new THREE.Vector3(-102, 8, -290);
    expect(manager.checkCollision(end, 1.25, start)).toBeNull();
    manager.setOverworldRockSolids(solids);
    expect(manager.checkCollision(end, 1.25, start).z).toBeLessThan(-326);
    manager.setDungeonWalkableGeometry([{ x: -102, z: -321, width: 200, height: 200 }]);
    expect(manager.checkCollision(end, 1.25, start)).toBeNull();
    manager.clear(); expect(manager.rockSolids).toEqual([]);
    expect(manager.checkCollision(end, 1.25, start)).toBeNull();
});

test('predicted jump and its network request stop at the same body-clear rock face', () => {
    class Harness {}
    installGameEngineMovement(Harness);
    const engine = new Harness(), messages = [];
    engine.player = { position: new THREE.Vector3(-102, 0, -337), radius: 1.25 };
    engine.collisionManager = new CollisionManager();
    engine.collisionManager.setOverworldRockSolids(solids);
    engine.abilityController = {};
    engine.playAudioCue = () => {};
    engine.clearCombatIntentState = () => {};
    engine.ensureMovementNetworkState = () => ({ recoveryContext: 'rock-jump' });
    engine.isMultiplayer = true;
    engine.network = { send: (type, payload) => messages.push({ type, payload }) };
    expect(engine.requestPlayerJump(new THREE.Vector3(-102, 0, -310))).toBe(true);
    const end = engine.playerJumpState.end;
    expect(end.x).toBe(-102);
    expect(end.z).toBeCloseTo(-326.251, 6);
    expect(messages).toEqual([{ type: 'jump', payload: { movementContext: 'rock-jump', x: end.x, y: end.y, z: end.z } }]);
    expect(insideRockSolids(solids, end, 1.25)).toBe(false);
});
