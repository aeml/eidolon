import * as THREE from 'three';
import { Actor } from '../src/entities/Actor.js';
import { RustboundColossus } from '../src/entities/RustboundColossus.js';
import { HollowSentinel } from '../src/entities/HollowSentinel.js';
import { CollisionManager } from '../src/core/CollisionManager.js';
import { installGameEngineEntitySync } from '../src/core/GameEngineEntitySync.js';

test.each([RustboundColossus, HollowSentinel])('%p allows melee contact at the server body boundary', (Boss) => {
    const boss = new Boss('dungeon-boss');
    boss.setScale(4);
    // This is the server's existing actor radius: 1.25 × scale 4.
    boss.setBodyRadius?.(5);
    const player = new Actor('melee-player', 'Fighter');
    player.position.set(-(boss.radius + player.radius), 0, 0);
    const chunks = { getChunkKey: () => '0,0', chunks: new Map([['0,0', new Set([player, boss])]]) };
    const collision = new CollisionManager();
    expect(collision.checkEntityCollision(player, chunks)).toBeNull();
    const serverMeleeRange = 4 + (4 - 1) * 1.5;
    expect(player.position.distanceTo(boss.position)).toBeLessThan(serverMeleeRange);
    expect(boss.radius).toBe(5);
});

test('authoritative body radius is independent of visual scale and invalid updates', () => {
    const actor = new Actor('remote', 'Fighter');
    actor.setScale(4);
    actor.setBodyRadius?.(3);
    actor.setScale(5);
    expect(actor.radius).toBe(3);
    for (const invalid of [0, -1, NaN, Infinity, undefined]) actor.setBodyRadius?.(invalid);
    expect(actor.radius).toBe(3);
    actor.setBodyRadius?.(6.25);
    expect(actor.radius).toBe(6.25);
    expect(actor.scale).toBe(5);
});

test('offline actors retain class-specific collision without an authoritative update', () => {
    const boss = new RustboundColossus('offline');
    boss.setScale(4);
    expect(boss.radius).toBe(12);
    expect(boss.position).toEqual(new THREE.Vector3());
});

test('production state synchronization applies body radius on creation and later updates', () => {
    class SyncHarness {}
    installGameEngineEntitySync(SyncHarness);
    const engine = new SyncHarness();
    engine.chunkManager = { updateEntityChunk() {} };
    engine.clearAuthoritativeJumpState = () => {};
    engine.showRemoteStateReadability = () => {};
    engine.syncRemoteSupportEffects = () => {};
    engine.syncPlayerStatusClears = () => {};
    engine.syncPlayerStatusDetails = () => {};
    const boss = new RustboundColossus('replicated-boss');
    boss.syncAttachedStatusEffects = () => {};
    const state = { id: boss.id, type: 'Enemy', state: 'IDLE', x: 20000, z: 20000, scale: 4, bodyRadius: 5 };
    engine.syncRemoteEntity(boss, state);
    expect(boss.radius).toBe(5);
    engine.syncRemoteEntity(boss, { ...state, scale: 5, bodyRadius: 6.25 });
    expect(boss.radius).toBe(6.25);
    engine.syncRemoteEntity(boss, { ...state, scale: 5, bodyRadius: undefined });
    expect(boss.radius).toBe(6.25);
});
