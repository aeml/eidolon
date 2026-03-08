import { jest } from '@jest/globals';
import { InventoryUI } from '../src/ui/InventoryUI.js';
import { LootDrop } from '../src/entities/LootDrop.js';

function buildDom() {
    document.body.innerHTML = `
        <div id="inventory-screen"></div>
        <div id="inventory-grid"></div>
        <button id="btn-sort-inventory"></button>
        <div id="gold-display"></div>
        <div id="shop-screen" style="display:none"></div>
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

function appendInventorySlots(count = 1) {
    const grid = document.getElementById('inventory-grid');
    for (let i = 0; i < count; i++) {
        const slot = document.createElement('div');
        slot.className = 'inv-slot';
        grid.appendChild(slot);
    }
}

describe('Gem presentation', () => {
    test('gem tooltips highlight quality with quality color', () => {
        buildDom();
        const inventory = new InventoryUI({
            isMobile: false,
            getLastPlayer: () => ({ level: 10, equipment: {}, inventory: [] }),
            getItemIconPath: () => '',
            formatStatName: (key) => key,
            getRarityColor: () => '#fff',
            addChatMessage: jest.fn(),
            updateCharacterSheet: jest.fn()
        });

        inventory.showItemTooltip({
            name: 'Radiant Ruby',
            type: 'GEM',
            rarity: { name: 'Rare', color: '#0070dd' },
            slot: 'gem',
            level: 1,
            gemType: 'Ruby',
            gemQuality: 'Radiant',
            stats: { strength: 400, fireDamage: 40 }
        }, 0, 0);

        expect(document.getElementById('stat-tooltip-title').style.color).toBe('rgb(255, 140, 255)');
        expect(document.getElementById('stat-tooltip-desc').innerHTML).toContain('Radiant');
        expect(document.getElementById('stat-tooltip-desc').innerHTML).toContain('#ff8cff');
    });

    test('inventory gem slots glow with quality color', () => {
        buildDom();
        appendInventorySlots();

        const inventory = new InventoryUI({
            isMobile: false,
            getLastPlayer: () => ({ level: 10, equipment: {}, inventory: [] }),
            getItemIconPath: () => '/icons/radiant_ruby.svg',
            formatStatName: (key) => key,
            getRarityColor: () => '#fff',
            addChatMessage: jest.fn(),
            updateCharacterSheet: jest.fn()
        });

        inventory.updateInventory({
            level: 10,
            gold: 0,
            inventory: [{
                id: 'gem-1',
                name: 'Radiant Ruby',
                type: 'GEM',
                rarity: { name: 'Rare', color: '#0070dd' },
                slot: 'gem',
                level: 1,
                gemType: 'Ruby',
                gemQuality: 'Radiant',
                stack: 3,
                potency: 2,
                sockets: 2,
                stats: { strength: 400, fireDamage: 40 }
            }]
        });

        const slot = document.getElementById('inventory-grid').children[0];
        expect(slot.style.border).toBe('2px solid rgb(255, 140, 255)');
        expect(slot.style.boxShadow).toBe('0 0 10px #ff8cff');
        expect(slot.style.backgroundColor).toBe('rgba(255, 255, 255, 0.08)');
        expect(slot.innerHTML).toContain('linear-gradient');
        expect(slot.innerHTML).toContain('rgba(8,12,18,0.85)');
        expect(slot.innerHTML).toContain('+2');
        expect(slot.innerHTML).toContain('>3<');
        expect(slot.innerHTML).toContain('background-color:#ff8cff');
    });

    test('loot labels use gem quality color treatment', () => {
        const drop = new LootDrop({
            name: 'Flawless Sapphire',
            type: 'GEM',
            gemType: 'Sapphire',
            gemQuality: 'Flawless',
            rarity: { name: 'Rare', color: '#0070dd' }
        }, 0, 0, 'loot-gem');

        expect(drop.itemColor).toBe('#ffd54f');
        drop.dispose();
    });
});
