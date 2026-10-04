import { jest } from '@jest/globals';
import { installGameEngineNetworkMessages } from '../src/core/GameEngineNetworkMessages.js';

class NetworkFixture { constructor() { this.player = { id: 'local-player' }; } }
installGameEngineNetworkMessages(NetworkFixture);

describe('in-game server errors', () => {
    let nativeAlert, consoleError;
    beforeEach(() => {
        nativeAlert = jest.spyOn(window, 'alert').mockImplementation(() => {});
        consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => { nativeAlert.mockRestore(); consoleError.mockRestore(); });

    test.each(['message rate limit exceeded', 'message rate limit exceeded: raid_enter'])('rate rejection %s uses game notification, stops queued slots and still informs quest UI', message => {
        const engine = new NetworkFixture();
        engine.uiManager = {
            showActionError: jest.fn(),
            quest: { handleQuestActionError: jest.fn() },
            casino: { slots: { autoRemaining: 50, stopAuto: jest.fn() } }
        };
        engine.handleServerMessage({ type: 'error', payload: message });
        expect(nativeAlert).not.toHaveBeenCalled();
        expect(engine.uiManager.showActionError).toHaveBeenCalledWith(message);
        expect(engine.uiManager.quest.handleQuestActionError).toHaveBeenCalledWith(message);
        expect(engine.uiManager.casino.slots.stopAuto).toHaveBeenCalledTimes(1);
    });

    test('inventory-full still cancels pickup intent and uses its existing feedback', () => {
        const engine = new NetworkFixture();
        engine.uiManager = { showActionError: jest.fn() };
        engine.showLootFailureFeedback = jest.fn();
        engine.handleServerMessage({ type: 'error', payload: 'Inventory full' });
        expect(engine.showLootFailureFeedback).toHaveBeenCalledWith('inventory_full');
        expect(nativeAlert).not.toHaveBeenCalled();
    });
});
