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
            sendPartyMessage: jest.fn(),
            uiManager: {
                getGraphicsQuality: jest.fn(() => 'medium'),
                getBrightnessLevel: jest.fn(() => 0.75),
                getCameraShakeEnabled: jest.fn(() => false),
                inventory: {
                    updateInventory: jest.fn()
                },
                social: {},
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
        expect(engine.sendPartyMessage).toHaveBeenCalledWith('party_invite', { targetName: 'alice' });

        engine.uiManager.onMapToggle();
        expect(engine.worldMap.toggle).toHaveBeenCalled();
    });

    test('sell-all only forwards gear items of the requested rarity and skips gems/materials/relics', () => {
        const engine = createEngine();
        engine.player.inventory = [
            { id: 'gear-common', name: 'Rusty Sword', type: 'WEAPON', rarity: { name: 'Common' } },
            { id: 'gem-common', name: 'Flawed Ruby', type: 'GEM', rarity: { name: 'Common' } },
            { id: 'mat-common', name: 'Eidolon Shard', type: 'MATERIAL', rarity: { name: 'Common' } },
            { id: 'relic-common', name: 'Eidolon Heart', type: 'RELIC', rarity: { name: 'Common' } },
            { id: 'gear-rare', name: 'Knight Blade', type: 'WEAPON', rarity: { name: 'Rare' } }
        ];
        const bindings = new UIBindings(engine);

        bindings.bindConstructorCallbacks();

        engine.uiManager.inventory.onSellAll('Common');

        expect(engine.network.send).toHaveBeenCalledTimes(1);
        expect(engine.network.send).toHaveBeenCalledWith('sell', { itemId: 'gear-common', slotIndex: 0 });
    });

    test('bindSessionCallbacks wires chat, respawn, and hotbar actions', () => {
        const engine = createEngine();
        const bindings = new UIBindings(engine);

        bindings.bindSessionCallbacks();

        engine.uiManager.onChatSend('hello');
        expect(engine.network.send).toHaveBeenCalledWith('chat', { message: 'hello', sender: 'tester' });

        engine.uiManager.onHotbarAssign(2, 'Meteor Drop');
        expect(engine.player.hotbar[2]).toBe('Meteor Drop');

        engine.uiManager.onHotbarCast(1);
        expect(engine.abilityController.performHotbarAbility).toHaveBeenCalledWith(1);

        engine.uiManager.onRespawn();
        expect(engine.network.send).toHaveBeenCalledWith('respawn', {});
        expect(engine.player.respawn).toHaveBeenCalledWith(-1.25, 200);
        expect(engine.pendingInteraction).toBeNull();
        expect(engine.abilityController.pendingAbilityTarget).toBeNull();
        expect(engine.abilityController.pendingAbilitySkill).toBeNull();
        expect(engine.chunkManager.updateEntityChunk).toHaveBeenCalledWith(engine.player);
        expect(engine.chunkManager.update).toHaveBeenCalledWith(engine.player, 0, engine.collisionManager);
        expect(engine.renderSystem.setCameraTarget).toHaveBeenCalledWith(engine.player.position);
    });
});
