import { jest } from '@jest/globals';
import { installGameEngineNetworkMessages } from '../src/core/GameEngineNetworkMessages.js';

class SnapshotFixture {}
installGameEngineNetworkMessages(SnapshotFixture);

test.each([undefined, null, [{ id: 'previously-displayed-item', name: 'Previous ring' }]])(
    'explicit empty stash replaces previous display %p without changing owned bag or resources', previous => {
        const game = new SnapshotFixture();
        const inventory = [{ id: 'kept-bag-item' }], equipment = { mainHand: { id: 'kept-staff' } };
        game.player = { stash: previous, inventory, equipment, gold: 17, xp: 13 };
        game.hydrateItem = jest.fn(item => item);
        game.uiManager = { updateStash: jest.fn() };
        const payload = [];
        game.handleServerMessage({ type: 'stash', payload });
        expect(game.player.stash).toEqual(Array(100).fill(null));
        expect(game.player.inventory).toBe(inventory);
        expect(game.player.equipment).toBe(equipment);
        expect(game.player.gold).toBe(17);
        expect(game.player.xp).toBe(13);
        expect(payload).toEqual([]);
        expect(game.hydrateItem).not.toHaveBeenCalled();
        expect(game.uiManager.updateStash).toHaveBeenCalledWith(game.player);
    });
