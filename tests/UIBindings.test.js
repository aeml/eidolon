import { jest } from '@jest/globals';
import { UIBindings } from '../src/core/UIBindings.js';

describe('UIBindings', () => {
    function createEngine() {
        return {
            player: {
                inventory: [{ id: 'item-1', name: 'Test Blade', rarity: { name: 'Rare' } }, null],
                hotbar: [null, null, null, null],
                respawn: jest.fn(),
                timeSinceDeath: 3,
                targetPosition: { x: 1, z: 2 }
            },
            username: 'tester',
            requestTownRecall: jest.fn(),
            isMultiplayer: true,
            pendingInteraction: { id: 'enemy-1' },
            collisionManager: {},
            network: { send: jest.fn() },
            renderSystem: {
                setGraphicsQuality: jest.fn(),
                setBrightnessLevel: jest.fn(),
                setCameraShakeEnabled: jest.fn(),
                setCameraTarget: jest.fn()
            },
            chunkManager: {
                updateEntityChunk: jest.fn(),
                update: jest.fn()
            },
            abilityController: {
                performHotbarAbility: jest.fn(),
                pendingAbilityTarget: { id: 'enemy-2' },
                pendingAbilitySkill: 'Fireball'
            },
            worldMap: { toggle: jest.fn() },
            socialController: {
                sendPartyMessage: jest.fn(),
                kickPartyMember: jest.fn(),
                promotePartyMember: jest.fn(),
            },
            uiManager: {
                getGraphicsQuality: jest.fn(() => 'medium'),
                getBrightnessLevel: jest.fn(() => 0.75),
                getCameraShakeEnabled: jest.fn(() => false),
                inventory: {
                    updateInventory: jest.fn()
                },
                social: {},
                directTrade: {},
                trading: {},
                skillTree: {},
                forge: {},
                quest: {},
                toggleChat: jest.fn(),
                showHUD: jest.fn(),
                reportScreen: { style: { display: 'none' } }
            }
        };
    }

    test('bindConstructorCallbacks wires representative UI actions to engine behavior', () => {
        const engine = createEngine();
        const bindings = new UIBindings(engine);

        bindings.bindConstructorCallbacks();

        expect(engine.renderSystem.setGraphicsQuality).toHaveBeenCalledWith('medium');
        expect(engine.renderSystem.setBrightnessLevel).toHaveBeenCalledWith(0.75);
        expect(engine.renderSystem.setCameraShakeEnabled).toHaveBeenCalledWith(false);

        const originalItem = engine.player.inventory[0];
        engine.uiManager.inventory.onSellItem(0);
        expect(engine.network.send).toHaveBeenCalledWith('sell', { itemId: 'item-1', slotIndex: 0 });
        expect(engine.player.inventory[0]).toBe(originalItem);
        expect(engine.uiManager.inventory.updateInventory).not.toHaveBeenCalledWith(engine.player);

        engine.uiManager.social.onPartyInvite('alice');
        expect(engine.socialController.sendPartyMessage).toHaveBeenCalledWith('party_invite', { targetName: 'alice' });

        engine.uiManager.social.onSocialStatusChange('looking_party');
        expect(engine.network.send).toHaveBeenCalledWith('social_status', { status: 'looking_party' });
        expect(engine.network.send).toHaveBeenCalledWith('social', {});

        engine.uiManager.quest.onRequestQuests();
        expect(engine.network.send).toHaveBeenCalledWith('request_quests', {});

        engine.uiManager.onMapToggle();
        expect(engine.worldMap.toggle).toHaveBeenCalled();
    });

    test('sell-all only forwards merchant equipment slots of the requested rarity and skips gems/materials/relics', () => {
        const engine = createEngine();
        engine.player.inventory = [
            { id: 'weapon-main', name: 'Rusty Sword', type: 'WEAPON', slot: 'mainHand', rarity: { name: 'Common' } },
            { id: 'weapon-off', name: 'Wooden Shield', type: 'ARMOR', slot: 'offHand', rarity: { name: 'Common' } },
            { id: 'helm', name: 'Leather Cap', type: 'ARMOR', slot: 'head', rarity: { name: 'Common' } },
            { id: 'chest', name: 'Leather Tunic', type: 'ARMOR', slot: 'chest', rarity: { name: 'Common' } },
            { id: 'legs', name: 'Leather Pants', type: 'ARMOR', slot: 'legs', rarity: { name: 'Common' } },
            { id: 'boots', name: 'Leather Boots', type: 'ARMOR', slot: 'feet', rarity: { name: 'Common' } },
            { id: 'gloves', name: 'Leather Gloves', type: 'GLOVES', slot: 'gloves', rarity: { name: 'Common' } },
            { id: 'shoulders', name: 'Reinforced Spaulders', type: 'ARMOR', slot: 'shoulders', rarity: { name: 'Common' } },
            { id: 'belt', name: 'Studded Belt', type: 'ARMOR', slot: 'belt', rarity: { name: 'Common' } },
            { id: 'ring', name: 'Gold Ring', type: 'ACCESSORY', slot: 'ring', rarity: { name: 'Common' } },
            { id: 'neck', name: 'Silver Necklace', type: 'NECK', slot: 'neck', rarity: { name: 'Common' } },
            { id: 'trinket', name: 'Amulet of Power', type: 'ACCESSORY', slot: 'trinket', rarity: { name: 'Common' } },
            { id: 'gem-common', name: 'Flawed Ruby', type: 'GEM', slot: 'gem', rarity: { name: 'Common' } },
            { id: 'mat-common', name: 'Eidolon Shard', type: 'MATERIAL', slot: 'material', rarity: { name: 'Common' } },
            { id: 'relic-common', name: 'Eidolon Heart', type: 'RELIC', slot: 'relic', rarity: { name: 'Common' } },
            { id: 'gear-rare', name: 'Knight Blade', type: 'WEAPON', slot: 'mainHand', rarity: { name: 'Rare' } }
        ];
        const bindings = new UIBindings(engine);

        bindings.bindConstructorCallbacks();

        engine.uiManager.inventory.onSellAll('Common');

        expect(engine.network.send).toHaveBeenCalledTimes(12);
        const soldItemIds = engine.network.send.mock.calls
            .filter(([type]) => type === 'sell')
            .map(([, payload]) => payload.itemId)
            .sort();
        expect(soldItemIds).toEqual([
            'belt',
            'boots',
            'chest',
            'gloves',
            'helm',
            'legs',
            'neck',
            'ring',
            'shoulders',
            'trinket',
            'weapon-main',
            'weapon-off'
        ].sort());
        const soldSlots = engine.network.send.mock.calls
            .filter(([type]) => type === 'sell')
            .map(([, payload]) => engine.player.inventory[payload.slotIndex].slot)
            .sort();
        expect(soldSlots).toEqual([
            'head',
            'chest',
            'legs',
            'feet',
            'gloves',
            'shoulders',
            'belt',
            'ring',
            'neck',
            'trinket',
            'mainHand',
            'offHand'
        ].sort());
    });

    test('bindSessionCallbacks wires chat, respawn, and hotbar actions', () => {
        const engine = createEngine();
        const bindings = new UIBindings(engine);

        bindings.bindSessionCallbacks();

        engine.uiManager.onChatSend('hello');
        expect(engine.network.send).toHaveBeenCalledWith('chat', { message: 'hello', sender: 'tester' });
        engine.uiManager.onRecall();
        expect(engine.requestTownRecall).toHaveBeenCalledTimes(1);

        engine.uiManager.onHotbarAssign(2, 'Meteor Drop');
        expect(engine.player.hotbar[2]).toBe('Meteor Drop');

        engine.uiManager.onHotbarCast(1);
        expect(engine.abilityController.performHotbarAbility).toHaveBeenCalledWith(1);

        engine.uiManager.onRespawn();
        expect(engine.network.send).toHaveBeenCalledWith('respawn', { movementContext: expect.any(String) });
        expect(engine.player.respawn).toHaveBeenCalledWith(-1.25, 200);
        expect(engine.pendingInteraction).toBeNull();
        expect(engine.abilityController.pendingAbilityTarget).toBeNull();
        expect(engine.abilityController.pendingAbilitySkill).toBeNull();
        expect(engine.chunkManager.updateEntityChunk).toHaveBeenCalledWith(engine.player);
        expect(engine.chunkManager.update).toHaveBeenCalledWith(engine.player, 0, engine.collisionManager);
        expect(engine.renderSystem.setCameraTarget).toHaveBeenCalledWith(engine.player.position);
    });
});
