import { jest } from '@jest/globals';
import { InventoryUI } from '../src/ui/InventoryUI.js';

function buildDom(slotCount = 5) {
    const slots = new Array(slotCount).fill('<div class="inv-slot"></div>').join('');
    document.body.innerHTML = `
        <div id="inventory-screen"></div>
        <div id="inventory-grid">${slots}</div>
        <div id="inventory-guidance"></div>
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
    test('item material colors remain visible while rarity stays on the slot frame', () => {
        buildDom();
        const inventory = createInventory({ inventory: [], equipment: {} });
        const slot = document.querySelector('.inv-slot');
        inventory._applyItemSlotVisual(slot, { name: 'Iron Sword', rarity: { name: 'Rare', color: '#0070dd' } }, '/test-icon.svg');
        expect(slot.style.borderColor).toBe('rgb(0, 112, 221)');
        expect(slot.firstElementChild.style.backgroundImage).toContain('/test-icon.svg');
        expect(slot.firstElementChild.style.backgroundBlendMode).toBe('');
        expect(slot.firstElementChild.style.backgroundColor).toBe('');
    });

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

    test('sort button only requests authoritative sorting and does not mutate local inventory before server response', () => {
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
        const originalInventory = [...player.inventory];
        const inventory = createInventory(player);
        inventory.onSortInventory = jest.fn();

        document.getElementById('btn-sort-inventory').click();

        expect(player.inventory).toEqual(originalInventory);
        expect(inventory.onSortInventory).toHaveBeenCalledTimes(1);
    });

    test('starter inventory guidance explains what to vendor and what to save for the forge', () => {
        buildDom();
        const player = {
            level: 12,
            gold: 80,
            inventory: [
                { id: 'weapon-1', name: 'Iron Sword', type: 'WEAPON', rarity: { name: 'Common', color: '#fff' }, slot: 'mainHand', level: 1, stack: 1 },
                null,
                null,
                null,
                null
            ]
        };
        const inventory = createInventory(player);

        inventory.updateInventory(player);

        expect(document.getElementById('inventory-guidance').textContent).toContain('Compare gear before selling');
        expect(document.getElementById('inventory-guidance').textContent).toContain('Shards raise item level');
        expect(document.getElementById('inventory-guidance').textContent).toContain('Hearts add power and sockets');
        expect(document.getElementById('inventory-guidance').textContent).toContain('Save gems for the Forge');
    });

    test('starter item tooltips explain why shards and gems should be kept', () => {
        buildDom();
        const player = {
            level: 9,
            gold: 0,
            inventory: [],
            equipment: {}
        };
        const inventory = createInventory(player);

        inventory.showItemTooltip({
            id: 'shard-1',
            name: 'Eidolon Shard',
            type: 'MATERIAL',
            rarity: { name: 'Eidolic', color: '#A020F0' },
            slot: 'material',
            level: 1,
            stack: 4,
            stats: {}
        }, 10, 10);
        expect(document.getElementById('stat-tooltip-desc').innerHTML).toContain('Shards are upgrade currency');

        inventory.showItemTooltip({
            id: 'gem-1',
            name: 'Flawed Ruby',
            type: 'GEM',
            rarity: { name: 'Rare', color: '#0070dd' },
            slot: 'gem',
            level: 1,
            stack: 1,
            gemType: 'Ruby',
            gemQuality: 'Flawed',
            stats: { strength: 2 }
        }, 10, 10);
        expect(document.getElementById('stat-tooltip-desc').innerHTML).toContain('Gems are build pieces, not vendor junk');
    });

    test('starter equippable tooltip explains open-slot upgrades and desktop compare hints', () => {
        buildDom();
        const player = {
            level: 12,
            gold: 0,
            inventory: [],
            equipment: {
                mainHand: null,
                offHand: {
                    id: 'offhand-1',
                    name: 'Training Sigil',
                    type: 'OFF_HAND',
                    rarity: { name: 'Common', color: '#fff', multiplier: 1.0 },
                    slot: 'offHand',
                    level: 8,
                    stats: { intelligence: 2 }
                }
            }
        };
        const inventory = createInventory(player);

        inventory.showItemTooltip({
            id: 'weapon-1',
            name: 'Iron Sword',
            type: 'WEAPON',
            rarity: { name: 'Uncommon', color: '#1eff00', multiplier: 1.5 },
            slot: 'mainHand',
            level: 10,
            stack: 1,
            stats: { damage: 5 }
        }, 10, 10);

        expect(document.getElementById('stat-tooltip-desc').innerHTML).toContain('Quick read: open Main Hand');
        expect(document.getElementById('stat-tooltip-desc').innerHTML).toContain('Free equips are usually worth trying immediately');

        inventory.showItemTooltip({
            id: 'offhand-2',
            name: 'Blessed Tome',
            type: 'OFF_HAND',
            rarity: { name: 'Rare', color: '#0070dd', multiplier: 2.0 },
            slot: 'offHand',
            level: 8,
            stack: 1,
            stats: { intelligence: 4 }
        }, 10, 10);

        expect(document.getElementById('stat-tooltip-desc').innerHTML).toContain('Quick read: likely upgrade for Off Hand');
        expect(document.getElementById('stat-tooltip-desc').innerHTML).toContain('Hold Shift to compare with Training Sigil in Off Hand');
    });

    test('ring tooltip compares against the weaker equipped ring slot', () => {
        buildDom();
        const player = {
            level: 16,
            gold: 0,
            inventory: [],
            equipment: {
                ring1: {
                    id: 'ring-1',
                    name: 'Copper Band',
                    type: 'ACCESSORY',
                    rarity: { name: 'Common', color: '#fff', multiplier: 1.0 },
                    slot: 'ring',
                    level: 6,
                    stats: { vitality: 1 }
                },
                ring2: {
                    id: 'ring-2',
                    name: 'Silver Loop',
                    type: 'ACCESSORY',
                    rarity: { name: 'Rare', color: '#0070dd', multiplier: 2.0 },
                    slot: 'ring',
                    level: 12,
                    stats: { vitality: 4 }
                }
            }
        };
        const inventory = createInventory(player);

        inventory.showItemTooltip({
            id: 'ring-3',
            name: 'Bloodsign Ring',
            type: 'ACCESSORY',
            rarity: { name: 'Uncommon', color: '#1eff00', multiplier: 1.5 },
            slot: 'ring',
            level: 11,
            stack: 1,
            stats: { strength: 3 }
        }, 10, 10);

        expect(document.getElementById('stat-tooltip-desc').innerHTML).toContain('likely upgrade for Ring 1');
        expect(document.getElementById('stat-tooltip-desc').innerHTML).toContain('Hold Shift to compare with Copper Band in Ring 1');
    });
});
