import { jest } from '@jest/globals';
import fs from 'node:fs';
import { InventoryUI } from '../src/ui/InventoryUI.js';
import { PhoneStashUI } from '../src/ui/PhoneStashUI.js';

const html = fs.readFileSync('index.html', 'utf8');
const item = (id, extra = {}) => ({ id, name: `Stored ${id}`, type: 'WEAPON', slot: 'mainHand',
    rarity: { name: 'Common', color: '#fff' }, level: 1, stats: { damage: 12 }, stack: 1, ...extra });
let ui, player;
beforeEach(() => {
    document.body.innerHTML = new DOMParser().parseFromString(html, 'text/html').body.innerHTML;
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
    player = { level: 10, gold: 20, isMultiplayer: true, inventory: [item('bag')], stash: [item('stored')], equipment: {} };
    ui = new InventoryUI({ isMobile: true, getLastPlayer: () => player, getItemIconPath: () => '',
        formatStatName: key => key, getRarityColor: () => '#fff', addChatMessage: jest.fn(), updateCharacterSheet: jest.fn() });
    ui.onStashDeposit = jest.fn(); ui.onStashWithdraw = jest.fn(); ui.onUnequipRequest = jest.fn();
    ui.toggleStash();
});
afterEach(() => ui.mobileDetails.dispose());
const click = id => document.getElementById(id).click();
const openRow = () => ui.phoneStash.list.querySelector('button').click();

test('opening storage gives one phone surface, with both locations available', () => {
    expect(ui.isStashOpen).toBe(true); expect(ui.inventoryScreen.style.display).toBe('none');
    expect(ui.phoneStash.summary.textContent).toContain('1 / 25');
    click('phone-stash-stored-tab'); expect(ui.phoneStash.summary.textContent).toContain('1 / 100');
    expect(ui.phoneStash.list.textContent).toContain('Stored stored');
});
test('inspection is read-only; explicit deposit requests the exact item without removing it locally', () => {
    openRow(); expect(ui.onStashDeposit).not.toHaveBeenCalled();
    for (const action of ['equip', 'drop', 'compare', 'sell', 'withdraw']) expect(ui.mobileDetails.get(action).hidden).toBe(true);
    click('phone-item-stash'); expect(ui.onStashDeposit).toHaveBeenCalledWith('bag');
    expect(player.inventory[0].id).toBe('bag'); expect(ui.mobileDetails.dialog.open).toBe(false);
});
test('minimal layouts with a separately hosted legacy grid still initialize', () => {
    document.body.append(ui.stashGrid);
    expect(() => new PhoneStashUI(ui)).not.toThrow();
    expect(ui.stashScreen.querySelectorAll('#phone-stash')).toHaveLength(1);
});
test('withdrawal is deliberate and cannot trigger an equipment action', () => {
    click('phone-stash-stored-tab'); openRow();
    expect(ui.onStashWithdraw).not.toHaveBeenCalled();
    for (const action of ['equip', 'unequip', 'drop', 'stash', 'sell', 'compare']) expect(ui.mobileDetails.get(action).hidden).toBe(true);
    ui.mobileDetails.act('unequip'); expect(ui.onUnequipRequest).not.toHaveBeenCalled();
    click('phone-item-withdraw'); expect(ui.onStashWithdraw).toHaveBeenCalledWith('stored');
    expect(player.stash[0].id).toBe('stored');
});
test('stale stash slots cannot withdraw the replacement item', () => {
    click('phone-stash-stored-tab'); openRow(); player.stash[0] = item('replacement');
    ui.updateStash(player); ui.mobileDetails.act('withdraw');
    expect(ui.onStashWithdraw).not.toHaveBeenCalled();
    expect(ui.mobileDetails.get('status').textContent).toMatch(/changed/);
    expect(ui.mobileDetails.get('back').disabled).toBe(false);
});
test('quest relics cannot be deposited even with a direct action call', () => {
    player.inventory[0] = item('chronicle-item-seed', { type: 'RELIC', slot: 'relic' });
    ui.updateInventory(player); openRow(); ui.mobileDetails.act('stash');
    expect(ui.onStashDeposit).not.toHaveBeenCalled();
});
test('server bag changes update the storage list and stale detail actions together', () => {
    openRow(); player.inventory[0] = null; ui.updateInventory(player);
    expect(ui.phoneStash.list.textContent).toContain('bag is empty');
    expect(ui.mobileDetails.get('stash').disabled).toBe(true);
    click('phone-item-back'); expect(document.activeElement).toBe(ui.phoneStash.list);
});
test('unchanged refreshes and tab switches preserve each reading position', () => {
    const row = ui.phoneStash.list.firstChild;
    ui.phoneStash.list.scrollTop = 200; ui.updateStash(player);
    expect(ui.phoneStash.list.firstChild).toBe(row); expect(ui.phoneStash.list.scrollTop).toBe(200);
    click('phone-stash-stored-tab'); ui.phoneStash.list.scrollTop = 70;
    click('phone-stash-bag-tab'); expect(ui.phoneStash.list.scrollTop).toBe(200);
    click('phone-stash-stored-tab'); expect(ui.phoneStash.list.scrollTop).toBe(70);
});
test('Back returns focus to the refreshed row after item data updates', () => {
    openRow(); player.inventory[0].stats.damage = 13; ui.updateInventory(player);
    click('phone-item-back'); expect(document.activeElement).toBe(ui.phoneStash.list.querySelector('button'));
});
test('a full destination does not discard or locally transfer an item', () => {
    player.inventory = Array.from({ length: 25 }, (_, index) => item(`full-${index}`));
    ui.updateInventory(player); click('phone-stash-stored-tab'); openRow(); click('phone-item-withdraw');
    expect(ui.onStashWithdraw).toHaveBeenCalledWith('stored');
    expect(player.inventory).toHaveLength(25); expect(player.stash[0].id).toBe('stored');
});
test('keyboard tabs have one tab stop and close dismisses details too', () => {
    const tab = document.getElementById('phone-stash-bag-tab');
    tab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement.id).toBe('phone-stash-stored-tab'); expect(tab.tabIndex).toBe(-1);
    openRow(); ui.toggleStash(); expect(ui.mobileDetails.dialog.open).toBe(false);
    expect(ui.isStashOpen).toBe(false);
});
