import { jest } from '@jest/globals';
import { GuildUI } from '../src/ui/GuildUI.js';

function createUI(player = { name: 'Alice', inventory: [{ id: 'blade', name: 'Blade', stack: 1 }] }) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const ui = new GuildUI({ container, getLastPlayer: () => player, addChatMessage: jest.fn() });
    return { ui, container };
}

describe('GuildUI', () => {
    test('creates a guild from validated form inputs', () => {
        const { ui, container } = createUI();
        ui.onCreate = jest.fn();
        container.querySelector('[data-guild-name]').value = 'Night Watch';
        container.querySelector('[data-guild-tag]').value = 'NW';
        container.querySelector('[data-guild-create]').click();
        expect(ui.onCreate).toHaveBeenCalledWith('Night Watch', 'NW');
    });

    test('renders and accepts pending invitations', () => {
        const { ui, container } = createUI();
        ui.onRespond = jest.fn();
        ui.update({ guild: null, invites: [{ guildId: 'g1', guildName: 'Wardens', guildTag: 'WARD' }] });
        expect(container.textContent).toContain('[WARD] Wardens');
        Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Accept').click();
        expect(ui.onRespond).toHaveBeenCalledWith('g1', true);
    });

    test('renders roster permissions and bank actions', () => {
        const { ui, container } = createUI();
        ui.onSetRank = jest.fn();
        ui.onBankDeposit = jest.fn();
        ui.onBankWithdraw = jest.fn();
        ui.update({ guild: {
            id: 'g1', name: 'Wardens', tag: 'WARD', leaderId: 'player-Alice',
            permissions: { invite: true, kick: true, set_rank: true, withdraw_bank: true },
            members: [
                { playerId: 'player-Alice', username: 'Alice', rank: 'leader', online: true, class: 'Fighter', level: 60 },
                { playerId: 'player-Bob', username: 'Bob', rank: 'member', online: false },
            ],
            bank: { gold: 500, items: [{ id: 'stored', name: 'Stored Wand', stack: 1 }] },
            audit: [],
        }});
        expect(container.textContent).toContain('[WARD] Wardens');
        expect(container.textContent).toContain('Bob');
        Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Promote').click();
        expect(ui.onSetRank).toHaveBeenCalledWith('player-Bob', 'officer');
        Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Deposit Item').click();
        expect(ui.onBankDeposit).toHaveBeenCalledWith({ itemId: 'blade' });
        const withdrawButtons = Array.from(container.querySelectorAll('button')).filter(button => button.textContent === 'Withdraw');
        withdrawButtons.at(-1).click();
        expect(ui.onBankWithdraw).toHaveBeenCalledWith({ itemId: 'stored' });
    });

    test('uses text nodes for server-provided identity fields', () => {
        const { ui, container } = createUI();
        ui.update({ guild: {
            id: 'g1', name: '<img src=x onerror=alert(1)>', tag: 'SAFE', leaderId: 'p1',
            permissions: {}, members: [], bank: { gold: 0, items: [] },
        }});
        expect(container.querySelector('img')).toBeNull();
        expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
    });

    test('requests and renders seasonal dungeon records', () => {
        const { ui, container } = createUI();
        ui.onLeaderboard = jest.fn();
        ui.update({ guild: {
            id: 'g1', name: 'Wardens', tag: 'WARD', leaderId: 'p1', permissions: {}, members: [], bank: { gold: 0, items: [] },
        }});
        Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Refresh').click();
        expect(ui.onLeaderboard).toHaveBeenCalledWith({ dungeonType: 'umbral_nexus', difficulty: 'mythic', runLevel: 100 });
        ui.updateLeaderboard({ season: '2026-Q3', runs: [{ guildTag: 'WARD', guildName: 'Wardens', durationMs: 125000, memberCount: 5 }] });
        expect(container.textContent).toContain('2026-Q3');
        expect(container.textContent).toContain('[WARD] Wardens · 2:05 · 5 members');
    });
});
