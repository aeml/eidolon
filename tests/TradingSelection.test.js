import { jest } from '@jest/globals';
import { TradingUI } from '../src/ui/TradingUI.js';
import { installUIManagerCharacter } from '../src/ui/UIManagerCharacter.js';
import { installUIManagerWindows } from '../src/ui/UIManagerWindows.js';
import { installGameEngineNetworkMessages } from '../src/core/GameEngineNetworkMessages.js';

class CharacterUI {}
installUIManagerCharacter(CharacterUI);
installUIManagerWindows(CharacterUI);
class NetworkFixture {}
installGameEngineNetworkMessages(NetworkFixture);

function setup() {
    document.body.innerHTML = `
        <div id="trading-house-screen" style="display:flex"></div>
        <div id="trading-sell-slot"></div><div id="trading-inventory-list"></div>
        <div id="trading-house-guidance"></div><p id="trading-selected-name"></p>
        <div id="trading-list-container"></div><div id="trading-my-list"></div>
        <input id="trading-input-bid" value="100"><input id="trading-input-buyout" value="500">
        <input id="trading-input-duration" value="24"><button id="btn-trading-create">List</button>`;
    const item = { id: 'selected', name: 'Selected Ore', stack: 3, rarity: 'RARE' };
    const player = { inventory: [item, null] };
    const chat = jest.fn();
    const ui = new TradingUI({ getLastPlayer: () => player, getItemIconPath: () => '/ore.png',
        getRarityColor: () => '#123456', addChatMessage: chat, hideTooltips: jest.fn() });
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
    expect(ui.ctx.hideTooltips).toHaveBeenCalled();
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

test('listing choices expose item names, quantity and current selection without hover', () => {
    const { ui, player } = setup();
    const choice = document.querySelector('.trading-item-choice');
    expect(choice.tagName).toBe('BUTTON');
    expect(choice.getAttribute('aria-label')).toContain('Quantity 3');
    expect(choice.getAttribute('aria-pressed')).toBe('true');
    expect(choice.querySelector('.trading-item-name').textContent).toBe('Selected Ore');
    expect(document.getElementById('trading-selected-name').textContent).toContain('Quantity 3');
    ui.clearSelection();
    expect(choice.getAttribute('aria-pressed')).toBe('false');
    expect(document.getElementById('trading-selected-name').textContent).toBe('Choose an item below');
    player.inventory[0].name = '<img src=x onerror=alert(1)>';
    ui.updateInventory(player);
    expect(document.querySelector('.trading-item-choice img')).toBeNull();
});

test('auction details expose stats to touch users without changing transaction callbacks', () => {
    const { ui, item } = setup();
    const auction = { id: 'auction', item: { ...item, stats: { strength: 12 }, description: '<b>Ore lore</b>' },
        sellerName: 'Seller', currentBid: 100, buyoutPrice: 500, status: 'SOLD', endTime: Date.now() + 60000 };
    ui.onTradingBuyout = jest.fn();
    ui.onTradingCollect = jest.fn();
    ui.renderAuctionList([auction]);
    ui.renderMyAuctions([auction]);
    for (const details of document.querySelectorAll('.auction-item-details')) {
        expect(details.querySelector('summary').textContent).toBe('Item details');
        expect(details.textContent).toContain('strength: 12');
        expect(details.textContent).toContain('<b>Ore lore</b>');
        expect(details.querySelector('b')).toBeNull();
    }
    document.querySelector('#trading-list-container button:last-child').click();
    expect(ui.onTradingBuyout).toHaveBeenCalledWith('auction');
    document.querySelector('#trading-my-list button').click();
    expect(ui.onTradingCollect).toHaveBeenCalledWith('auction');
});

describe('auction read feedback', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    test('opening sends one search, shows loading and completes a genuinely empty response', () => {
        const { ui } = setup();
        ui.tradingHouseScreen.style.display = 'none';
        ui.onTradingSearch = jest.fn(() => true);
        ui.toggle();
        expect(ui.onTradingSearch).toHaveBeenCalledTimes(1);
        expect(ui.tradingListContainer.getAttribute('aria-busy')).toBe('true');
        expect(ui.readStatus.get('bid').textContent).toContain('Loading');
        ui.renderAuctionList([]);
        expect(ui.tradingListContainer.textContent).toContain('No auctions found');
        expect(ui.tradingListContainer.getAttribute('aria-busy')).toBe('false');
        expect(ui.readStatus.get('bid').hidden).toBe(true);
        expect(jest.getTimerCount()).toBe(0);
    });

    test.each(['offline', 'throws'])('%s read keeps existing rows and permits a successful retry', mode => {
        const { ui, item } = setup();
        ui.renderAuctionList([{ id: 'auction', item, currentBid: 10, buyoutPrice: 20 }]);
        ui.onTradingSearch = jest.fn(() => {
            if (mode === 'throws') throw new Error('closed socket');
            return false;
        });
        ui.handleSearch();
        expect(ui.readStatus.get('bid').textContent).toMatch(/retry/i);
        expect(ui.tradingListContainer.textContent).toContain(item.name);
        expect(jest.getTimerCount()).toBe(0);
        ui.onTradingSearch = () => { ui.renderAuctionList([]); return true; };
        ui.handleSearch();
        expect(ui.readStatus.get('bid').hidden).toBe(true);
        expect(jest.getTimerCount()).toBe(0);
    });

    test('a slow read provides an explicit retry without replaying transactions', () => {
        const { ui } = setup();
        ui.onTradingMyAuctions = jest.fn(() => true);
        ui.switchTab('my');
        jest.advanceTimersByTime(10000);
        expect(ui.readStatus.get('my').textContent).toContain('Select My Auctions to retry');
        expect(ui.onTradingMyAuctions).toHaveBeenCalledTimes(1);
        expect(ui.onTradingCreate).not.toHaveBeenCalled();
        expect(ui.tradingMyList.getAttribute('aria-busy')).toBe('false');
        ui.switchTab('my');
        expect(ui.onTradingMyAuctions).toHaveBeenCalledTimes(2);
        ui.renderMyAuctions([]);
        expect(ui.tradingMyList.textContent).toContain('no active auctions');
        expect(jest.getTimerCount()).toBe(0);
    });

    test('managed-window closure also clears pending reads and listing selection', () => {
        const { ui } = setup();
        ui.onTradingSearch = () => true;
        ui.handleSearch();
        const manager = { trading: ui, windowLayouts: new Map([
            ['trading', { element: ui.tradingHouseScreen }]
        ]), isElementVisible: () => true, playUICue: jest.fn() };
        CharacterUI.prototype.closeManagedWindow.call(manager, 'trading');
        expect(ui.tradingHouseScreen.style.display).toBe('none');
        expect(ui.selectedTradingItem).toBeNull();
        expect(ui.readStatus.get('bid').hidden).toBe(true);
        expect(jest.getTimerCount()).toBe(0);
    });

    test.each(['trading_list', 'trading_my_list'])('%s accepts a server null list as empty, not a stalled read', type => {
        const { ui } = setup();
        const network = new NetworkFixture();
        network.player = { id: 'local' };
        network.uiManager = { trading: ui };
        network.hydrateItem = item => item;
        ui.onTradingSearch = () => true;
        ui.onTradingMyAuctions = () => true;
        if (type === 'trading_list') ui.handleSearch(); else ui.handleMyAuctions();
        network.handleServerMessage({ type, payload: null });
        expect(jest.getTimerCount()).toBe(0);
        expect(type === 'trading_list' ? ui.tradingListContainer.textContent : ui.tradingMyList.textContent)
            .toMatch(/No auctions|no active auctions/);
    });
});
