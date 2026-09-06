import { jest } from '@jest/globals';
import fs from 'node:fs';
import { Actor } from '../src/entities/Actor.js';
import { CONSTANTS } from '../src/core/Constants.js';
import { InventoryUI } from '../src/ui/InventoryUI.js';
import { EQUIPMENT_SLOT_KEYS, itemFitsEquipmentSlot, isActiveEquipment } from '../src/core/EquipmentSlots.js';

const gem = { id: 'loose-gem', name: 'Sapphire', type: 'GEM', slot: 'gem', level: 1,
    stack: 5, maxStack: 20, rarity: { name: 'Common', color: '#fff' }, stats: { intelligence: 50 } };

test.each(EQUIPMENT_SLOT_KEYS)('real equipment slot %s remains valid', slot => {
    const itemSlot = slot.startsWith('ring') ? 'ring' : slot.startsWith('trinket') ? 'trinket' : slot;
    expect(itemFitsEquipmentSlot({ slot: itemSlot, type: 'ARMOR' }, slot)).toBe(true);
    expect(isActiveEquipment(slot, { slot: itemSlot, type: 'ARMOR' })).toBe(true);
});

test('loose gems grant no stats but gems socketed into real gear do', () => {
    const actor = new Actor('gem-stat-actor', CONSTANTS.ENTITIES.FIGHTER);
    actor.recalculateStats(); const baseline = actor.stats.intelligence;
    actor.equipment.gem = gem; actor.recalculateStats();
    expect(actor.stats.intelligence).toBe(baseline);
    expect(actor.equipment.gem).toBe(gem);
    actor.equipment.mainHand = { slot: 'mainHand', type: 'WEAPON', stats: {}, gems: [{ stats: { intelligence: 7 } }] };
    actor.recalculateStats();
    expect(actor.stats.intelligence).toBe(baseline + 7);
    actor.dispose();
});

test.each([gem, { ...gem, type: 'WEAPON', slot: 'hidden' }])('Actor rejects unsupported equipment $slot', item => {
    const actor = new Actor('slot-actor', CONSTANTS.ENTITIES.FIGHTER);
    const before = { ...actor.equipment };
    expect(actor.equipItem(item)).toBe(false);
    expect(actor.equipment).toEqual(before);
    actor.dispose();
});

describe('ordinary bag equipment validation and legacy recovery', () => {
    let ui, player;
    beforeEach(() => {
        document.body.innerHTML = new DOMParser().parseFromString(fs.readFileSync('index.html', 'utf8'), 'text/html').body.innerHTML;
        player = { level: 30, inventory: [gem], equipment: {}, equipItem: jest.fn(() => true) };
        ui = new InventoryUI({ getLastPlayer: () => player, getItemIconPath: () => '',
            formatStatName: key => key, getRarityColor: () => '#fff', updateCharacterSheet: jest.fn() });
        window.game = { sendEquipMessage: jest.fn() };
        ui.onUnequipRequest = jest.fn();
    });
    afterEach(() => { ui.mobileDetails?.dispose(); delete window.game; });
    test('clicking a loose gem never removes it from the bag or equips it', () => {
        ui.updateInventory(player);
        document.querySelector('#inventory-grid .inv-slot').click();
        expect(player.equipItem).not.toHaveBeenCalled();
        expect(player.inventory[0]).toEqual(gem);
    });
    test('dragging a gem onto equipment never sends an equip request', () => {
        ui.handleItemDrop({ type: 'inventory', id: 0 }, { type: 'equipment', id: 'mainHand' });
        expect(window.game.sendEquipMessage).not.toHaveBeenCalled();
    });
    test('saved unsupported equipment offers recovery without local deletion', () => {
        player.equipment.gem = gem;
        ui.updateInventory(player);
        const button = document.querySelector('#inventory-recovery button');
        expect(button).not.toBeNull();
        expect(button.textContent).toContain('Sapphire');
        button.click();
        expect(ui.onUnequipRequest).toHaveBeenCalledWith('gem', gem.id);
        expect(player.equipment.gem).toEqual(gem);
    });
    test('a stale recovery button cannot act on a replacement item', () => {
        player.equipment.gem = gem;
        ui.updateInventory(player);
        const button = document.querySelector('#inventory-recovery button');
        expect(button).not.toBeNull();
        player.equipment.gem = { ...gem, id: 'different-gem' };
        button.click();
        expect(ui.onUnequipRequest).not.toHaveBeenCalled();
    });
    test('recovery feedback accepts only the matching server receipt', () => {
        player.equipment.gem = gem;
        ui.updateInventory(player);
        document.querySelector('#inventory-recovery button').click();
        const status = document.querySelector('.inventory-recovery-status');
        ui.handleEquipmentActionResult({ slot: 'gem', itemId: 'other', success: false, message: 'Wrong item' });
        expect(status.textContent).not.toBe('Wrong item');
        ui.handleEquipmentActionResult({ slot: 'gem', itemId: gem.id, success: false, message: 'Free enough bag space' });
        expect(status.textContent).toBe('Free enough bag space');
        expect(ui.recoveryRequest).toBeNull();
    });
});
