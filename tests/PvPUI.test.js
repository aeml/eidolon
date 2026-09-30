import { jest } from '@jest/globals';
import { PvPUI } from '../src/ui/PvPUI.js';

const interfaces = [];
afterEach(() => { interfaces.splice(0).forEach(ui => ui.dispose()); });

function createUI() {
    const ui = new PvPUI({ openManagedWindow: jest.fn(), closeManagedWindow: jest.fn() });
    interfaces.push(ui);
    return ui;
}

describe('PvPUI', () => {
    test('distinguishes projected seasonal prize from settled history', () => {
        const ui = createUI();
        ui.update({ profile: { season: '2026-Q4', seasonVictories: 12,
            seasonHistory: [{ season: '2026-Q3', medal: 'Silver', rating: 1250, wins: 30, losses: 10, eligibleWins: 25, honorAwarded: 600 }] },
            seasonReward: { medal: 'Bronze', honor: 250, endsAt: '2027-01-01T00:00:00Z' } });
        const text = ui.window.querySelector('.pvp-card--season').textContent;
        expect(text).toContain('2026-Q4 · 12 eligible ranked wins');
        expect(text).toContain('Bronze · 250 Honor (not awarded yet)');
        expect(text).toContain('2027-01-01 at 00:00 UTC');
        expect(text).toContain('2026-Q3 · Silver · rating 1250 · 30W/10L · 25 eligible wins · 600 Honor settled');
    });
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
    test('opens new duel challenge and responds with exact consent identity', () => {
        const ui = createUI();
        ui.onDuelRespond = jest.fn();
        ui.update({ challenge: { id: 'challenge-1', requesterId: 'player-Alice', expiresAt: new Date(Date.now() + 30000).toISOString() } });
        expect(ui.window.textContent).toContain('Alice challenges you');
        Array.from(ui.window.querySelectorAll('button')).find(button => button.textContent === 'Accept').click();
        expect(ui.onDuelRespond).toHaveBeenCalledWith('player-Alice', 'challenge-1', true);
        expect(ui.openManagedWindow).toHaveBeenCalledWith('pvp');
    });

    test('detached old response cannot accept or decline replacement consent', () => {
        const ui = createUI();
        ui.onDuelRespond = jest.fn();
        ui.onRefresh = jest.fn();
        const challenge = { id: 'first', requesterId: 'player-Alice', expiresAt: new Date(Date.now() + 30000).toISOString() };
        ui.update({ challenge });
        const oldButtons = [...ui.window.querySelectorAll('[data-duel-response]')];
        ui.update({ challenge: { ...challenge, id: 'replacement' } });
        oldButtons.forEach(button => button.click());
        expect(ui.onDuelRespond).not.toHaveBeenCalled();
        expect(ui.state.challenge.id).toBe('replacement');
        expect(ui.onRefresh).toHaveBeenCalledTimes(3);
    });

    test('challenge clock ticks locally, expires exactly, and stops when closed', () => {
        jest.useFakeTimers();
        const ui = createUI();
        const challenge = { id: 'clock', requesterId: 'player-Alice', expiresAt: new Date(Date.now() + 30000).toISOString() };
        ui.update({ challenge });
        expect(ui.window.textContent).toContain('Respond within 30s');
        jest.advanceTimersByTime(1000);
        expect(ui.window.textContent).toContain('Respond within 29s');
        jest.advanceTimersByTime(29000);
        expect(ui.window.textContent).toContain('Challenge expired');
        expect([...ui.window.querySelectorAll('[data-duel-response]')].every(button => button.disabled)).toBe(true);
        ui.update({ challenge: { ...challenge, id: 'next', expiresAt: new Date(Date.now() + 30000).toISOString() } });
        ui.toggle(false);
        expect(jest.getTimerCount()).toBe(0);
        ui.update({ challenge: ui.state.challenge });
        expect(ui.isOpen).toBe(false);
        expect(jest.getTimerCount()).toBe(0);
        ui.dispose();
        jest.useRealTimers();
    });

    test('flag disable is unavailable until safe-zone recovery', () => {
        const ui = createUI();
        ui.onFlag = jest.fn();
        ui.update({ openWorldFlagged: true, inSafeZone: false });
        let disable = [...ui.window.querySelectorAll('button')].find(button => button.textContent === 'Disable World PvP');
        expect(disable.disabled).toBe(true);
        disable.click();
        expect(ui.onFlag).not.toHaveBeenCalled();
        ui.update({ openWorldFlagged: true, inSafeZone: true });
        disable = [...ui.window.querySelectorAll('button')].find(button => button.textContent === 'Disable World PvP');
        disable.click();
        expect(ui.onFlag).toHaveBeenCalledWith(false);
    });

    test('late snapshots and detached consent cannot resurrect a disposed session', () => {
        const ui = createUI();
        const challenge = { id: 'old-session', requesterId: 'player-Alice', expiresAt: new Date(Date.now() + 30000).toISOString() };
        ui.update({ challenge });
        const oldButton = ui.window.querySelector('[data-duel-response]');
        ui.onRefresh = jest.fn(); ui.onDuelRespond = jest.fn();
        ui.openManagedWindow.mockClear();
        ui.dispose();
        oldButton.click();
        ui.update({ challenge: { ...challenge, id: 'late' } });
        ui.toggle(true);
        expect(ui.onDuelRespond).not.toHaveBeenCalled();
        expect(ui.onRefresh).not.toHaveBeenCalled();
        expect(ui.openManagedWindow).not.toHaveBeenCalled();
        expect(ui.window.isConnected).toBe(false);
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
