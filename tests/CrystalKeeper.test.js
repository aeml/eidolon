import { GameEngine } from '../src/core/GameEngine.js';
import { AvengingSeraph } from '../src/entities/AvengingSeraph.js';
import { QuestNPC } from '../src/entities/QuestNPC.js';
import { MeshFactory } from '../src/utils/MeshFactory.js';

test('Maelin is a clothed adult artificer, not a summoned guardian or quest giver', async () => {
    const engine = Object.create(GameEngine.prototype);
    const keeper = engine.createRemotePlayer('NPC', 'crystal-artificer-raid', 'CrystalKeeper');
    expect(keeper).not.toBeInstanceOf(AvengingSeraph);
    expect(keeper).not.toBeInstanceOf(QuestNPC);
    expect(keeper.type).toBe('CrystalKeeper');
    expect(keeper.name).toBe('Maelin, Resonance Artificer');
    expect(keeper.meshType).toBe('Wizard');
    expect(keeper.isRemote).toBe(true);
    expect(keeper.radius).toBe(1.5);
    expect(engine.isInteractableEntity(keeper)).toBe(false);
    expect(keeper.markerSymbol).toBeUndefined();
    expect(keeper.offlineOwner).toBeUndefined();
    const mesh = await MeshFactory.createMeshForType(keeper.meshType);
    expect(mesh.userData.assetFallback).toBeUndefined();
    expect(mesh.userData.animations.some(clip => clip.name === 'Idle')).toBe(true);
    MeshFactory.releaseMesh(keeper.meshType, mesh);
});

test('actual Spirit Guardians retain their summoned angel model', () => {
    const engine = Object.create(GameEngine.prototype);
    const guardian = engine.createRemotePlayer('NPC', 'seraph-owner-1', 'AvengingSeraph');
    expect(guardian).toBeInstanceOf(AvengingSeraph);
    expect(guardian.meshType).toBe('AvengingSeraph');
});
