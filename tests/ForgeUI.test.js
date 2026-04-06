import { jest } from '@jest/globals';
import { ForgeUI } from '../src/ui/ForgeUI.js';

function buildForgeDom() {
    document.body.innerHTML = `
        <div id="forge-screen"></div>
        <div id="forge-potency-info" style="display:none"></div>
        <div id="forge-potency-item-name"></div>
        <div id="forge-potency-stats"></div>
        <div id="forge-potency-cost-value"></div>
        <button id="btn-forge-potency"></button>
        <div id="forge-socket-info" style="display:none"></div>
        <div id="forge-socket-item-name"></div>
        <div id="forge-socket-stats"></div>
        <div id="forge-socket-cost-hearts"></div>
        <div id="forge-socket-cost-shards"></div>
        <button id="btn-forge-socket"></button>
    `;
}

function createForge(player) {
    return new ForgeUI({
        getItemIconPath: () => '',
        formatStatName: (name) => name,
        getLastPlayer: () => player,
        inventoryScreen: { style: { display: 'none' } }
    });
}

describe('ForgeUI resource detection', () => {
    test('counts stacked hearts for potency upgrades', () => {
        buildForgeDom();

        const player = {
            inventory: [{ name: 'Eidolon Heart', stack: 5 }]
        };
        const forge = createForge(player);

        forge.updateForgePotencyInfo({
            name: 'Wizard Staff',
            potency: 2,
            stats: { damage: 20 },
            rarity: { color: '#ffffff' }
        });

        expect(document.getElementById('btn-forge-potency').disabled).toBe(false);
        expect(document.getElementById('forge-potency-cost-value').textContent).toBe('4');
        expect(document.getElementById('forge-potency-stats').innerHTML).toContain('Hearts Available: 5 / 4');
    });

    test('accepts legacy Heart items with implicit stack size of one', () => {
        buildForgeDom();

        const player = {
            inventory: [{ name: 'Heart' }]
        };
        const forge = createForge(player);

        forge.updateForgePotencyInfo({
            name: 'Knight Blade',
            potency: 0,
            stats: { damage: 12 },
            rarity: { color: '#ffffff' }
        });

        expect(document.getElementById('btn-forge-potency').disabled).toBe(false);
        expect(document.getElementById('forge-potency-stats').innerHTML).toContain('Hearts Available: 1 / 1');
    });

    test('shows potency guidance in plain language alongside heart costs', () => {
        buildForgeDom();

        const player = {
            inventory: [{ name: 'Eidolon Heart', stack: 5 }]
        };
        const forge = createForge(player);

        forge.updateForgePotencyInfo({
            name: 'Wizard Staff',
            potency: 2,
            stats: { damage: 20 },
            rarity: { color: '#ffffff' }
        });

        expect(document.getElementById('forge-potency-stats').innerHTML).toContain('Potency permanently boosts this item');
        expect(document.getElementById('forge-potency-stats').innerHTML).toContain('Hearts are the fuel for each rank');
    });

    test('shows socket material counts and blocks upgrades when short', () => {
        buildForgeDom();

        const player = {
            inventory: [
                { name: 'Eidolon Heart', stack: 5 },
                { name: 'Eidolon Shard', stack: 100 }
            ]
        };
        const forge = createForge(player);

        forge.updateForgeSocketInfo({
            name: 'Guardian Shield',
            sockets: 0,
            rarity: { color: '#ffffff' }
        });

        expect(document.getElementById('btn-forge-socket').disabled).toBe(true);
        expect(document.getElementById('forge-socket-stats').innerHTML).toContain('Sockets let this item hold gems');
        expect(document.getElementById('forge-socket-stats').innerHTML).toContain('Opening one costs Hearts and Shards');
        expect(document.getElementById('forge-socket-stats').innerHTML).toContain('Hearts Available: 5 / 25');
        expect(document.getElementById('forge-socket-stats').innerHTML).toContain('Shards Available: 100 / 250');
    });
});
