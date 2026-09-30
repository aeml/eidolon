import * as THREE from 'three';
import { jest } from '@jest/globals';
import { GameEngine } from '../src/core/GameEngine.js';
import { Entity } from '../src/entities/Entity.js';
import { MeshFactory } from '../src/utils/MeshFactory.js';

function harness() {
    return Object.assign(Object.create(GameEngine.prototype), {
        clearCombatIntentState: jest.fn(), renderSystem: { dispose: jest.fn() },
        remotePlayers: new Map(), hazards: new Map(), effects: [],
        chunkManager: { chunks: new Map(), activeChunkKeys: new Set(['0,0']),
            _cachedActiveEntities: [], _cachedActiveEntitiesFrame: 1 },
        entityCreationQueue: [{ id: 'queued' }], pendingEntityIds: new Set(['queued']),
        pendingLootPickups: new Map([['loot', {}]]), activeEntitiesCache: [],
        raycastHitEntities: [], collisionManager: { clear: jest.fn() },
        network: { destroy: jest.fn() }
    });
}

test('destroys all owned actors, including inactive chunks, once before renderer teardown', () => {
    const engine = harness(), order = [];
    const actor = id => ({ id, isActive: true, dispose: jest.fn(() => order.push(id)) });
    const player = actor('player'), remote = actor('remote'), dormant = actor('dormant');
    engine.player = player; engine.remotePlayers.set(remote.id, remote);
    engine.chunkManager.chunks.set('0,0', new Set([player, remote]));
    engine.chunkManager.chunks.set('99,99', new Set([dormant]));
    engine.chunkManager._cachedActiveEntities.push(player, remote);
    engine.renderSystem.dispose.mockImplementation(() => order.push('renderer'));
    engine.destroy(); engine.destroy();
    for (const entity of [player, remote, dormant]) {
        expect(entity.dispose).toHaveBeenCalledTimes(1); expect(entity.isActive).toBe(false);
    }
    expect(order).toEqual(['player', 'remote', 'dormant', 'renderer']);
    expect(engine.network.destroy).toHaveBeenCalledTimes(1);
    expect(engine.remotePlayers.size).toBe(0); expect(engine.chunkManager.chunks.size).toBe(0);
    expect(engine.chunkManager.activeChunkKeys.size).toBe(0);
    expect(engine.chunkManager._cachedActiveEntities).toHaveLength(0);
});

test('hazards and effects are deduplicated across ownership collections and queues cleared', () => {
    const engine = harness();
    const effect = { isActive: true, dispose: jest.fn() };
    engine.effects.push(effect, effect); engine.hazards.set('h', effect);
    engine.remotePlayers.set('same', effect);
    engine.activeEntitiesCache.push(effect); engine.raycastHitEntities.push(effect);
    engine.hoveredEntity = effect; engine.pendingInteraction = effect;
    engine.destroy();
    expect(effect.dispose).toHaveBeenCalledTimes(1); expect(effect.isActive).toBe(false);
    for (const list of [engine.effects, engine.entityCreationQueue, engine.activeEntitiesCache,
        engine.raycastHitEntities]) expect(list).toHaveLength(0);
    expect(engine.hazards.size).toBe(0); expect(engine.pendingEntityIds.size).toBe(0);
    expect(engine.pendingLootPickups.size).toBe(0);
    expect(engine.hoveredEntity).toBeNull(); expect(engine.pendingInteraction).toBeNull();
    expect(engine.collisionManager.clear).toHaveBeenCalledTimes(1);
});

test('one broken disposable cannot retain other actors or renderer resources', () => {
    const engine = harness(), error = jest.spyOn(console, 'error').mockImplementation(() => {});
    engine.player = { isActive: true, dispose() { throw new Error('broken actor'); } };
    const other = { isActive: true, dispose: jest.fn() }; engine.remotePlayers.set('other', other);
    try {
        engine.destroy();
        expect(other.dispose).toHaveBeenCalledTimes(1);
        expect(engine.renderSystem.dispose).toHaveBeenCalledTimes(1);
        expect(error).toHaveBeenCalled();
    } finally { error.mockRestore(); }
});

test('late model completion after session destruction returns to pool without rebinding old scene', async () => {
    const engine = harness(), entity = new Entity('late'); entity.meshType = 'Fighter';
    let resolve;
    const create = jest.spyOn(MeshFactory, 'createMeshForType').mockImplementation(() => new Promise(done => { resolve = done; }));
    const release = jest.spyOn(MeshFactory, 'releaseMesh').mockImplementation(() => {});
    const set = jest.spyOn(entity, 'setMesh');
    try {
        engine.remotePlayers.set(entity.id, entity);
        const loading = entity.ensureMesh(); engine.destroy();
        const model = new THREE.Group(); resolve(model); await loading;
        expect(set).not.toHaveBeenCalled(); expect(entity.mesh).toBeNull();
        expect(release).toHaveBeenCalledWith('Fighter', model);
        expect(entity.isActive).toBe(false); expect(entity.isMeshLoading).toBe(false);
    } finally { create.mockRestore(); release.mockRestore(); }
});
