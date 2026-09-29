import { jest } from '@jest/globals';
import fs from 'node:fs';
import { InventoryUI } from '../src/ui/InventoryUI.js';

const html = fs.readFileSync('index.html', 'utf8');
const item = (id, extra = {}) => ({ id, name: `Stored ${id}`, type: 'WEAPON', slot: 'mainHand',
    rarity: { name: 'Rare', color: '#acf' }, level: 10, stats: { damage: 12 }, stack: 1, ...extra });
let ui, player, browser;
beforeEach(() => {
    document.body.innerHTML = new DOMParser().parseFromString(html, 'text/html').body.innerHTML;
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
    player = { level: 10, gold: 20, isMultiplayer: true, inventory: [null, item('bag')], stash: [item('stored')], equipment: {} };
    ui = new InventoryUI({ isMobile: false, getLastPlayer: () => player, getItemIconPath: () => '',
        formatStatName: key => key, getRarityColor: () => '#acf', addChatMessage: jest.fn(), updateCharacterSheet: jest.fn() });
    ui.onStashDeposit = jest.fn(); ui.onStashWithdraw = jest.fn();
    ui.toggleStash(); browser = ui.stashBrowser;
});
afterEach(() => ui.mobileDetails.dispose());
const row = source => browser.panes[source].list.querySelector('button');
const right = element => element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));

test('one desktop window exposes both named locations with occupied capacity', () => {
    expect(ui.inventoryScreen.style.display).toBe('none');
    expect(browser.panes.inventory.count.textContent).toBe('1 / 25');
    expect(browser.panes.stash.count.textContent).toBe('1 / 100');
    expect(row('inventory').textContent).toContain('Stored bag');
    expect(row('inventory').dataset.slotIndex).toBe('1');
});
test('filtered rows keep original slots; inspection and transfers never mutate local ownership', () => {
    player.inventory.push(item('gem', { type: 'GEM', slot: null })); ui.updateInventory(player);
    browser.filter.value = 'gems'; browser.filter.dispatchEvent(new Event('change'));
    expect(row('inventory').dataset.slotIndex).toBe('2');
    row('inventory').click(); expect(ui.mobileDetails.source.index).toBe(2);
    expect(ui.onStashDeposit).not.toHaveBeenCalled();
    expect(ui.mobileDetails.get('equip').hidden).toBe(true);
    ui.mobileDetails.get('stash').click(); expect(ui.onStashDeposit).toHaveBeenCalledWith('gem');
    expect(player.inventory[2].id).toBe('gem');
    browser.filter.value = 'all'; browser.filter.dispatchEvent(new Event('change'));
    right(row('stash')); expect(ui.onStashWithdraw).toHaveBeenCalledWith('stored');
    expect(player.stash[0].id).toBe('stored'); expect(player.gold).toBe(20);
});
test('search is case-insensitive and shows no-match state without changing capacity', () => {
    browser.search.value = 'RARE'; browser.search.dispatchEvent(new Event('input'));
    expect(row('inventory')).not.toBeNull();
    browser.search.value = 'absent'; browser.search.dispatchEvent(new Event('input'));
    expect(row('inventory')).toBeNull(); expect(browser.panes.inventory.list.textContent).toContain('No matching');
    expect(browser.panes.inventory.count.textContent).toBe('1 / 25');
});
test('stale rows and protected quest items cannot request the wrong transfer', () => {
    const stale = row('inventory'); player.inventory[1] = item('replacement'); right(stale);
    expect(ui.onStashDeposit).not.toHaveBeenCalled();
    player.inventory[1] = item('chronicle-item-seed'); ui.updateInventory(player);
    right(row('inventory')); row('inventory').click(); ui.mobileDetails.act('stash');
    expect(ui.onStashDeposit).not.toHaveBeenCalled();
});
test('refresh preserves scroll and focus, and invalidates removed item actions', () => {
    const first = row('stash'); browser.panes.stash.list.scrollTop = 200;
    ui.updateStash(player); expect(row('stash')).toBe(first);
    expect(browser.panes.stash.list.scrollTop).toBe(200);
    first.click(); player.stash[0].stats.damage++; ui.updateStash(player);
    ui.mobileDetails.get('back').click(); expect(document.activeElement).toBe(row('stash'));
    row('stash').click(); player.stash = []; ui.updateStash(player);
    expect(ui.mobileDetails.get('withdraw').disabled).toBe(true);
    expect(browser.panes.stash.list.textContent).toContain('stash is empty');
    ui.mobileDetails.get('back').click(); expect(document.activeElement).toBe(browser.panes.stash.list);
});
test('full capacity stays visible and closing storage dismisses inspection', () => {
    player.stash = Array.from({ length: 100 }, (_, i) => item(`stored-${i}`)); ui.updateStash(player);
    expect(browser.panes.stash.count.textContent).toBe('100 / 100');
    expect(browser.panes.stash.count.classList.contains('full')).toBe(true);
    row('stash').click(); ui.toggleStash();
    expect(ui.mobileDetails.dialog.open).toBe(false); expect(ui.isStashOpen).toBe(false);
    right(row('stash')); expect(ui.onStashWithdraw).not.toHaveBeenCalled();
});
