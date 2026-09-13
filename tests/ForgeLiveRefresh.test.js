import { jest } from '@jest/globals';
import { ForgeUI } from '../src/ui/ForgeUI.js';
import { installGameEngineNetworkMessages } from '../src/core/GameEngineNetworkMessages.js';

class NetworkFixture {}
installGameEngineNetworkMessages(NetworkFixture);

function setup() {
    const ids = ['forge-equipment-list', 'forge-upgrade-info', 'forge-selected-item-name', 'forge-cost-value',
        'forge-upgrade-stats', 'forge-potency-list', 'forge-potency-info', 'forge-potency-item-name',
        'forge-potency-stats', 'forge-potency-cost-value', 'forge-socket-list', 'forge-socket-info',
        'forge-socket-item-name', 'forge-socket-stats', 'forge-socket-cost-hearts', 'forge-socket-cost-shards',
        'forge-gem-equipment', 'forge-gem-inventory', 'forge-gem-info', 'forge-gem-socket-slots',
        'forge-gem-remove-equipment', 'forge-gem-remove-info', 'forge-gem-remove-slots',
        'forge-gem-combine-inventory', 'forge-gem-combine-slots', 'forge-gem-combine-result'];
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
    test('gem equipment icons and selected sockets follow the authoritative replacement', () => {
        const { engine, forge, item, delta } = setup();
        forge.ctx.getItemIconPath = item => `/socket-${item.gems?.[0]?.type || 'empty'}.png`;
        const ruby = { ...item, sockets: 1, gems: [{ type: 'Ruby', quality: 'Flawed' }] };
        engine.player.equipment.mainHand = ruby;
        forge.selectedGemEquipSlot = 'mainHand';
        forge.updateForgeGemsUI(engine.player);
        forge.updateForgeGemInfo(ruby, engine.player);
        delta({ equipment: { mainHand: { ...ruby, gems: [{ type: 'Sapphire', quality: 'Flawed' }] } } });
        expect(forge.forgeGemEquipment.firstElementChild.style.backgroundImage).toContain('socket-Sapphire.png');
        expect(forge.forgeGemSocketSlots.firstElementChild.title).toContain('Sapphire');
        expect(forge.selectedGemEquipSlot).toBe('mainHand');
    });

    test('consumed gem selection and removal details clear without reopening', () => {
        const { engine, forge, item, delta } = setup();
        engine.player.equipment.mainHand = { ...item, sockets: 1, gems: [{ type: 'Ruby', quality: 'Flawed' }] };
        forge.selectedGemEquipSlot = 'mainHand';
        forge.selectedRemoveEquipSlot = 'mainHand';
        forge.selectedRemoveSocketIndex = 0;
        forge.selectedGemInvIndex = 0;
        forge.selectedCombineGemIndices = [0];
        forge.refresh(engine.player);
        delta({ equipment: {}, inventory: [] });
        expect(forge.selectedGemEquipSlot).toBeNull();
        expect(forge.selectedGemInvIndex).toBeNull();
        expect(forge.selectedRemoveEquipSlot).toBeNull();
        expect(forge.selectedRemoveSocketIndex).toBeNull();
        expect(forge.selectedCombineGemIndices).toEqual([]);
        expect(forge.forgeGemInfo.style.display).toBe('none');
        expect(forge.forgeGemRemoveInfo.style.display).toBe('none');
    });

    test('unchanged state and Gold alone do not replace clickable gem nodes', () => {
        const { engine, forge, item, delta } = setup();
        engine.player.equipment.mainHand = { ...item, sockets: 1, gems: [] };
        forge.refresh(engine.player);
        const node = forge.forgeGemEquipment.firstElementChild;
        expect(node).not.toBeNull();
        forge.refresh(engine.player);
        delta({ gold: 10 });
        expect(forge.forgeGemEquipment.firstElementChild).toBe(node);
    });
    test('equipment deltas refresh level, stats, potency and next costs without reopening', () => {
        const { forge, item, delta } = setup();
        delta({ equipment: { mainHand: { ...item, level: 40, potency: 1, stats: { damage: 45 } } },
            inventory: [{ name: 'Eidolon Heart', stack: 2 }] });
        expect(forge.isOpen).toBe(true);
        expect(forge.selectedForgeSlot).toBe('mainHand');
        expect(document.querySelector('.level-indicator').textContent).toBe('Lvl 40');
        const row = [...document.querySelectorAll('#forge-upgrade-stats tbody tr')].find(row => row.querySelector('th')?.textContent === 'damage');
        expect(row.querySelector('td').textContent).toBe('45');
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
