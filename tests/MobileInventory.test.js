import { jest } from '@jest/globals';
import fs from 'fs';
import { InventoryUI } from '../src/ui/InventoryUI.js';

const html = fs.readFileSync('index.html', 'utf8');
const makeItem = (overrides = {}) => ({ id: 'sword', name: 'Lantern Sword', type: 'WEAPON', slot: 'mainHand',
    rarity: { name: 'Common', color: '#fff' }, level: 1, stats: { damage: 12 }, stack: 1, ...overrides });

describe('phone inventory uses deliberate item actions', () => {
    let ui, player;
    beforeEach(() => {
        document.body.innerHTML = new DOMParser().parseFromString(html, 'text/html').body.innerHTML;
        HTMLDialogElement.prototype.showModal = function () { this.open = true; };
        HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
        player = { level: 10, gold: 20, isMultiplayer: true, inventory: [makeItem()], equipment: {}, equipItem: jest.fn(() => true) };
        ui = new InventoryUI({ isMobile: true, getLastPlayer: () => player, getItemIconPath: () => '',
            formatStatName: key => key, getRarityColor: () => '#fff', addChatMessage: jest.fn(), updateCharacterSheet: jest.fn() });
        window.game = { dropInventoryItem: jest.fn(() => true) };
        ui.updateInventory(player);
    });
    afterEach(() => { ui.mobileDetails?.close(); delete window.game; });
    const click = id => document.getElementById(id).click();
    const openBag = () => document.querySelector('#inventory-grid .inv-slot').click();

    test('quest materials open readable details without an equip or drop action', () => {
        player.inventory[0] = makeItem({ id: 'chronicle-item-root', name: 'Elderroot Memory', type: 'RELIC', slot: 'relic' });
        ui.updateInventory(player); openBag();
        expect(document.querySelector('#phone-item-details[open]')).not.toBeNull();
        expect(document.getElementById('phone-item-title').textContent).toBe('Elderroot Memory');
        expect(document.getElementById('phone-item-equip').hidden).toBe(true);
        expect(document.getElementById('phone-item-drop').hidden).toBe(true);
        expect(player.equipItem).not.toHaveBeenCalled();
    });
    test('tapping a bag row only inspects; explicit equip uses the current authoritative item', () => {
        openBag(); openBag();
        expect(player.equipItem).not.toHaveBeenCalled();
        click('phone-item-equip');
        expect(player.equipItem).toHaveBeenCalledWith(player.inventory[0]);
        expect(player.inventory[0].id).toBe('sword');
    });
    test('tapping equipped gear does not unequip until the explicit action', () => {
        player.equipment.mainHand = makeItem();
        ui.onUnequipRequest = jest.fn();
        ui.updateEquipSlot('slot-mainhand', player.equipment.mainHand, 'MAIN HAND', 'mainHand');
        click('slot-mainhand');
        expect(ui.onUnequipRequest).not.toHaveBeenCalled();
        click('phone-item-unequip');
        expect(ui.onUnequipRequest).toHaveBeenCalledWith('mainHand');
    });
    test('drop requires confirmation and cannot act on a replaced slot', () => {
        openBag(); click('phone-item-drop');
        expect(window.game.dropInventoryItem).not.toHaveBeenCalled();
        player.inventory[0] = makeItem({ id: 'replacement' });
        click('phone-item-drop');
        expect(window.game.dropInventoryItem).not.toHaveBeenCalled();
        expect(document.getElementById('phone-item-status').textContent).toMatch(/changed/i);
    });
    test('confirmed drop requests the exact stack without removing it locally', () => {
        openBag(); click('phone-item-drop'); click('phone-item-drop');
        expect(window.game.dropInventoryItem).toHaveBeenCalledWith(0, 'sword');
        expect(player.inventory[0].id).toBe('sword');
    });
    test('stack changes require a new drop confirmation', () => {
        openBag(); click('phone-item-drop'); player.inventory[0].stack = 3; click('phone-item-drop');
        expect(window.game.dropInventoryItem).not.toHaveBeenCalled();
        expect(document.getElementById('phone-item-status').textContent).toMatch(/stack changed/i);
    });
    test('comparison uses the actual weaker ring slot, without Shift', () => {
        player.inventory[0] = makeItem({ slot: 'ring', type: 'ACCESSORY' });
        player.equipment = { ring1: makeItem({ id: 'strong', name: 'Strong Ring', level: 10 }), ring2: makeItem({ id: 'weak', name: 'Worn Ring', level: 2 }) };
        ui.updateInventory(player); openBag(); click('phone-item-compare');
        expect(document.getElementById('phone-item-comparison').textContent).toContain('Ring 2');
        expect(document.getElementById('phone-item-comparison').textContent).toContain('Worn Ring');
    });
    test('network inventory replacement disables stale actions while retaining a way back', () => {
        openBag(); player.inventory[0] = null; ui.updateInventory(player);
        expect(document.getElementById('phone-item-equip').disabled).toBe(true);
        expect(document.getElementById('phone-item-drop').disabled).toBe(true);
        expect(document.getElementById('phone-item-back').disabled).toBe(false);
    });
    test('a level-locked item cannot be equipped even through a direct action call', () => {
        player.inventory[0].level = 99; ui.updateInventory(player); openBag();
        expect(document.getElementById('phone-item-equip').disabled).toBe(true);
        ui.mobileDetails.act('equip'); expect(player.equipItem).not.toHaveBeenCalled();
    });
    test('quest protection and non-equippable classification are enforced beyond button visibility', () => {
        player.inventory[0] = makeItem({ id: 'chronicle-item-locked', slot: 'relic', type: 'RELIC' });
        ui.updateInventory(player); openBag();
        ui.mobileDetails.act('drop'); ui.mobileDetails.act('drop'); ui.mobileDetails.act('equip');
        expect(window.game.dropInventoryItem).not.toHaveBeenCalled();
        expect(player.equipItem).not.toHaveBeenCalled();
    });
    test('offline equip removes the bag reference and restores it if equipping fails', () => {
        player.isMultiplayer = false; player.equipItem.mockReturnValue(false); openBag(); click('phone-item-equip');
        expect(player.inventory[0].id).toBe('sword');
        player.equipItem.mockReturnValue(true); click('phone-item-equip'); expect(player.inventory[0]).toBeNull();
    });
    test('phone rows disable native dragging, and closing/disposal releases the modal', () => {
        expect(document.querySelector('.inv-slot').draggable).toBe(false);
        openBag(); ui.mobileDetails.dispose();
        expect(document.getElementById('phone-item-details')).toBeNull();
    });
});
