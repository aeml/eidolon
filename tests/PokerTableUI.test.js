import { jest } from '@jest/globals';
import { PokerTableUI } from '../src/ui/PokerTableUI.js';

const lobby = () => ({ available: true, processing: false, phase: 'betting', roundId: 'hand-1', gold: 300, players: [] });
const playing = () => ({ ...lobby(), phase: 'playing', players: [{ playerId: 'A', name: '<img src=x>', seat: 0, buyIn: 100 }, { playerId: 'B', name: 'Beryl', seat: 1, buyIn: 200 }], round: {
    revision: 1, phase: 'playing', street: 'flop', board: [0, 9, 10], buttonSeat: 0, turnPlayerId: 'A', deadline: new Date(Date.now() + 30000).toISOString(),
    actions: ['fold', 'call', 'raise', 'all_in'], callAmount: 10, minimumRaiseTo: 30, maximumRaiseTo: 100,
    pots: [{ amount: 30 }], players: [{ playerId: 'A', seat: 0, stack: 90, streetBet: 10, committed: 10, cards: [13, 14] },
        { playerId: 'B', seat: 1, stack: 180, streetBet: 20, committed: 20, cards: [-1, -1] }]
} });

test('a delayed lower revision cannot restore an earlier poker turn', () => {
    const send = jest.fn(), ui = new PokerTableUI(send);
    const newer = playing(); newer.round.revision = 2; newer.round.turnPlayerId = 'B'; newer.round.actions = [];
    const presence = { yourSeat: { seat: 0, sessionId: 'own-seat' } };
    ui.update(newer, 'A', presence);
    ui.update(playing(), 'A', presence); ui.choose('call');
    expect(ui.view).toBe(newer); expect(send).not.toHaveBeenCalled();
    ui.update(null, 'A');
});

test.each(['equal revision', 'new hand', 'new seat', 'new player', 'unavailable', 'saving'])(
    'poker revision guard preserves %s updates', change => {
        const ui = new PokerTableUI(jest.fn()), newer = playing(), incoming = playing();
        newer.round.revision = 2;
        const presence = { yourSeat: { seat: 0, sessionId: 'own-seat' } };
        ui.update(newer, 'A', presence);
        const nextPresence = { yourSeat: { ...presence.yourSeat } };
        let playerID = 'A';
        if (change === 'equal revision') incoming.round.revision = 2;
        if (change === 'new hand') incoming.roundId = 'hand-2';
        if (change === 'new seat') nextPresence.yourSeat.sessionId = 'new-seat';
        if (change === 'new player') playerID = 'B';
        if (change === 'unavailable') incoming.available = false;
        if (change === 'saving') incoming.processing = true;
        ui.update(incoming, playerID, nextPresence);
        expect(ui.view).toBe(incoming);
        ui.update(null, playerID);
    }
);

test('current best hand and settled winner popup do not reveal hidden opponents', () => {
    jest.useFakeTimers(); const ui = new PokerTableUI(jest.fn());
    try {
        const view = playing(); view.round.players[0].bestHand = 'Pair of 2s'; ui.update(view, 'A');
        expect(ui.players.textContent).toContain('Pair of 2s'); expect(ui.root.querySelectorAll('[aria-label="Hidden card"]')).toHaveLength(4);
        const complete = { ...view, phase: 'complete', round: { ...view.round, revision: 2, phase: 'complete', showdown: true,
            pots: [{ amount: 200, winners: ['A'] }], players: [{ ...view.round.players[0], bestHand: 'Full house — 2s full of 3s', payout: 200 }] } };
        ui.update({ ...complete, processing: true }, 'A'); expect(ui.celebration.active).toBe(false);
        ui.update(complete, 'A'); expect(ui.celebration.root.textContent).toContain('200 Gold returned'); expect(ui.celebration.root.textContent).toContain('Net +100 Gold');
        expect(ui.celebration.root.textContent).toContain('Full house');
        jest.advanceTimersByTime(5000); ui.update(complete, 'A'); expect(ui.celebration.active).toBe(false);
    } finally { ui.dispose(); jest.useRealTimers(); }
});

test('high poker buy-ins use advertised limits with integer increments', () => {
    const send = jest.fn(), ui = new PokerTableUI(send); ui.update({ ...lobby(), maxBuyIn: 100000, gold: 100000 }, 'A');
    ui.stake.value = '100100'; ui.buy.click(); expect(send).not.toHaveBeenCalled();
    ui.stake.value = '100000'; ui.buy.click(); expect(send).toHaveBeenCalledWith({ action: 'poker_buy_in', roundId: 'hand-1', bet: 100000 }); ui.dispose();
});

test('buy-in shortcuts change the next hand amount and lock while pending', () => {
    const send = jest.fn(), ui = new PokerTableUI(send); ui.update(lobby(), 'A');
    const [half, double] = ui.lobby.querySelectorAll('.casino-bet-adjustments button');
    double.click(); expect(ui.stake.value).toBe('200');
    half.click(); expect(ui.stake.value).toBe('100');
    ui.buy.click(); double.click(); expect(ui.stake.value).toBe('100');
    ui.update({ ...lobby(), roundId: 'hand-2' }, 'A'); double.click(); ui.buy.click();
    expect(send).toHaveBeenLastCalledWith({ action: 'poker_buy_in', roundId: 'hand-2', bet: 200 });
    ui.dispose();
});

test('poker offers one-click affordable buy-in and suppresses double clicks across polls', () => {
    const send = jest.fn(), ui = new PokerTableUI(send); ui.update(lobby(), 'A'); ui.buy.click();
    ui.update(lobby(), 'A'); ui.buy.click();
    expect(send).toHaveBeenCalledTimes(1); expect(send).toHaveBeenCalledWith({ action: 'poker_buy_in', roundId: 'hand-1', bet: 100 });
    ui.update({ ...lobby(), roundId: 'hand-2' }, 'A'); ui.stake.value = '500'; ui.buy.click(); expect(ui.summary.textContent).toContain('available balance');
    expect(send).toHaveBeenCalledTimes(1);
});

test('poker raise/all-in act directly on the reserved stack and reject stale turns', () => {
    const send = jest.fn(), ui = new PokerTableUI(send); ui.update(playing(), 'A'); ui.raise.value = '50'; ui.choose('raise');
    expect(send).toHaveBeenCalledWith({ action: 'poker_play', roundId: 'hand-1', roundRevision: 1, gameAction: 'raise', bet: 50 });
    ui.update(playing(), 'A'); ui.choose('all_in');
    const next = playing(); next.round.revision = 2; next.round.actions = []; ui.update(next, 'A'); expect(send).toHaveBeenCalledTimes(1);
    ui.choose('call'); expect(send).toHaveBeenCalledTimes(1);
});

test('poker renders only provided cards, escapes names and preserves focus on unchanged polls', () => {
    const ui = new PokerTableUI(jest.fn()); document.body.append(ui.root); const view = playing(); ui.update(view, 'A');
    expect(ui.root.querySelector('img')).toBeNull(); expect(ui.root.textContent).toContain('<img src=x>');
    expect(ui.root.querySelectorAll('[aria-label="Hidden card"]')).toHaveLength(4);
    const input = ui.raise; input.focus(); input.value = '65'; ui.update(view, 'A'); expect(ui.raise).toBe(input); expect(document.activeElement).toBe(input); expect(input.value).toBe('65');
    ui.update({ ...view, processing: true }, 'A'); expect([...ui.root.querySelectorAll('button')].every(b => b.disabled)).toBe(true);
    ui.update(view, 'A'); ui.choose('all_in'); ui.update(null, 'A'); expect(ui.root.hidden).toBe(true); expect(ui.pending).toBe(false); ui.dispose();
});

test('poker waiting state never offers house opponents or a second buy-in', () => {
    const send = jest.fn(), ui = new PokerTableUI(send); ui.update({ ...lobby(), players: [{ playerId: 'A', buyIn: 100 }] }, 'A');
    expect(ui.summary.textContent).toContain('Waiting for another real player'); expect(ui.lobby.hidden).toBe(false); expect(ui.buy.disabled).toBe(true); ui.buyIn();
    ui.update({ ...lobby(), available: false }, 'A'); ui.buyIn(); expect(send).not.toHaveBeenCalled();
});

test('matching rejection releases controls without rebuying; stale errors do not', () => {
    const send = jest.fn(), ui = new PokerTableUI(send); ui.update(lobby(), 'A'); ui.buy.click();
    ui.rejectAction({ action: 'poker_buy_in', roundId: 'old-hand', roundRevision: 0, error: 'old' }); expect(ui.buy.disabled).toBe(true);
    ui.rejectAction({ action: 'poker_buy_in', roundId: 'hand-1', roundRevision: 0, error: 'Not enough Gold' });
    expect(ui.buy.disabled).toBe(false); expect(send).toHaveBeenCalledTimes(1); ui.dispose();
});

test('a reused chair identifies its earlier hand without revealing hidden opponent cards', () => {
    const ui = new PokerTableUI(jest.fn());
    ui.update(playing(), 'A', { yourSeat: { seat: 0 }, occupants: [
        { playerId: 'A', seat: 0, name: 'Alice', connected: true },
        { playerId: 'new-patron', seat: 1, name: 'New patron', connected: true }
    ] });
    expect(ui.table.seats[1].name.textContent).toBe('New patron');
    expect(ui.table.seats[1].hands.textContent).toContain('Beryl’s earlier hand');
    expect(ui.table.seats[1].hands.querySelectorAll('[aria-label="Hidden card"]')).toHaveLength(2);
    expect(ui.table.seats[1].status.textContent).toBe('Waiting for next hand');
    ui.dispose();
});

test('poker hand returns remain pending until all cash-outs are saved', () => {
    jest.useFakeTimers(); const ui = new PokerTableUI(jest.fn());
    try {
        const v = playing(); v.phase = 'settling'; v.round.phase = 'complete';
        v.round.players[0].payout = 200; v.round.pots[0].winners = ['A'];
        ui.update(v, 'A');
        expect(ui.table.seats[0].hands.textContent).toContain('200 Gold pending return');
        expect(ui.celebration.active).toBe(false);
        ui.update({ ...v, phase: 'complete', processing: true }, 'A');
        expect(ui.table.seats[0].hands.textContent).toContain('200 Gold pending return');
        ui.update({ ...v, phase: 'complete' }, 'A');
        expect(ui.table.seats[0].hands.textContent).toContain('200 Gold returned');
        expect(ui.table.seats[0].hands.textContent).not.toContain('pending return');
        expect(ui.celebration.active).toBe(true);
    } finally { ui.dispose(); jest.useRealTimers(); }
});
