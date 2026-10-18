import * as THREE from 'three';
import { jest } from '@jest/globals';
import { GameEngine } from '../src/core/GameEngine.js';
import { LootDrop } from '../src/entities/LootDrop.js';
import { EARTH_ELEVATION as field } from '../src/data/worldElevation.js';
import { getTownRoofField } from '../src/core/TownRoofs.js';

function engine() {
    return { terrainElevation: field, currentInstanceId: '',
        clearAuthoritativeJumpState: jest.fn(), chunkManager: { updateEntityChunk: jest.fn() },
        showRemoteStateReadability: jest.fn(), syncRemoteSupportEffects: jest.fn(),
        syncPlayerStatusClears: jest.fn(), syncPlayerStatusDetails: jest.fn() };
}

test('replicated roof loot keeps its floor through update, render and pickup selection', () => {
    const game = engine(); game.townRoofField = getTownRoofField();
    const roof = game.townRoofField.sample(-74, 130);
    const loot = new LootDrop({ name: 'Roof blade', type: 'WEAPON' }, -74, 130, 'roof-drop');
    loot.gameEngine = game; loot.textDelay = Infinity;
    GameEngine.prototype.syncRemoteEntity.call(game, loot, { type: 'Loot', x: -74, y: roof.y + .5, z: 130,
        supportSurface: roof.id, state: 'IDLE' });
    loot.update(.016); loot.render(.5);
    expect(loot.supportSurface).toBe(roof.id);
    expect(loot.position.y).toBeCloseTo(roof.y + .5, 6);
    expect(loot.mesh.position.y).toBeCloseTo(roof.y + .5, 6);
    Object.assign(game, { player: { position: new THREE.Vector3(-74, 0, 130) },
        isLootEntity: () => true, getLootPickupRadius: () => 2.5 });
    expect(GameEngine.prototype.canAttemptLootPickup.call(game, loot)).toBe(false);
    game.player.position.y = roof.y; game.player.supportSurface = roof.id;
    expect(GameEngine.prototype.canAttemptLootPickup.call(game, loot)).toBe(true);
    GameEngine.prototype.syncRemoteEntity.call(game, loot, { type: 'Loot', x: -74, y: .5, z: 130, supportSurface: '', state: 'IDLE' });
    loot.update(.016); loot.render(.5);
    expect(loot.supportSurface).toBe('');
    expect(loot.mesh.position.y).toBe(.5);
    loot.dispose();
});

test('replicated loot corrections move the model, label and picking volume together', () => {
    const game = engine();
    const loot = new LootDrop({ name: 'Eidolon Shard', type: 'MATERIAL' }, -570, 410, 'ground-item');
    loot.gameEngine = game;
    loot.textDelay = Infinity;
    // The real label's local attachment is independent of its canvas texture.
    loot.label = new THREE.Object3D();
    loot.label.position.y = 1.38;
    loot.mesh.add(loot.label);
    for (const [x, z] of [[-570, 410], [-549, 416]]) {
        const y = field.sample(x, z) + .5;
        GameEngine.prototype.syncRemoteEntity.call(game, loot, { type: 'Loot', x, y, z, state: 'IDLE' });
        for (let step = 0; step < 3; step++) {
            loot.update(.016);
            loot.render(.5);
            loot.mesh.updateMatrixWorld(true);
            expect(loot.mesh.position.y).toBeCloseTo(y, 8);
            expect(loot.label.getWorldPosition(new THREE.Vector3()).y).toBeCloseTo(y + 1.38, 8);
            const ray = new THREE.Raycaster(new THREE.Vector3(x, y + 10, z), new THREE.Vector3(0, -1, 0));
            const hits = ray.intersectObject(loot.mesh.getObjectByName('LootHitbox'));
            expect(hits[0].object.userData.entityId).toBe('ground-item');
        }
    }
    game.currentInstanceId = 'dungeon_floor';
    GameEngine.prototype.syncRemoteEntity.call(game, loot, { type: 'Loot', x: -570, y: 8, z: 410, state: 'IDLE' });
    loot.update(.016);
    loot.render(.5);
    expect(loot.mesh.position.y).toBe(8);
    game.currentInstanceId = '';
    game.terrainElevation = null;
    loot.update(.016);
    expect(loot.position.y).toBe(8);
    loot.dispose();
});

test('only mobile summoned NPCs opt into actor grounding', () => {
    const game = engine();
    const actor = { position: new THREE.Vector3() };
    const packet = { type: 'NPC', x: -570, y: 0, z: 410, state: 'IDLE' };
    GameEngine.prototype.syncRemoteEntity.call(game, actor, { ...packet, subType: 'AvengingSeraph' });
    expect(actor.terrainGrounded).toBe(true);
    GameEngine.prototype.syncRemoteEntity.call(game, actor, packet);
    expect(actor.terrainGrounded).toBe(true);
    GameEngine.prototype.syncRemoteEntity.call(game, actor, { ...packet, subType: 'QuestGiver' });
    expect(actor.terrainGrounded).toBe(false);
});
