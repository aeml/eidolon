import { jest } from '@jest/globals';
import { InventoryUI } from '../src/ui/InventoryUI.js';

function buildDom(slotCount = 5) {
    const slots = new Array(slotCount).fill('<div class="inv-slot"></div>').join('');
    document.body.innerHTML = `
        <div id="inventory-screen"></div>
        <div id="inventory-grid">${slots}</div>
        <button id="btn-sort-inventory"></button>
        <div id="gold-display"></div>
        <div id="shop-screen"></div>
        <div id="shop-gamble-title"></div>
        <div id="shop-content-main"></div>
        <div id="shop-content-buyback"></div>
        <button id="tab-shop-main"></button>
        <button id="tab-shop-buyback"></button>
        <button id="btn-close-shop"></button>
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

function createInventory(player) {
    return new InventoryUI({
        isMobile: false,
        getLastPlayer: () => player,
        getItemIconPath: () => '',
        formatStatName: (key) => key,
        getRarityColor: () => '#fff',
        addChatMessage: jest.fn(),
        updateCharacterSheet: jest.fn()
    });
}

describe('Inventory sorting', () => {
    test('sorts hearts, shards, gems, then items from top left', () => {
        buildDom();
        const player = {
            level: 10,
            gold: 0,
            inventory: [
                { id: 'weapon-1', name: 'Iron Sword', type: 'WEAPON', rarity: { name: 'Common', color: '#fff' }, slot: 'mainHand', level: 1, stack: 1 },
                { id: 'gem-1', name: 'Flawed Ruby', type: 'GEM', rarity: { name: 'Rare', color: '#0070dd' }, slot: 'gem', level: 1, stack: 1, gemType: 'Ruby', gemQuality: 'Flawed' },
                { id: 'heart-1', name: 'Eidolon Heart', type: 'RELIC', rarity: { name: 'Eidolic', color: '#A020F0' }, slot: 'relic', level: 1, stack: 3 },
                null,
                { id: 'shard-1', name: 'Eidolon Shard', type: 'MATERIAL', rarity: { name: 'Eidolic', color: '#A020F0' }, slot: 'material', level: 1, stack: 20 }
            ]
        };
        const inventory = createInventory(player);

        const sorted = inventory.sortInventoryItems(player.inventory);
        expect(sorted.slice(0, 4).map((item) => item?.name)).toEqual([
            'Eidolon Heart',
            'Eidolon Shard',
            'Flawed Ruby',
            'Iron Sword'
        ]);
        expect(sorted[4]).toBeNull();
    });

    test('sort button reorders the player inventory and triggers callback', () => {
        buildDom();
        const player = {
            level: 10,
            gold: 0,
            inventory: [
                { id: 'weapon-1', name: 'Iron Sword', type: 'WEAPON', rarity: { name: 'Common', color: '#fff' }, slot: 'mainHand', level: 1, stack: 1 },
                { id: 'heart-1', name: 'Eidolon Heart', type: 'RELIC', rarity: { name: 'Eidolic', color: '#A020F0' }, slot: 'relic', level: 1, stack: 1 },
                null,
                null,
                null
            ]
        };
        const inventory = createInventory(player);
        inventory.onSortInventory = jest.fn();

        document.getElementById('btn-sort-inventory').click();

        expect(player.inventory[0].name).toBe('Eidolon Heart');
        expect(player.inventory[1].name).toBe('Iron Sword');
        expect(inventory.onSortInventory).toHaveBeenCalled();
    });
});
