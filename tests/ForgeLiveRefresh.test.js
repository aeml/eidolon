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
        'forge-gem-combine-inventory', 'forge-gem-combine-slots', 'forge-gem-combine-result',
        'forge-gem-remove-preview'];
    document.body.innerHTML = `<div id="forge-screen" style="display:flex">${ids.map(id => `<div id="${id}"></div>`).join('')}
        <button id="btn-forge-upgrade-1"></button><button id="btn-forge-upgrade-10"></button>
        <button id="btn-forge-potency"></button><button id="btn-forge-socket"></button>
        <button id="btn-forge-remove-gem"></button></div>`;
    const engine = new NetworkFixture();
    engine.player = { id: 'local', level: 70, xp: 0, xpToNextLevel: 100, inventory: [], equipment: {} };
    engine.applyPositionHacks = jest.fn();
    engine.announceExperienceGain = jest.fn();
    engine.handleLevelUpFeedback = jest.fn();
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
    test('stat rows stay fixed when server deltas replace the stats map in a different order', () => {
        const { forge, item, delta } = setup();
        const stats = { vitality: 9, intelligence: 4, dexterity: 3, strength: 2, damage: 30 };
        const expected = ['damage', 'strength', 'dexterity', 'intelligence', 'vitality'];
        for (const entries of [Object.entries(stats), Object.entries(stats).reverse(), Object.entries(stats)]) {
            delta({ equipment: { mainHand: { ...item, stats: Object.fromEntries(entries) } } });
            for (const id of ['forge-upgrade-stats', 'forge-potency-stats']) {
                const labels = [...document.querySelectorAll(`#${id} tbody th`)].map(node => node.textContent);
                expect(labels.slice(0, -1)).toEqual(expected);
            }
        }
        expect(forge.upgradeQuote.itemId).toBe('staff');
    });
    test('all three caps keep current stats visible and clear stale spending actions until another item arrives', () => {
        const { engine, forge, item, delta } = setup();
        forge.selectedForgeSocketSlot = 'mainHand';
        forge.onForgeUpgrade = jest.fn(); forge.onForgePotency = jest.fn(); forge.onForgeSocket = jest.fn();
        delta({ equipment: { mainHand: { ...item, level: 100, potency: 20, sockets: 4, stats: { damage: 234 } } } });
        for (const [panel, button, label] of [
            ['forge-upgrade-stats', 'btn-forge-upgrade-1', 'Item level 100 reached'],
            ['forge-potency-stats', 'btn-forge-potency', 'Potency +20 reached'],
            ['forge-socket-stats', 'btn-forge-socket', 'All 4 sockets unlocked']
        ]) {
            const content = document.getElementById(panel).textContent;
            expect(content).toContain(label); expect(content).toContain('234');
            expect(content).toContain('No materials will be spent');
            expect(document.getElementById(button).disabled).toBe(true);
            expect(document.getElementById(button).textContent).not.toContain('Need');
        }
        forge.handleForgeUpgrade(1); forge.handleForgePotency(); forge.handleForgeSocket();
        expect(forge.onForgeUpgrade).not.toHaveBeenCalled();
        expect(forge.onForgePotency).not.toHaveBeenCalled();
        expect(forge.onForgeSocket).not.toHaveBeenCalled();
        delta({ equipment: { mainHand: { ...item, id: 'new-staff' } },
            inventory: [{ name: 'Eidolon Shard', stack: 1000000 }, { name: 'Eidolon Heart', stack: 1000000 }] });
        expect(document.querySelector('.forge-limit')).toBeNull();
        for (const id of ['btn-forge-upgrade-1', 'btn-forge-potency', 'btn-forge-socket']) expect(document.getElementById(id).disabled).toBe(false);
        expect(forge.upgradeQuote.itemId).toBe('new-staff');
    });

    test.each(['replacement', 'shifted sockets'])('removal requires a fresh selection after %s arrives', change => {
        const { engine, forge, item, delta } = setup();
        const socketed = { ...item, sockets: 2, gems: [
            { type: 'Ruby', quality: 'Chipped', stats: { strength: 1 } },
            { type: 'Sapphire', quality: 'Chipped', stats: { intelligence: 1 } }
        ] };
        engine.player.equipment.mainHand = socketed;
        forge.selectedRemoveEquipSlot = 'mainHand';
        forge.refresh(engine.player);
        forge.forgeGemRemoveSlots.firstElementChild.click();
        expect(forge.btnForgeRemoveGem.disabled).toBe(false);
        forge.onForgeRemoveGem = jest.fn();
        const changed = change === 'replacement'
            ? { ...socketed, id: 'new-staff' }
            : { ...socketed, gems: socketed.gems.slice(1) };
        delta({ equipment: { mainHand: changed } });
        expect(forge.selectedRemoveSocketIndex).toBeNull();
        expect(forge.btnForgeRemoveGem.disabled).toBe(true);
        expect(forge.forgeGemRemovePreview.textContent).toContain('Click a gem');
        forge.handleForgeRemoveGem();
        expect(forge.onForgeRemoveGem).not.toHaveBeenCalled();
        forge.forgeGemRemoveSlots.firstElementChild.click();
        forge.handleForgeRemoveGem();
        expect(forge.onForgeRemoveGem).toHaveBeenCalledWith('mainHand', 0,
            expect.objectContaining({ itemId: changed.id, gems: changed.gems }));
    });

    test('unrelated equipment updates preserve the chosen removal gem', () => {
        const { engine, forge, item, delta } = setup();
        const socketed = { ...item, sockets: 1, gems: [{ type: 'Ruby', quality: 'Chipped' }] };
        engine.player.equipment.mainHand = socketed;
        forge.selectedRemoveEquipSlot = 'mainHand';
        forge.refresh(engine.player);
        forge.forgeGemRemoveSlots.firstElementChild.click();
        delta({ equipment: { mainHand: socketed, head: { id: 'hat', name: 'Hat', level: 30 } } });
        expect(forge.selectedRemoveSocketIndex).toBe(0);
        expect(forge.btnForgeRemoveGem.disabled).toBe(false);
    });

    test('one gem stack can supply the three-unit recipe without splitting it', () => {
        const { engine, forge } = setup();
        engine.player.inventory = [{ id: 'gem-stack', type: 'GEM', gemType: 'Ruby', gemQuality: 'Chipped', stack: 5 }];
        forge.onForgeCombineGem = jest.fn();
        forge.updateGemCombineUI(engine.player);
        forge.forgeGemCombineInventory.querySelector('.inv-slot').click();
        expect(forge.selectedCombineGemIndices).toEqual([0, 0, 0]);
        expect(forge.forgeGemCombineInventory.textContent).toContain('×3');
        forge.handleForgeCombineGem();
        expect(forge.onForgeCombineGem).toHaveBeenCalledWith([0, 0, 0],
            { gemIds: ['gem-stack', 'gem-stack', 'gem-stack'], gemCounts: [5, 5, 5] });
        expect(engine.player.inventory[0].stack).toBe(5);
    });

    test('socket and destructive removal quotes keep the displayed socket contents', () => {
        const { engine, forge, item } = setup();
        Object.assign(item, { sockets: 2, gems: [
            { type: 'Ruby', quality: 'Chipped', stats: { strength: 1 } },
            { type: 'Sapphire', quality: 'Chipped', stats: { intelligence: 1 } }
        ] });
        forge.selectedForgeSocketSlot = 'mainHand';
        forge.selectedRemoveEquipSlot = 'mainHand';
        forge.selectedRemoveSocketIndex = 0;
        forge.onForgeSocket = jest.fn();
        forge.onForgeRemoveGem = jest.fn();
        forge.updateForgeSocketInfo(item, engine.player);
        forge.updateGemRemoveInfo(item, engine.player);
        const displayed = { itemId: 'staff', level: 30, potency: 0, sockets: 2,
            gems: JSON.parse(JSON.stringify(item.gems)) };
        item.sockets = 3;
        item.gems[0].stats.strength = 99;
        item.gems.shift();
        forge.handleForgeSocket();
        forge.handleForgeRemoveGem();
        expect(forge.onForgeSocket).toHaveBeenCalledWith('mainHand', displayed);
        expect(forge.onForgeRemoveGem).toHaveBeenCalledWith('mainHand', 0, displayed);
    });

    test.each(['insert', 'combine'])('%s preserves the displayed gem IDs when bag contents change before the click', action => {
        const { engine, forge, item } = setup();
        item.sockets = 2;
        engine.player.inventory = ['gem-a', 'gem-b', 'gem-c'].map(id => ({ id, type: 'GEM', gemType: 'Ruby', gemQuality: 'Chipped' }));
        if (action === 'insert') {
            forge.selectedGemEquipSlot = 'mainHand';
            forge.selectedGemSocketIndex = 0;
            forge.selectedGemInvIndex = 0;
            forge.onForgeInsertGem = jest.fn();
            forge.updateForgeGemInfo(item, engine.player);
            engine.player.inventory[0] = { ...engine.player.inventory[0], id: 'replacement-gem' };
            forge.handleForgeInsertGem();
            expect(forge.onForgeInsertGem).toHaveBeenCalledWith('mainHand', 0, 0,
                { itemId: 'staff', level: 30, potency: 0, sockets: 2, gems: [], gemIds: ['gem-a'], gemCounts: [1] });
        } else {
            forge.selectedCombineGemIndices = [0, 1, 2];
            forge.onForgeCombineGem = jest.fn();
            forge.updateGemCombineSlots(engine.player);
            engine.player.inventory.reverse();
            forge.handleForgeCombineGem();
            expect(forge.onForgeCombineGem).toHaveBeenCalledWith([0, 1, 2], { gemIds: ['gem-a', 'gem-b', 'gem-c'], gemCounts: [1, 1, 1] });
        }
    });

    test('upgrade requests retain the displayed item and price state until refreshed', () => {
        const { engine, forge, item } = setup();
        forge.onForgeUpgrade = jest.fn();
        forge.onForgePotency = jest.fn();
        engine.player.equipment.mainHand = { ...item, id: 'replacement', level: 40, potency: 3 };
        const displayed = { itemId: 'staff', level: 30, potency: 0, sockets: 0, gems: [] };
        forge.handleForgeUpgrade(1);
        forge.handleForgePotency();
        expect(forge.onForgeUpgrade).toHaveBeenCalledWith('mainHand', 1, displayed);
        expect(forge.onForgePotency).toHaveBeenCalledWith('mainHand', displayed);
        forge.refresh(engine.player);
        forge.handleForgeUpgrade(1);
        forge.handleForgePotency();
        const refreshed = { itemId: 'replacement', level: 40, potency: 3, sockets: 0, gems: [] };
        expect(forge.onForgeUpgrade).toHaveBeenLastCalledWith('mainHand', 1, refreshed);
        expect(forge.onForgePotency).toHaveBeenLastCalledWith('mainHand', refreshed);
    });

    test('level requirements disable only unavailable upgrade choices and refresh as the character levels', () => {
        const { engine, item, delta } = setup();
        const one = document.getElementById('btn-forge-upgrade-1');
        const ten = document.getElementById('btn-forge-upgrade-10');
        delta({ level: 30 });
        expect(one.disabled).toBe(true);
        expect(one.textContent).toContain('Requires Level 31');
        expect(ten.disabled).toBe(true);
        expect(ten.textContent).toContain('Requires Level 40');
        delta({ level: 35 });
        expect(one.disabled).toBe(false);
        expect(ten.disabled).toBe(true);
        delta({ level: 40 });
        expect(ten.disabled).toBe(false);
        expect(item.level).toBe(30);
        expect(engine.player.inventory[0].stack).toBe(10);
    });

    test('near-cap batch quote names the actual number of levels', () => {
        const { engine, forge, item } = setup();
        engine.player.level = 100;
        engine.player.inventory[0].stack = 100;
        forge.updateForgeInfo({ ...item, level: 95 });
        expect(document.getElementById('forge-cost-value').textContent).toContain('(5 Lvl)');
        expect(document.getElementById('btn-forge-upgrade-10').textContent).toContain('+5 Levels');
    });

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
