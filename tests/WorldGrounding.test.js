import * as THREE from 'three';
import { jest } from '@jest/globals';
import { Actor } from '../src/entities/Actor.js';
import { EARTH_ELEVATION as field } from '../src/data/worldElevation.js';
import { getGroundAwareDistance, getGroundedActorHeight } from '../src/core/WorldGrounding.js';
import { installGameEngineMovement } from '../src/core/GameEngineMovement.js';

class MovementHarness {}
installGameEngineMovement(MovementHarness);

test('ground-aware reach is horizontal only in an active overworld', () => {
    const from = new THREE.Vector3(0, 2, 0), to = new THREE.Vector3(3, 6, 0);
    expect(getGroundAwareDistance({ terrainElevation: field }, from, to)).toBe(3);
    expect(getGroundAwareDistance({}, from, to)).toBe(5);
    expect(getGroundAwareDistance({ terrainElevation: field, currentInstanceId: 'casino' }, from, to)).toBe(5);
});

test('offline enemy perception and attacks do not lose horizontal reach on slopes', () => {
    const actor = new Actor('slope-enemy', {});
    actor.gameEngine = { terrainElevation: field };
    actor.sightRange = 20; actor.attackRange = 5;
    actor.attack = jest.fn(); actor.move = jest.fn();
    const player = { state: 'IDLE', position: new THREE.Vector3(4, 8, 0) };
    actor.updateBasicEnemyAI(.1, player);
    expect(actor.attack).toHaveBeenCalledWith(player);
    expect(actor.move).not.toHaveBeenCalled();
    actor.dispose();
});

function fixture() {
    const engine = new MovementHarness();
    engine.terrainElevation = field;
    engine.currentInstanceId = '';
    engine.player = new Actor('elevated-player', {});
    engine.player.gameEngine = engine;
    engine.player.position.set(-570, field.sample(-570, 410), 410);
    engine.player.setMesh(new THREE.Group());
    engine.player.stats.speed = 25;
    engine.abilityController = {};
    engine.inputManager = { keys: {}, primaryMouseButtonDown: false };
    engine.playAudioCue = jest.fn();
    return engine;
}

test('normal player movement and render interpolation follow the ground triangles', () => {
    const engine = fixture(), actor = engine.player;
    actor.move(new THREE.Vector3(-525, 999, 440));
    let lowest = Infinity, highest = -Infinity;
    for (let frame = 0; frame < 30; frame++) {
        actor.capturePreviousTransform();
        actor.update(.1);
        expect(actor.position.y).toBeCloseTo(field.sample(actor.position.x, actor.position.z), 9);
        for (const alpha of [.2, .5, .8]) {
            actor.render(alpha);
            expect(actor.mesh.position.y).toBeCloseTo(field.sample(actor.mesh.position.x, actor.mesh.position.z), 9);
        }
        lowest = Math.min(lowest, actor.position.y); highest = Math.max(highest, actor.position.y);
    }
    expect(highest - lowest).toBeGreaterThan(2);
    expect(actor.position.x).toBe(-525); expect(actor.position.z).toBe(440);
    actor.dispose();
});

test('remote interpolation and visual separation stay on the slope, without changing the received target', () => {
    const engine = fixture(), actor = new Actor('remote-enemy', {});
    actor.gameEngine = engine; actor.terrainGrounded = true; actor.isRemote = true;
    actor.position.set(-570, field.sample(-570, 410), 410);
    actor.setMesh(new THREE.Group());
    actor.targetServerPosition = new THREE.Vector3(-540, field.sample(-540, 434), 434);
    const received = actor.targetServerPosition.clone();
    actor.targetServerRotation = 0;
    for (let frame = 0; frame < 8; frame++) {
        actor.capturePreviousTransform(); actor.update(.04);
        actor.visualOffset.set(.7, 0, -.4);
        actor.render(.5);
        expect(actor.position.y).toBeCloseTo(field.sample(actor.position.x, actor.position.z), 9);
        expect(actor.mesh.position.y).toBeCloseTo(field.sample(actor.mesh.position.x, actor.mesh.position.z), 9);
    }
    expect(actor.targetServerPosition).toEqual(received);
    actor.dispose(); engine.player.dispose();
});

test('predicted jumps keep horizontal timing, sampled base and one airborne arc through landing', () => {
    const engine = fixture(), actor = engine.player;
    expect(engine.startPlayerJump(new THREE.Vector3(-514, 999, 453))).toBe(true);
    const jump = engine.playerJumpState;
    const distance = Math.hypot(56, 43);
    expect(jump.duration).toBe(engine.getJumpTravelDuration(distance));
    expect(jump.end.y).toBe(field.sample(-514, 453));
    expect(jump.end.y).not.toBe(jump.start.y);
    for (let step = 1; step <= 8; step++) {
        engine.updatePlayerJump(step === 8 ? jump.duration - jump.elapsed : jump.duration / 8);
        if (engine.playerJumpState) {
            engine.applyEntityJumpVisuals(actor, jump);
            const ground = field.sample(actor.position.x, actor.position.z);
            expect(actor.position.y).toBeCloseTo(ground, 9);
            expect(actor.mesh.position.y).toBeCloseTo(ground + Math.sin(jump.progress * Math.PI) * jump.height, 9);
        }
    }
    expect(engine.playerJumpState).toBeNull(); expect(actor.state).toBe('IDLE');
    expect(actor.position.toArray()).toEqual([-514, field.sample(-514, 453), 453]);
    actor.dispose();
});

test('authoritative remote jump uses sampled terrain and does not double its replicated height', () => {
    const engine = fixture(), actor = new Actor('remote-jump', {});
    actor.gameEngine = engine; actor.terrainGrounded = true; actor.state = 'JUMPING';
    actor.setMesh(new THREE.Group());
    const progress = .4, start = new THREE.Vector3(-570, field.sample(-570, 410), 410);
    const end = new THREE.Vector3(-514, field.sample(-514, 453), 453);
    const point = start.clone().lerp(end, progress), height = 16.5;
    const packet = { state: 'JUMPING', x: point.x, y: field.sample(point.x, point.z) + Math.sin(progress * Math.PI) * height, z: point.z,
        jumpStartX: start.x, jumpStartY: start.y, jumpStartZ: start.z,
        jumpTargetX: end.x, jumpTargetY: end.y, jumpTargetZ: end.z, jumpHeight: height, jumpDuration: 1.28, jumpProgress: progress };
    expect(engine.syncAuthoritativeJumpState(actor, packet)).toBe(true);
    for (const phase of [.2, .4, .7, 1]) {
        actor.jumpVisualState.visualProgress = phase;
        actor.jumpVisualState.visualHeight = Math.sin(phase * Math.PI) * height;
        engine.applyEntityJumpVisuals(actor, actor.jumpVisualState);
        const base = start.clone().lerp(end, phase);
        expect(actor.mesh.position.x).toBeCloseTo(base.x, 9);
        expect(actor.mesh.position.z).toBeCloseTo(base.z, 9);
        expect(actor.mesh.position.y).toBeCloseTo(field.sample(base.x, base.z) + Math.sin(phase * Math.PI) * height, 9);
    }
    actor.dispose(); engine.player.dispose();
});

test('inactive worlds, service NPCs, airborne actors and instance floors retain their own Y', () => {
    const engine = fixture(), actor = engine.player;
    actor.position.y = 8;
    for (const instance of ['dungeon_test', 'lanternhold-casino', 'arena_test']) {
        engine.currentInstanceId = instance;
        actor.update(.01); actor.resetTransformInterpolation(); actor.render(1);
        expect(actor.position.y).toBe(8); expect(actor.mesh.position.y).toBe(8);
    }
    engine.currentInstanceId = '';
    const npc = new Actor('static-service', {}); npc.gameEngine = engine;
    expect(getGroundedActorHeight(npc)).toBeNull();
    actor.state = 'JUMPING'; expect(getGroundedActorHeight(actor)).toBeNull();
    actor.state = 'IDLE'; engine.terrainElevation = null;
    actor.update(.01); expect(actor.position.y).toBe(8);
    npc.dispose(); actor.dispose();
});
