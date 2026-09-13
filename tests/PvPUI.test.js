import { jest } from '@jest/globals';
import { PvPUI } from '../src/ui/PvPUI.js';

function createUI() {
    const ui = new PvPUI({ openManagedWindow: jest.fn(), closeManagedWindow: jest.fn() });
    return ui;
}

describe('PvPUI', () => {
    test('shows durable personal and team outcome with exact withheld rewards', () => {
        const ui = createUI();
        ui.update({ profile: { rating: 1016, lastResult: { matchId: 'finished', won: true, forfeit: true,
            teamScore: 1, opponentScore: 0, ratingBefore: 1000, ratingChange: 16, honorAwarded: 0, seasonAwarded: 0,
            reason: 'Forfeit: no Honor or season points.' } } });
        const card = ui.window.querySelector('.pvp-card--result');
        expect(card.textContent).toContain('Victory by forfeit');
        expect(card.textContent).toContain('Your team 1 — 0 opponents');
        expect(card.textContent).toContain('Rating 1000 → 1016 (+16) · +0 Honor · +0 season points');
        expect(card.textContent).toContain('Forfeit: no Honor');
    });
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
        expect(ui.window.textContent).toContain('leaving restores your pre-match amounts');
        ui.onQueue = jest.fn();
        Array.from(ui.window.querySelectorAll('button')).find(button => button.textContent === 'Queue 1v1').click();
        Array.from(ui.window.querySelectorAll('button')).find(button => button.textContent === 'Queue 2v2 Party').click();
        expect(ui.onQueue.mock.calls).toEqual([[1], [2]]);
    });

    test('practice buttons explicitly opt out of ranked play and queue status stays honest', () => {
        const ui = createUI();
        ui.onQueue = jest.fn();
        for (const label of ['Practice 1v1', 'Practice 2v2 Party']) {
            Array.from(ui.window.querySelectorAll('button')).find(button => button.textContent === label).click();
        }
        expect(ui.onQueue.mock.calls).toEqual([[1, true], [2, true]]);
        ui.update({ queued: 2, queuePractice: false, teamRating: 1450, ratingWindow: 250, queuedSeconds: 95 });
        expect(ui.window.textContent).toContain('Ranked 2v2 · waiting 95s');
        expect(ui.window.textContent).toContain('Team rating 1450 · current search ±250');
        ui.update({ queued: 2, queuePractice: true });
        expect(ui.window.textContent).toContain('Waiting for another real practice team');
        ui.update({ queued: 0 });
        expect(ui.state.queuePractice).toBe(false);
        expect(ui.state.ratingWindow).toBeNull();
    });

    test('queue refresh runs only while its window is open and stops on close', () => {
        jest.useFakeTimers();
        const ui = createUI();
        ui.onRefresh = jest.fn();
        ui.toggle(true);
        ui.update({ queued: 1 });
        jest.advanceTimersByTime(5000);
        expect(ui.onRefresh).toHaveBeenCalledTimes(2);
        ui.update({ queued: 1 });
        ui.toggle(false);
        jest.advanceTimersByTime(5000);
        expect(ui.onRefresh).toHaveBeenCalledTimes(2);
        jest.useRealTimers();
    });

    test('renders match score and leaderboard', () => {
        const ui = createUI();
        ui.update({ match: { mode: 'arena_1v1', round: 2, scoreA: 1, scoreB: 0 }, opponents: ['player-Bob'] });
        ui.updateLeaderboard({ season: '2026-Q3', profiles: [{ playerId: 'player-Bob', rating: 1200 }] });
        expect(ui.window.textContent).toContain('ARENA 1V1 · Round 2');
        expect(ui.window.textContent).toContain('1 — 0');
        expect(ui.window.textContent).toContain('Bob · 1200');
    });

    test('does not promise a return or rewards while durable recording is pending', () => {
        const ui = createUI();
        ui.update({ match: { mode: 'arena_2v2', round: 2, scoreA: 2, scoreB: 0, status: 'complete', settlementPending: true } });
        expect(ui.window.textContent).toContain('Saving the ranked result');
        expect(ui.window.textContent).not.toContain('Returning you');
        expect(ui.window.querySelector('.pvp-card--match').textContent).not.toContain('Forfeit');
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
