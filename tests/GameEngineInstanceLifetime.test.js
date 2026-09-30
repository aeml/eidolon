import * as THREE from 'three';
import { jest } from '@jest/globals';
import { GameEngine } from '../src/core/GameEngine.js';
import { ChunkManager } from '../src/core/ChunkManager.js';
import { CollisionManager } from '../src/core/CollisionManager.js';
import { Entity } from '../src/entities/Entity.js';
import { MeshFactory } from '../src/utils/MeshFactory.js';
import { CasinoController } from '../src/core/CasinoController.js';

function harness(multiplayer = true) {
    const environment = new THREE.Group(), entities = new THREE.Group(), player = new Entity('player');
    player.mesh = new THREE.Group(); player.playAnimation = jest.fn(); player.quests = [];
    const engine = Object.assign(Object.create(GameEngine.prototype), {
        isMultiplayer: multiplayer, isDestroyed: false, player, currentInstanceType: 'overworld',
        remotePlayers: new Map(), enemies: [], lootDrops: [], hazards: new Map(), effects: [],
        entityCreationQueue: [], pendingEntityIds: new Set(), pendingLootPickups: new Map([['old-loot', {}]]),
        chunkManager: new ChunkManager(entities), collisionManager: new CollisionManager(),
        clearCombatIntentState: jest.fn(), resetRenderUpdateSignatures: jest.fn(),
        refreshDungeonEntranceHint: jest.fn(), clearOnboardingRecoveryContext: jest.fn(),
        renderSystem: { instanceEnvironmentGroup: environment, entityGroup: entities,
            add: mesh => entities.add(mesh), setCameraTarget: jest.fn(), setEnvironmentContext: jest.fn(),
            clearInstanceScene: () => { environment.clear(); entities.clear(); } }
    });
    engine.chunkManager.addEntity(player);
    engine.chunkManager.activeChunkKeys.add(engine.chunkManager.getChunkKey(0, 0));
    return engine;
}

function dormant(engine, entity) {
    entity.position.set(9000, 0, 9000);
    const key = engine.chunkManager.getChunkKey(9000, 9000);
    engine.chunkManager.chunks.set(key, new Set([entity])); entity._chunkKey = key;
}

const enter = engine => engine.enterInstance('next-arena', 'pvp_arena', {
    walkRects: [{ x: 0, z: 0, width: 80, height: 80 }]
}, null, { x: 0, y: .5, z: 0 });

test('authoritative instance change retires chunk-only actors and old pickups while retaining the same-chunk player', async () => {
    const engine = harness(), old = new Entity('dormant'); old.mesh = new THREE.Group(); dormant(engine, old);
    const dispose = jest.spyOn(old, 'dispose'), playerDispose = jest.spyOn(engine.player, 'dispose');
    const model = engine.player.mesh;
    await enter(engine);
    expect(dispose).toHaveBeenCalledTimes(1); expect(old.isActive).toBe(false);
    expect(engine.chunkManager.chunks.size).toBe(1);
    expect(engine.chunkManager.chunks.get(engine.chunkManager.getChunkKey(0, 0)).has(engine.player)).toBe(true);
    expect(engine.player.mesh).toBe(model); expect(model.parent).toBe(engine.renderSystem.entityGroup);
    expect(engine.player.isActive).toBe(true); expect(playerDispose).not.toHaveBeenCalled();
    expect(engine.pendingLootPickups.size).toBe(0); expect(engine.overworldSceneGeneration).toBe(1);
});

test('chunk-only late model completion cannot bind an actor to the replacement scene', async () => {
    const engine = harness(), old = new Entity('late'); old.meshType = 'Fighter'; dormant(engine, old);
    old.onMeshReady = mesh => engine.renderSystem.entityGroup.add(mesh);
    let resolve;
    const create = jest.spyOn(MeshFactory, 'createMeshForType').mockImplementation(() => new Promise(done => { resolve = done; }));
    const release = jest.spyOn(MeshFactory, 'releaseMesh').mockImplementation(() => {});
    const bind = jest.spyOn(old, 'setMesh');
    try {
        const loading = old.ensureMesh(); await enter(engine);
        const model = new THREE.Group(); resolve(model); await loading;
        expect(bind).not.toHaveBeenCalled(); expect(old.mesh).toBeNull(); expect(model.parent).toBeNull();
        expect(release).toHaveBeenCalledWith('Fighter', model);
    } finally { create.mockRestore(); release.mockRestore(); }
});

test('offline persistent NPC residency retains its existing behavior', async () => {
    const engine = harness(false), guide = new Entity('offline-guide'); guide.type = 'QuestNPC';
    guide.mesh = new THREE.Group(); dormant(engine, guide); const dispose = jest.spyOn(guide, 'dispose');
    await enter(engine);
    expect(dispose).not.toHaveBeenCalled(); expect(guide.isActive).toBe(true);
    expect(engine.chunkManager.chunks.get(guide._chunkKey).has(guide)).toBe(true);
    expect(engine.chunkManager.chunks.get(engine.chunkManager.getChunkKey(0, 0)).has(engine.player)).toBe(true);
});

test('instance entry cancels old delayed hits rather than retaining them until their deadline', async () => {
    jest.useFakeTimers();
    const engine = harness(), hit = jest.fn();
    engine.pendingAttackTimers = new Set([setTimeout(hit, 500)]);
    try {
        await enter(engine);
        expect(engine.pendingAttackTimers.size).toBe(0);
        jest.advanceTimersByTime(500);
        expect(hit).not.toHaveBeenCalled();
    } finally { jest.useRealTimers(); }
});

test('late instance entry cannot recreate a destroyed scene', async () => {
    const engine = harness(); engine.isDestroyed = true;
    const model = engine.player.mesh;
    await enter(engine);
    expect(engine.currentInstanceType).toBe('overworld');
    expect(engine.currentInstanceId).toBeUndefined();
    expect(engine.overworldSceneGeneration).toBeUndefined();
    expect(engine.player.mesh).toBe(model);
    expect(engine.clearCombatIntentState).not.toHaveBeenCalled();
});

test('instance retirement clears seated-pose references before an old model can be reused', async () => {
    const engine = harness(); engine.currentInstanceId = 'lanternhold-casino';
    engine.network = { socket: {}, send: jest.fn() };
    engine.casino = new CasinoController(engine);
    const old = new Entity('old-patron'), model = new THREE.Group(), hips = new THREE.Group();
    hips.name = 'Rig_Hips'; hips.position.y = 1.9; model.add(hips); old.mesh = model; old.state = 'SEATED';
    dormant(engine, old); old.position.y = 8;
    engine.casino.render([old]); expect(hips.position.y).toBe(1.12); expect(model.visible).toBe(false);
    let restoredBeforeDisposal;
    const dispose = old.dispose.bind(old);
    old.dispose = () => { restoredBeforeDisposal = hips.position.y === 1.9 && model.visible; dispose(); };
    try {
        await enter(engine);
        const replacement = new Entity('new-owner'); replacement.mesh = model;
        hips.position.y = 2.3; hips.rotation.x = .7;
        engine.casino.render([replacement]);
        expect(hips.position.y).toBe(2.3); expect(hips.rotation.x).toBe(.7);
        expect(restoredBeforeDisposal).toBe(true);
        expect(engine.casino.poses.size).toBe(0); expect(engine.casino.cutawayActors.size).toBe(0);
    } finally { engine.casino.dispose(); }
});
