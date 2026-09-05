import { jest } from '@jest/globals';
import { PvPUI } from '../src/ui/PvPUI.js';

function createUI() {
    const ui = new PvPUI({ openManagedWindow: jest.fn(), closeManagedWindow: jest.fn() });
    return ui;
}

describe('PvPUI', () => {
    test('renders duel challenge and responds with canonical requester ID', () => {
        const ui = createUI();
        ui.onDuelRespond = jest.fn();
        ui.update({ challenge: { requesterId: 'player-Alice' } });
        expect(ui.window.textContent).toContain('Alice challenges you');
        Array.from(ui.window.querySelectorAll('button')).find(button => button.textContent === 'Accept').click();
        expect(ui.onDuelRespond).toHaveBeenCalledWith('player-Alice', true);
    });

    test('queues both supported arena sizes', () => {
        const ui = createUI();
        ui.onQueue = jest.fn();
        Array.from(ui.window.querySelectorAll('button')).find(button => button.textContent === 'Queue 1v1').click();
        Array.from(ui.window.querySelectorAll('button')).find(button => button.textContent === 'Queue 2v2 Party').click();
        expect(ui.onQueue.mock.calls).toEqual([[1], [2]]);
    });

    test('renders match score and leaderboard', () => {
        const ui = createUI();
        ui.update({ match: { mode: 'arena_1v1', round: 2, scoreA: 1, scoreB: 0 }, opponents: ['player-Bob'] });
        ui.updateLeaderboard({ season: '2026-Q3', profiles: [{ playerId: 'player-Bob', rating: 1200 }] });
        expect(ui.window.textContent).toContain('ARENA 1V1 · Round 2');
        expect(ui.window.textContent).toContain('1 — 0');
        expect(ui.window.textContent).toContain('Bob · 1200');
    });

    test('shows remaining teammates, intermission, and clears finished snapshot state', () => {
        const ui = createUI();
        const match = { mode: 'arena_2v2', status: 'active', round: 1, scoreA: 0, scoreB: 0,
            teamA: ['a', 'b'], teamB: ['c', 'd'], eliminated: ['c'] };
        ui.update({ match, challenge: { requesterId: 'old' } });
        expect(ui.window.textContent).toContain('Standing: 2 vs 1');
        expect(ui.window.textContent).toContain('whole opposing team');
        ui.update({ match: { ...match, roundPending: true, scoreA: 1, eliminated: ['c', 'd'] } });
        expect(ui.window.textContent).toContain('next round starts shortly');
        expect(ui.state.challenge).toBeNull();
        ui.update({ match: { ...match, status: 'complete' } });
        expect(ui.window.querySelector('.pvp-card--match').textContent).not.toContain('Forfeit');
        ui.update({ queued: 0, profile: { rating: 1025 } });
        expect(ui.state.match).toBeNull();
        expect(ui.window.querySelector('.pvp-card--match')).toBeNull();
        expect(ui.window.textContent).toContain('Queue 2v2 Party');
        expect(ui.window.textContent).toContain('Practice duels');
    });
});
