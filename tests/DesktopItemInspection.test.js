import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { InventoryUI } from '../src/ui/InventoryUI.js';
import { SET_DEFINITIONS } from '../src/core/ItemSystem.js';

let ui, player;
beforeEach(() => {
    document.body.innerHTML = new DOMParser().parseFromString(readFileSync('index.html', 'utf8'), 'text/html').body.innerHTML;
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
    const item = { id: 'blade', name: 'Lantern Blade', type: 'WEAPON', slot: 'mainHand', level: 1,
        rarity: { name: 'Rare', color: '#55aaff' }, stats: { damage: 12, defense: -2 } };
    player = { level: 10, gold: 0, isMultiplayer: true, inventory: [item], equipment: { mainHand: { ...item, id: 'worn', stats: { ...item.stats } } }, equipItem: jest.fn(() => true) };
    ui = new InventoryUI({ isMobile: false, getLastPlayer: () => player, getItemIconPath: () => '',
        formatStatName: k => k, getRarityColor: () => '#fff', updateCharacterSheet: jest.fn() });
    ui.onUnequipRequest = jest.fn(); ui.onStashDeposit = jest.fn(); ui.sellItem = jest.fn();
    window.game = { inputManager: { clearInputState: jest.fn() } };
    ui.updateInventory(player);
});
afterEach(() => { ui.mobileDetails.dispose(); delete window.game; });
const rightClick = el => el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));

test('right-click inspects without equipping; deliberate equip retains server ownership', () => {
    rightClick(ui.inventoryGrid.children[0]);
    expect(ui.mobileDetails.dialog.open).toBe(true);
    expect(ui.mobileDetails.dialog.classList.contains('desktop-item-details')).toBe(true);
    expect(player.equipItem).not.toHaveBeenCalled();
    expect(window.game.inputManager.clearInputState).toHaveBeenCalled();
    expect([...ui.mobileDetails.dialog.querySelectorAll('dd')].map(el => el.textContent)).toEqual(['+12', '-2']);
    ui.mobileDetails.act('equip');
    expect(player.equipItem).toHaveBeenCalledWith(player.inventory[0]);
    expect(player.inventory[0].id).toBe('blade');
});
test('merchant and stash right-click shortcuts remain unchanged', () => {
    ui.shopScreen.style.display = 'flex'; rightClick(ui.inventoryGrid.children[0]);
    expect(ui.sellItem).toHaveBeenCalledWith(player, 0);
    expect(ui.mobileDetails.dialog.open).toBe(false);
    ui.shopScreen.style.display = 'none'; ui.stashScreen.style.display = 'flex';
    rightClick(ui.inventoryGrid.children[0]);
    expect(ui.onStashDeposit).toHaveBeenCalledWith('blade');
    expect(ui.mobileDetails.dialog.open).toBe(false);
});
test('set details exclude inactive legacy equipment in both inspection and hover', () => {
    const setId = Object.keys(SET_DEFINITIONS)[0];
    player.inventory[0].setId = setId;
    player.equipment = {
        head: { id: 'real-set-piece', type: 'ARMOR', slot: 'head', setId },
        legacy: { id: 'inactive-old-piece', type: 'ARMOR', slot: 'chest', setId },
        chest: { id: 'wrong-slot-piece', type: 'ARMOR', slot: 'feet', setId }
    };
    ui.updateInventory(player); rightClick(ui.inventoryGrid.children[0]);
    const expected = `1/${SET_DEFINITIONS[setId].slots.length}`;
    expect(ui.mobileDetails.get('description').textContent).toContain(expected + ' equipped');
    expect(ui.mobileDetails.get('description').textContent).toContain('2 pieces (inactive)');
    ui.showItemTooltip(player.inventory[0], 0, 0);
    expect(ui.statTooltipDesc.textContent).toContain(expected + ' pieces');
    expect(Object.keys(player.equipment)).toHaveLength(3);
});
test('comparison does not subtract stats from an inactive stored item', () => {
    player.equipment.mainHand = { id: 'legacy-gem', name: 'Stored Sapphire', type: 'GEM', slot: 'gem', stats: { damage: 50 } };
    ui.updateInventory(player); rightClick(ui.inventoryGrid.children[0]); ui.mobileDetails.act('compare');
    expect(ui.mobileDetails.get('comparison').textContent).toContain('+12 damage');
    expect(ui.mobileDetails.get('comparison').textContent).toContain('No active gear');
    expect(ui.mobileDetails.get('comparison').textContent).toContain('Stored Sapphire');
    expect(player.equipment.mainHand.stats.damage).toBe(50);
});
test('same-ID upgrades refresh stats and comparison without resetting focus on unrelated ticks', () => {
    rightClick(ui.inventoryGrid.children[0]); ui.mobileDetails.act('compare');
    const button = ui.mobileDetails.get('compare'); button.focus();
    const first = ui.mobileDetails.get('description').firstChild;
    ui.updateInventory(player);
    expect(ui.mobileDetails.get('description').firstChild).toBe(first);
    player.inventory[0].stats.damage = 25;
    ui.updateInventory(player);
    expect(ui.mobileDetails.get('description').textContent).toContain('+25');
    expect(ui.mobileDetails.get('comparison').textContent).toContain('+13 damage');
    expect(ui.mobileDetails.get('comparison').hidden).toBe(false);
    expect(document.activeElement).toBe(button);
});
test('keyboard inspection and equipped inspection do not invoke quick actions', () => {
    ui.inventoryGrid.children[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true }));
    expect(ui.mobileDetails.dialog.open).toBe(true); ui.mobileDetails.close();
    ui.updateEquipSlot('slot-mainhand', player.equipment.mainHand, 'MAIN HAND', 'mainHand');
    rightClick(document.getElementById('slot-mainhand'));
    expect(ui.mobileDetails.get('title').textContent).toBe('Lantern Blade');
    expect(ui.mobileDetails.get('unequip').hidden).toBe(false);
    expect(ui.onUnequipRequest).not.toHaveBeenCalled();
    player.equipment.mainHand = null;
    ui.mobileDetails.act('unequip');
    expect(ui.onUnequipRequest).not.toHaveBeenCalled();
    expect(ui.mobileDetails.get('status').textContent).toContain('changed');
});
