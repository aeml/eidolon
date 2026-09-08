import { jest } from '@jest/globals';
import { TradingUI } from '../src/ui/TradingUI.js';
import { installUIManagerCharacter } from '../src/ui/UIManagerCharacter.js';

class CharacterUI {}
installUIManagerCharacter(CharacterUI);

function setup() {
    document.body.innerHTML = `
        <div id="trading-house-screen" style="display:flex"></div>
        <div id="trading-sell-slot"></div><div id="trading-inventory-list"></div>
        <div id="trading-house-guidance"></div>
        <input id="trading-input-bid" value="100"><input id="trading-input-buyout" value="500">
        <input id="trading-input-duration" value="24"><button id="btn-trading-create">List</button>`;
    const item = { id: 'selected', name: 'Selected Ore', stack: 3, rarity: 'RARE' };
    const player = { inventory: [item, null] };
    const chat = jest.fn();
    const ui = new TradingUI({ getLastPlayer: () => player, getItemIconPath: () => '/ore.png',
        getRarityColor: () => '#123456', addChatMessage: chat });
    ui.onTradingCreate = jest.fn();
    ui.updateInventory(player);
    document.querySelector('#trading-inventory-list .inv-slot').click();
    return { item, player, ui, chat };
}

test('normal listing sends selected ID and full quantity, then clears the preview', () => {
    const { ui } = setup();
    document.getElementById('btn-trading-create').click();
    expect(ui.onTradingCreate).toHaveBeenCalledWith(0, 100, 500, 24, 'selected', 3);
    expect(ui.selectedTradingItem).toBeNull();
    expect(ui.tradingSellSlot.textContent).toBe('+');
    expect(ui.tradingSellSlot.style.border).toBe('');
});

test.each(['replacement', 'larger', 'smaller', 'moved', 'missing'])('submit rejects %s before sending', mode => {
    const { ui, player, item, chat } = setup();
    if (mode === 'replacement') player.inventory[0] = { ...item, id: 'different' };
    if (mode === 'larger') item.stack++;
    if (mode === 'smaller') item.stack--;
    if (mode === 'moved') player.inventory = [null, item];
    if (mode === 'missing') player.inventory = [];
    document.getElementById('btn-trading-create').click();
    expect(ui.onTradingCreate).not.toHaveBeenCalled();
    expect(ui.selectedTradingItem).toBeNull();
    expect(chat).toHaveBeenCalledWith('System', expect.stringContaining('Select the item again'));
});

test('ordinary inventory refresh invalidates selection and allows explicit reselection', () => {
    const { ui, player, item } = setup();
    player.inventory[0] = { ...item, id: 'replacement', stack: 5 };
    const manager = { inventory: { updateInventory: jest.fn() }, trading: ui };
    CharacterUI.prototype.updateInventory.call(manager, player);
    expect(ui.selectedTradingItem).toBeNull();
    expect(document.getElementById('trading-house-guidance').textContent).toContain('changed');
    document.querySelector('#trading-inventory-list .inv-slot').click();
    document.getElementById('btn-trading-create').click();
    expect(ui.onTradingCreate).toHaveBeenCalledWith(0, 100, 500, 24, 'replacement', 5);
});

test('unchanged refreshed objects preserve selection', () => {
    const { ui, player, item } = setup();
    player.inventory[0] = { ...item };
    ui.updateInventory(player);
    expect(ui.selectedTradingItem.id).toBe('selected');
});

test('close clears selection and preview', () => {
    const { ui } = setup();
    ui.close();
    expect(ui.selectedTradingItem).toBeNull();
    expect(ui.tradingSellSlot.style.backgroundImage).toBe('none');
});
