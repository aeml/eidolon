import { jest } from '@jest/globals';
import { installGameEngineNetworkMessages } from '../src/core/GameEngineNetworkMessages.js';

class Harness {}
installGameEngineNetworkMessages(Harness);

function fixture() {
    return Object.assign(new Harness(), {
        player: { id: 'current-hero', vip: { active: false } },
        uiManager: { epWallet: { handleResult: jest.fn(), handleVIPStatus: jest.fn() } }
    });
}

test.each(['ep_wallet_result', 'vip_status'])('%s rejects missing/previous ownership before wallet or VIP mutation', type => {
    const engine = fixture();
    for (const playerID of [undefined, 'previous-hero']) {
        engine.handleServerMessage({ type, payload: { playerID, success: true, active: true, ep: 99, gold: 0 } });
        expect(engine.player.vip).toEqual({ active: false });
        expect(engine.uiManager.epWallet.handleResult).not.toHaveBeenCalled();
        expect(engine.uiManager.epWallet.handleVIPStatus).not.toHaveBeenCalled();
    }
});

test.each(['ep_wallet_result', 'vip_status'])('%s permits the current owned snapshot but not a retired engine', type => {
    const engine = fixture();
    const payload = { playerID: engine.player.id, success: true, active: true, until: '2026-11-01T00:00:00Z' };
    const receiver = type === 'vip_status' ? engine.uiManager.epWallet.handleVIPStatus : engine.uiManager.epWallet.handleResult;
    engine.handleServerMessage({ type, payload });
    expect(receiver).toHaveBeenCalledWith(payload);
    engine.isDestroyed = true;
    engine.handleServerMessage({ type, payload: { ...payload, active: false } });
    expect(receiver).toHaveBeenCalledTimes(1);
    if (type === 'vip_status') expect(engine.player.vip.active).toBe(true);
});
