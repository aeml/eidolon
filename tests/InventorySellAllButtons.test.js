import { jest } from '@jest/globals';
import { InventoryUI } from '../src/ui/InventoryUI.js';

function buildInventoryDom() {
    document.body.innerHTML = `
        <div id="inventory-screen"></div>
        <div id="inventory-grid"></div>
        <div id="gold-display"></div>
        <div id="shop-screen"></div>
        <div id="shop-gamble-title"></div>
        <button id="btn-sell-common"></button>
        <button id="btn-sell-uncommon"></button>
        <button id="btn-sell-rare"></button>
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
});
