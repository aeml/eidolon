import { jest } from '@jest/globals';
import { ForgeUI } from '../src/ui/ForgeUI.js';
import { installGameEngineNetworkMessages } from '../src/core/GameEngineNetworkMessages.js';

class NetworkFixture {}
installGameEngineNetworkMessages(NetworkFixture);

function setup() {
    const ids = ['forge-equipment-list', 'forge-upgrade-info', 'forge-selected-item-name', 'forge-cost-value',
        'forge-upgrade-stats', 'forge-potency-list', 'forge-potency-info', 'forge-potency-item-name',
        'forge-potency-stats', 'forge-potency-cost-value', 'forge-socket-list', 'forge-socket-info',
        'forge-socket-item-name', 'forge-socket-stats', 'forge-socket-cost-hearts', 'forge-socket-cost-shards'];
    document.body.innerHTML = `<div id="forge-screen" style="display:flex">${ids.map(id => `<div id="${id}"></div>`).join('')}
        <button id="btn-forge-upgrade-1"></button><button id="btn-forge-upgrade-10"></button>
        <button id="btn-forge-potency"></button><button id="btn-forge-socket"></button></div>`;
    const engine = new NetworkFixture();
    engine.player = { id: 'local', level: 70, xp: 0, xpToNextLevel: 100, inventory: [], equipment: {} };
    engine.applyPositionHacks = jest.fn();
    engine.announceExperienceGain = jest.fn();
    engine.confirmPendingLootPickups = jest.fn();
    engine.hydrateItem = item => item;
    const forge = new ForgeUI({ getLastPlayer: () => engine.player,
        getItemIconPath: () => '/icon.png', formatStatName: name => name });
    engine.uiManager = { forge, updateXP: jest.fn(), updateInventory: jest.fn() };
    const item = { id: 'staff', name: 'Staff', level: 30, potency: 0, stats: { damage: 30 } };
    engine.player.equipment.mainHand = item;
    engine.player.inventory = [{ name: 'Eidolon Shard', stack: 10 }, { name: 'Eidolon Heart', stack: 3 }];
    forge.selectedForgeSlot = 'mainHand';
    forge.selectedForgePotencySlot = 'mainHand';
    forge.updateForgeUI(engine.player);
    forge.updateForgeInfo(item);
    forge.updateForgePotencyUI(engine.player);
    forge.updateForgePotencyInfo(item);
    const delta = fields => engine.handleServerMessage({ type: 'delta', payload: { u: { local: { id: 'local', ...fields } } } });
    return { engine, forge, item, delta };
}

describe('open forge authoritative refresh', () => {
    test('equipment deltas refresh level, stats, potency and next costs without reopening', () => {
        const { forge, item, delta } = setup();
        delta({ equipment: { mainHand: { ...item, level: 40, potency: 1, stats: { damage: 45 } } },
            inventory: [{ name: 'Eidolon Heart', stack: 2 }] });
        expect(forge.isOpen).toBe(true);
        expect(forge.selectedForgeSlot).toBe('mainHand');
        expect(document.querySelector('.level-indicator').textContent).toBe('Lvl 40');
        expect(document.getElementById('forge-upgrade-stats').textContent).toContain('damage: 45');
        expect(document.getElementById('forge-potency-cost-value').textContent).toBe('2');
        expect(document.getElementById('btn-forge-upgrade-1').disabled).toBe(true);
        expect(document.getElementById('btn-forge-potency').disabled).toBe(false);
    });

    test('inventory-only deltas refresh affordability for the retained selection', () => {
        const { delta } = setup();
        delta({ inventory: [] });
        expect(document.getElementById('btn-forge-upgrade-1').disabled).toBe(true);
        expect(document.getElementById('btn-forge-potency').disabled).toBe(true);
        expect(document.getElementById('forge-potency-stats').textContent).toContain('Hearts Available: 0 / 1');
    });

    test('an unequip clears stale selection details', () => {
        const { forge, delta } = setup();
        delta({ equipment: {} });
        expect(forge.selectedForgeSlot).toBeNull();
        expect(forge.selectedForgePotencySlot).toBeNull();
        expect(document.getElementById('forge-upgrade-info').style.display).toBe('none');
        expect(document.getElementById('forge-potency-info').style.display).toBe('none');
    });

    test('direct material replies refresh affordability without another state packet', () => {
        const { engine } = setup();
        engine.handleServerMessage({ type: 'inventory', payload: [] });
        expect(document.getElementById('btn-forge-upgrade-1').disabled).toBe(true);
        expect(document.getElementById('btn-forge-potency').disabled).toBe(true);
    });

    test('closed forge does not rebuild its hidden lists or reopen on deltas', () => {
        const { forge, item, delta } = setup();
        forge.close();
        const render = jest.spyOn(forge, 'updateForgeUI');
        delta({ equipment: { mainHand: { ...item, level: 31 } } });
        expect(render).not.toHaveBeenCalled();
        expect(forge.isOpen).toBe(false);
    });

    test('missing legacy artwork clears the old icon without requesting a null URL', () => {
        const { forge, engine } = setup();
        forge.ctx.getItemIconPath = () => null;
        forge.refresh(engine.player);
        for (const id of ['forge-equipment-list', 'forge-potency-list', 'forge-socket-list']) {
            expect(document.querySelector(`#${id} [data-slot="mainHand"]`).style.backgroundImage).toBe('none');
        }
    });
});
