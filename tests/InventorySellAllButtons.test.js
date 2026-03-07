import { jest } from '@jest/globals';
import { InventoryUI } from '../src/ui/InventoryUI.js';

function buildInventoryDom() {
    document.body.innerHTML = `
        <div id="inventory-screen"></div>
        <div id="inventory-grid"></div>
        <div id="gold-display"></div>
        <div id="shop-screen"></div>
        <div id="shop-gamble-title"></div>
        <button id="tab-shop-main"></button>
        <button id="tab-shop-buyback"></button>
        <div id="shop-content-main"></div>
        <div id="shop-content-buyback"></div>
        <button id="btn-sell-common"></button>
        <button id="btn-sell-uncommon"></button>
        <button id="btn-sell-rare"></button>
        <button id="btn-close-shop"></button>
        <div id="shop-grid"></div>
        <div id="stash-screen"></div>
        <div id="stash-grid"></div>
        <div id="buyback-grid"></div>
        <div id="stat-tooltip"></div>
        <div id="stat-tooltip-title"></div>
        <div id="stat-tooltip-desc"></div>
        <div id="compare-tooltip"></div>
        <div id="compare-tooltip-title"></div>
        <div id="compare-tooltip-desc"></div>
        <div id="split-stack-window"></div>
        <button id="btn-close-split"></button>
        <div id="split-item-name"></div>
        <input id="split-amount-range" type="range" />
        <input id="split-amount-input" type="number" />
        <button id="btn-confirm-split"></button>
        <button id="btn-cancel-split"></button>
        <div id="character-sheet"><div class="equipment-slots"></div></div>
    `;
}

describe('Inventory sell-all buttons', () => {
    test('forward the expected rarity names to the sell-all handler', () => {
        buildInventoryDom();

        const inventory = new InventoryUI({
            isMobile: false,
            getLastPlayer: () => null,
            getItemIconPath: () => '',
            formatStatName: (key) => key,
            getRarityColor: () => '#fff',
            addChatMessage: jest.fn(),
            updateCharacterSheet: jest.fn()
        });

        inventory.onSellAll = jest.fn();

        document.getElementById('btn-sell-common').click();
        document.getElementById('btn-sell-uncommon').click();
        document.getElementById('btn-sell-rare').click();

        expect(inventory.onSellAll).toHaveBeenNthCalledWith(1, 'Common');
        expect(inventory.onSellAll).toHaveBeenNthCalledWith(2, 'Uncommon');
        expect(inventory.onSellAll).toHaveBeenNthCalledWith(3, 'Rare');
    });

    test('switches between shop and buyback tabs and closes the shop', () => {
        buildInventoryDom();

        const inventory = new InventoryUI({
            isMobile: false,
            getLastPlayer: () => ({ level: 1, inventory: [] }),
            getItemIconPath: () => '',
            formatStatName: (key) => key,
            getRarityColor: () => '#fff',
            addChatMessage: jest.fn(),
            updateCharacterSheet: jest.fn()
        });

        inventory.toggleShop();
        expect(document.getElementById('shop-screen').style.display).toBe('flex');
        expect(document.getElementById('shop-content-main').style.display).toBe('flex');
        expect(document.getElementById('shop-content-buyback').style.display).toBe('none');

        document.getElementById('tab-shop-buyback').click();
        expect(document.getElementById('shop-content-main').style.display).toBe('none');
        expect(document.getElementById('shop-content-buyback').style.display).toBe('flex');

        document.getElementById('tab-shop-main').click();
        expect(document.getElementById('shop-content-main').style.display).toBe('flex');
        expect(document.getElementById('shop-content-buyback').style.display).toBe('none');

        document.getElementById('btn-close-shop').click();
        expect(document.getElementById('shop-screen').style.display).toBe('none');
    });

    test('buyback items invoke the configured callback', () => {
        buildInventoryDom();

        const inventory = new InventoryUI({
            isMobile: false,
            getLastPlayer: () => null,
            getItemIconPath: () => '/icons/legendary.png',
            formatStatName: (key) => key,
            getRarityColor: () => '#fff',
            addChatMessage: jest.fn(),
            updateCharacterSheet: jest.fn()
        });

        inventory.onBuyback = jest.fn();
        inventory.updateBuybackList([{
            id: 'legendary-1',
            name: 'Phoenix Blade',
            value: 125,
            stack: 1,
            rarity: { name: 'Legendary', color: '#ff8000' }
        }]);

        expect(document.getElementById('buyback-grid').children).toHaveLength(1);

        document.getElementById('buyback-grid').children[0].click();
        expect(inventory.onBuyback).toHaveBeenCalledWith('legendary-1');
    });
});
