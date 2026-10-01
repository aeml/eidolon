import { jest } from '@jest/globals';
import { installGameEngineNetworkMessages } from '../src/core/GameEngineNetworkMessages.js';

class Harness {}
installGameEngineNetworkMessages(Harness);

function fixture() {
    const messages = [];
    const receiver = label => ({ handleResult: result => messages.push([label, result]) });
    const engine = Object.assign(new Harness(), {
        player: { id: 'current-hero', appearances: { chest: { baseName: 'Owned Plate' } },
            vip: { active: false }, syncEquipmentVisuals: jest.fn() },
        uiManager: {
            epWallet: { ...receiver('wallet'), handleVIPStatus: result => messages.push(['vip', result]) },
            cosmeticVendor: { ...receiver('vendor'), handleAppearanceResult: result => messages.push(['appearance', result]) },
            wardrobe: receiver('wardrobe'), updateCharacterSheet: jest.fn()
        }
    });
    return { engine, messages };
}

test.each(['ep_wallet_result', 'vip_status', 'cosmetic_vendor_result', 'wardrobe_result'])('%s cannot reach any UI or mutate the new character with a missing/previous owner', type => {
    const { engine, messages } = fixture();
    const before = JSON.stringify(engine.player);
    for (const playerID of [undefined, 'previous-hero']) {
        engine.handleServerMessage({ type, payload: { playerID, success: true, active: true,
            appearances: { chest: { baseName: 'Previous character look' } } } });
        expect(messages).toEqual([]); expect(JSON.stringify(engine.player)).toBe(before);
        expect(engine.player.syncEquipmentVisuals).not.toHaveBeenCalled();
        expect(engine.uiManager.updateCharacterSheet).not.toHaveBeenCalled();
    }
});

test.each(['ep_wallet_result', 'vip_status', 'cosmetic_vendor_result', 'wardrobe_result'])('%s still handles a current owned private snapshot', type => {
    const { engine, messages } = fixture();
    const payload = { playerID: engine.player.id, success: true, active: true,
        appearances: { chest: { baseName: 'Current owned look' } } };
    engine.handleServerMessage({ type, payload });
    expect(messages.length).toBeGreaterThan(0);
    messages.forEach(([, result]) => expect(result).toBe(payload));
    if (type === 'wardrobe_result') {
        expect(engine.player.appearances).toEqual(payload.appearances);
        expect(engine.player.syncEquipmentVisuals).toHaveBeenCalledTimes(1);
        expect(engine.uiManager.updateCharacterSheet).toHaveBeenCalledWith(engine.player);
    }
    if (type === 'vip_status') expect(engine.player.vip.active).toBe(true);
});

test('retired engine does not apply a late owned wardrobe snapshot', () => {
    const { engine, messages } = fixture(); engine.isDestroyed = true;
    const before = JSON.stringify(engine.player);
    engine.handleServerMessage({ type: 'wardrobe_result', payload: { playerID: engine.player.id, appearances: {} } });
    expect(messages).toEqual([]); expect(JSON.stringify(engine.player)).toBe(before);
});
