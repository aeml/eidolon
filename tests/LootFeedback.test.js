import * as THREE from 'three';
import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/proto/state_pb.js', () => {
    const mock = {
        eidolon: {
            state: {
                StateEnvelope: {
                    decode: jest.fn()
                }
            }
        }
    };
    return { default: mock, ...mock };
});

const { GameEngine } = await import('../src/core/GameEngine.js');
const { LootDrop } = await import('../src/entities/LootDrop.js');
const { AUDIO_CUES } = await import('../src/audio/AudioManager.js');

function createItem(name = 'Iron Sword', rarityName = 'Rare', color = '#66ccff') {
    return {
        id: `${name.toLowerCase().replace(/\s+/g, '-')}-id`,
        name,
        rarity: { name: rarityName, color },
        stack: 1,
        maxStack: 1
    };
}

function createLootEntity({ id = 'loot-1', x = 0, z = 0, item = createItem() } = {}) {
    const entity = new LootDrop(item, x, z, id);
    entity.position.set(x, 0.5, z);
    entity.isActive = true;
    entity.dispose = jest.fn();
    return entity;
}

function createEngineHarness() {
    const engine = Object.create(GameEngine.prototype);
    engine.player = {
        position: new THREE.Vector3(0, 0, 0),
        inventory: new Array(8).fill(null)
    };
    engine.autoLootEnabled = false;
    engine.lastInventoryFullTime = 0;
    engine.lastAutoLootAttemptTime = 0;
    engine.autoLootAttemptCooldownMs = 250;
    engine.recentlyPickedUpLoot = new Set();
    engine.pendingLootPickups = new Map();
    engine.pendingInteraction = null;
    engine.activeEntitiesCache = [];
    engine.remotePlayers = new Map();
    engine.entityCreationQueue = [];
    engine.pendingEntityIds = new Set();
    engine.recentlyPickedUpLootTimeout = 5000;
    engine.pendingLootPickupTimeout = 10000;
    engine.chunkManager = {
        chunks: new Map(),
        getChunkKey: jest.fn(() => '0:0')
    };
    engine.renderSystem = {
        remove: jest.fn()
    };
    engine.network = { send: jest.fn() };
    engine.uiManager = {
        getRarityColor: jest.fn((rarity) => rarity?.color || '#ffffff'),
        updateInventory: jest.fn(),
        showLootPickupToast: jest.fn()
    };
    engine.floatingTextManager = { spawn: jest.fn() };
    engine.playAudioCue = jest.fn();
    engine.hydrateItem = (item) => ({ ...item });
    engine.isPlayerDead = () => false;
    engine.getInteractionRangeForEntity = GameEngine.prototype.getInteractionRangeForEntity;
    engine.getLootPickupRadius = GameEngine.prototype.getLootPickupRadius;
    engine.isLootEntity = GameEngine.prototype.isLootEntity;
    engine.canAttemptLootPickup = GameEngine.prototype.canAttemptLootPickup;
    engine.formatLootPickupMessage = GameEngine.prototype.formatLootPickupMessage;
    engine.showLootPickupFeedback = GameEngine.prototype.showLootPickupFeedback;
    engine.showLootFailureFeedback = GameEngine.prototype.showLootFailureFeedback;
    engine.findNearestLootInRange = GameEngine.prototype.findNearestLootInRange;
    engine.shouldAutoLootEntity = GameEngine.prototype.shouldAutoLootEntity;
    engine.processAutoLoot = GameEngine.prototype.processAutoLoot;
    engine.updateLootVisualFeedback = GameEngine.prototype.updateLootVisualFeedback;
    engine.pickupLoot = GameEngine.prototype.pickupLoot;
    engine.confirmPendingLootPickups = GameEngine.prototype.confirmPendingLootPickups;
    engine.removeRemoteEntity = GameEngine.prototype.removeRemoteEntity;
    engine.handleServerMessage = GameEngine.prototype.handleServerMessage;
    return engine;
}

describe('GameEngine loot pickup feedback', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-03-31T23:40:00Z'));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('canAttemptLootPickup returns true for nearby loot', () => {
        const engine = createEngineHarness();
        const loot = createLootEntity({ x: 2, z: 1 });

        expect(engine.canAttemptLootPickup(loot)).toBe(true);
    });

    test('shouldAutoLootEntity returns false for distant loot', () => {
        const engine = createEngineHarness();
        engine.autoLootEnabled = true;
        const loot = createLootEntity({ x: 12, z: 0 });

        expect(engine.shouldAutoLootEntity(loot)).toBe(false);
    });

    test('showLootFailureFeedback throttles inventory full spam', () => {
        const engine = createEngineHarness();

        engine.showLootFailureFeedback('inventory_full');
        engine.showLootFailureFeedback('inventory_full');

        expect(engine.floatingTextManager.spawn).toHaveBeenCalledTimes(1);
        expect(engine.uiManager.showLootPickupToast).toHaveBeenCalledTimes(1);
        expect(engine.playAudioCue).toHaveBeenCalledWith(AUDIO_CUES.lootBlocked);
    });

    test('pickupLoot waits for authoritative inventory confirmation before success feedback', () => {
        const engine = createEngineHarness();
        const loot = createLootEntity({ id: 'loot-success', item: createItem('Radiant Ruby', 'Rare', '#a855f7') });
        engine.remotePlayers.set(loot.id, loot);
        engine.activeEntitiesCache = [loot];

        const didPickup = engine.pickupLoot(loot.id);

        expect(didPickup).toBe(true);
        expect(engine.network.send).toHaveBeenCalledWith('pickup', { lootId: 'loot-success' });
        expect(engine.playAudioCue).not.toHaveBeenCalled();
        expect(engine.uiManager.showLootPickupToast).not.toHaveBeenCalled();
        expect(engine.remotePlayers.has(loot.id)).toBe(true);
        expect(engine.player.inventory.filter(Boolean)).toHaveLength(0);

        engine.handleServerMessage({ type: 'inventory', payload: [loot.item] });

        expect(engine.playAudioCue).toHaveBeenCalledWith(AUDIO_CUES.lootPickup, { pitch: 1 });
        expect(engine.uiManager.showLootPickupToast).toHaveBeenCalledWith('Rare: Radiant Ruby', { sender: 'Loot' });
        expect(engine.floatingTextManager.spawn).toHaveBeenCalledWith('RARE: RADIANT RUBY', engine.player.position, '#a855f7');
        expect(engine.remotePlayers.has(loot.id)).toBe(false);
    });

    test('a pickup without server confirmation remains retryable and does not create a ghost item', () => {
        const engine = createEngineHarness();
        const loot = createLootEntity({ id: 'loot-retry' });
        engine.remotePlayers.set(loot.id, loot);
        engine.activeEntitiesCache = [loot];

        engine.pickupLoot(loot.id);
        engine.pickupLoot(loot.id);

        expect(engine.network.send).toHaveBeenCalledTimes(2);
        expect(engine.remotePlayers.has(loot.id)).toBe(true);
        expect(engine.player.inventory.filter(Boolean)).toHaveLength(0);
        expect(engine.pendingLootPickups.has(loot.id)).toBe(true);
    });

    test('pickupLoot detaches fallback loot meshes from their current parent after reparenting', () => {
        const engine = createEngineHarness();
        const loot = createLootEntity({ id: 'loot-reparented', item: createItem('Radiant Ruby', 'Rare', '#a855f7') });
        const otherParent = new THREE.Group();
        otherParent.add(loot.mesh);
        loot.dispose = undefined;
        engine.remotePlayers.set(loot.id, loot);
        engine.activeEntitiesCache = [loot];
        engine.chunkManager.chunks.set('0:0', new Set([loot]));

        const didPickup = engine.pickupLoot(loot.id);
        engine.handleServerMessage({ type: 'inventory', payload: [loot.item] });

        expect(didPickup).toBe(true);
        expect(otherParent.children).toHaveLength(0);
        expect(engine.renderSystem.remove).not.toHaveBeenCalledWith(loot.mesh);
        expect(engine.chunkManager.chunks.get('0:0').has(loot)).toBe(false);
        expect(engine.remotePlayers.has(loot.id)).toBe(false);
    });

    test('LootDrop.dispose removes reparented meshes and cleans up owned materials without disposing cached textures', () => {
        const loot = new LootDrop(createItem('Radiant Ruby', 'Rare', '#a855f7'), 0, 0, 'loot-dispose');
        const otherParent = new THREE.Group();
        otherParent.add(loot.mesh);

        const spriteMaterial = new THREE.SpriteMaterial({ map: new THREE.Texture(), transparent: true });
        const sprite = new THREE.Sprite(spriteMaterial);
        loot.mesh.add(sprite);
        const meshMaterialDispose = jest.spyOn(loot.mesh.material, 'dispose');
        const hitboxMaterialDispose = jest.spyOn(loot.mesh.children[0].material, 'dispose');
        const spriteMaterialDispose = jest.spyOn(sprite.material, 'dispose');
        const textureDispose = jest.spyOn(sprite.material.map, 'dispose');

        loot.dispose();

        expect(otherParent.children).toHaveLength(0);
        expect(meshMaterialDispose).not.toHaveBeenCalled();
        expect(hitboxMaterialDispose).not.toHaveBeenCalled();
        expect(spriteMaterialDispose).toHaveBeenCalledTimes(1);
        expect(textureDispose).not.toHaveBeenCalled();
        expect(loot.mesh).toBeNull();
    });

    test('processAutoLoot picks nearest eligible loot when enabled', () => {
        const engine = createEngineHarness();
        engine.autoLootEnabled = true;
        const nearLoot = createLootEntity({ id: 'loot-near', x: 2, z: 0 });
        const farLoot = createLootEntity({ id: 'loot-far', x: 4, z: 0 });
        engine.activeEntitiesCache = [farLoot, nearLoot];
        engine.remotePlayers.set(nearLoot.id, nearLoot);
        engine.remotePlayers.set(farLoot.id, farLoot);

        engine.processAutoLoot();

        expect(engine.network.send).toHaveBeenCalledWith('pickup', { lootId: 'loot-near' });
    });

    test('updateLootVisualFeedback marks targeted and nearby loot states', () => {
        const engine = createEngineHarness();
        const targetedLoot = createLootEntity({ id: 'loot-targeted', x: 2, z: 0 });
        const nearbyLoot = createLootEntity({ id: 'loot-nearby', x: 3, z: 0 });
        const distantLoot = createLootEntity({ id: 'loot-distant', x: 10, z: 0 });
        engine.pendingInteraction = targetedLoot;
        engine.activeEntitiesCache = [targetedLoot, nearbyLoot, distantLoot];

        engine.updateLootVisualFeedback();

        expect(targetedLoot.visualState).toBe('targeted');
        expect(nearbyLoot.visualState).toBe('in_range');
        expect(distantLoot.visualState).toBe('default');
    });
});
