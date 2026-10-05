import { jest } from '@jest/globals';
import { BlackjackTableUI } from '../src/ui/BlackjackTableUI.js';

const betting = () => ({ available: true, roundId: 'round-one', phase: 'betting', processing: false, gold: 300, players: [] });
const playing = () => ({ ...betting(), phase: 'playing', players: [{ playerId: 'alice', name: 'Alice', seat: 0, bet: 100 }], round: {
    revision: 1, dealer: [9], dealerHidden: true, turnPlayerId: 'alice', turnHand: 0, deadline: new Date(Date.now() + 30000).toISOString(),
    actions: ['hit', 'stand', 'double', 'split'], players: [{ playerId: 'alice', seat: 0, hands: [{ cards: [7, 20], bet: 100 }] }]
} });

test('a delayed lower revision cannot restore an earlier blackjack turn', () => {
    const send = jest.fn(), ui = new BlackjackTableUI(send);
    const newer = playing(); newer.round.revision = 2; newer.round.turnPlayerId = 'bob'; newer.round.actions = [];
    const presence = { yourSeat: { seat: 0, sessionId: 'own-seat' } };
    ui.update(newer, 'alice', presence);
    ui.update(playing(), 'alice', presence); ui.choose('stand');
    expect(ui.view).toBe(newer); expect(send).not.toHaveBeenCalled();
    ui.update(null, 'alice');
});

test.each(['equal revision', 'new hand', 'new seat', 'new player', 'unavailable', 'saving'])(
    'blackjack revision guard preserves %s updates', change => {
        const ui = new BlackjackTableUI(jest.fn()), newer = playing(), incoming = playing();
        newer.round.revision = 2;
        const presence = { yourSeat: { seat: 0, sessionId: 'own-seat' } };
        ui.update(newer, 'alice', presence);
        const nextPresence = { yourSeat: { ...presence.yourSeat } };
        let playerID = 'alice';
        if (change === 'equal revision') incoming.round.revision = 2;
        if (change === 'new hand') incoming.roundId = 'round-two';
        if (change === 'new seat') nextPresence.yourSeat.sessionId = 'new-seat';
        if (change === 'new player') playerID = 'bob';
        if (change === 'unavailable') incoming.available = false;
        if (change === 'saving') incoming.processing = true;
        ui.update(incoming, playerID, nextPresence);
        expect(ui.view).toBe(incoming);
        if (['unavailable', 'saving'].includes(change)) expect(ui.bet.disabled).toBe(true);
        ui.update(null, playerID);
    }
);

test('visible hand counts and saved blackjack win popup show profit without replay', () => {
    jest.useFakeTimers(); const ui = new BlackjackTableUI(jest.fn());
    try {
        const view = playing(); view.round.players[0].hands[0].cards = [10, 3]; ui.update(view, 'alice');
        expect(ui.cards.textContent).toContain('Total: 14'); expect(ui.cards.textContent).toContain('Showing: 10');
        const complete = { ...view, phase: 'complete', round: { ...view.round, phase: 'complete', players: [{ playerId: 'alice', hands: [{ cards: [0,12], bet: 100, payout: 250, outcome: 'blackjack' }] }] } };
        ui.update({ ...complete, processing: true }, 'alice'); expect(ui.celebration.active).toBe(false);
        ui.update(complete, 'alice'); expect(ui.celebration.root.textContent).toContain('+150 Gold'); expect(ui.celebration.root.textContent).toContain('Blackjack');
        jest.advanceTimersByTime(5000); ui.update(complete, 'alice'); expect(ui.celebration.active).toBe(false);
    } finally { ui.update(null); jest.useRealTimers(); }
});

test('advertised high Gold bets remain bounded and require enough Gold', () => {
    const send = jest.fn(), ui = new BlackjackTableUI(send); ui.update({ ...betting(), maxBet: 100000, gold: 100000 }, 'alice');
    ui.stake.value = '100020'; ui.bet.click(); expect(send).not.toHaveBeenCalled();
    ui.stake.value = '100000'; ui.bet.click(); expect(send).toHaveBeenCalledWith({ action: 'bet', roundId: 'round-one', bet: 100000 });
});

test('bet shortcuts change the next round stake, not a pending wager', () => {
    const send = jest.fn(), ui = new BlackjackTableUI(send); ui.update(betting(), 'alice');
    const [half, double] = ui.adjustments.querySelectorAll('button');
    double.click(); expect(ui.stake.value).toBe('200');
    half.click(); expect(ui.stake.value).toBe('100');
    ui.bet.click(); double.click(); expect(ui.stake.value).toBe('100');
    expect(double.disabled).toBe(true);
    ui.update({ ...betting(), roundId: 'round-two' }, 'alice'); double.click(); ui.bet.click();
    expect(send).toHaveBeenLastCalledWith({ action: 'bet', roundId: 'round-two', bet: 200 });
});

test('next wager can be prepared during a hand without changing the confirmed bet or double cost', () => {
    const send = jest.fn(), ui = new BlackjackTableUI(send);
    try {
        const view = playing(); ui.update(view, 'alice');
        expect(ui.betBox.hidden).toBe(false); expect(ui.stake.disabled).toBe(false); expect(ui.bet.disabled).toBe(true);
        ui.adjustments.querySelectorAll('button')[1].click();
        expect(ui.stake.value).toBe('200'); expect(view.players[0].bet).toBe(100);
        ui.bet.click(); expect(send).not.toHaveBeenCalled();
        expect(ui.actions.textContent).toContain('Double · +100 Gold');
        ui.choose('double'); expect(send).toHaveBeenCalledWith({ action: 'play', roundId: 'round-one', roundRevision: 1, gameAction: 'double' });
        ui.update({ ...betting(), roundId: 'round-two' }, 'alice');
        expect(send).toHaveBeenCalledTimes(1); expect(ui.stake.value).toBe('200');
        ui.bet.click(); expect(send).toHaveBeenLastCalledWith({ action: 'bet', roundId: 'round-two', bet: 200 });
    } finally { ui.dispose(); }
});

test('confirmed wagers and completed hands keep preparation visible without automatically betting', () => {
    const send = jest.fn(), ui = new BlackjackTableUI(send);
    try {
        const confirmed = { ...betting(), players: [{ playerId: 'alice', seat: 0, bet: 100 }] };
        ui.update(confirmed, 'alice');
        expect(ui.stakeLabel.textContent).toContain('Next wager (Gold)'); expect(ui.wagerHint.hidden).toBe(false);
        ui.adjustments.querySelectorAll('button')[1].click();
        ui.bet.click(); expect(send).not.toHaveBeenCalled();
        expect(confirmed.players[0].bet).toBe(100); expect(ui.stake.value).toBe('200');
        ui.update({ ...confirmed, phase: 'complete' }, 'alice');
        expect(ui.betBox.hidden).toBe(false); expect(ui.stake.disabled).toBe(false);
        expect(ui.bet.disabled).toBe(true); expect(ui.stake.value).toBe('200');
        ui.update({ ...betting(), roundId: 'round-two' }, 'alice');
        expect(ui.stakeLabel.textContent).toContain('Wager (Gold)'); expect(ui.wagerHint.hidden).toBe(true);
        expect(send).not.toHaveBeenCalled(); ui.bet.click();
        expect(send).toHaveBeenCalledWith({ action: 'bet', roundId: 'round-two', bet: 200 });
    } finally { ui.dispose(); }
});

test('EP stake preparation keeps its currency and disables controls while unavailable or saving', () => {
    const send = jest.fn(), ui = new BlackjackTableUI(send);
    try {
        const ep = { ...playing(), currency: 'ep', balance: 100, minBet: 2, maxBet: 100, betStep: 2 };
        ui.update(ep, 'alice'); expect(ui.stake.value).toBe('2');
        ui.adjustments.querySelectorAll('button')[1].click(); expect(ui.stake.value).toBe('4');
        expect(ui.stakeLabel.textContent).toContain('Next wager (EP)');
        for (const unavailable of [{ ...ep, processing: true }, { ...ep, available: false }]) {
            ui.update(unavailable, 'alice'); expect(ui.stake.disabled).toBe(true); expect(ui.bet.disabled).toBe(true);
            ui.adjustments.querySelectorAll('button')[1].click(); expect(ui.stake.value).toBe('4');
        }
        ui.update({ ...ep, phase: 'betting', players: [], round: undefined, roundId: 'ep-next' }, 'alice');
        expect(send).not.toHaveBeenCalled(); ui.bet.click();
        expect(send).toHaveBeenCalledWith({ action: 'bet', roundId: 'ep-next', bet: 4 });
    } finally { ui.dispose(); }
});

test('one-click wagers respect balance and stay locked across unchanged polls', () => {
    const send = jest.fn(), ui = new BlackjackTableUI(send);
    ui.update(betting(), 'alice'); ui.bet.click(); ui.update(betting(), 'alice'); ui.bet.click();
    expect(send).toHaveBeenCalledWith({ action: 'bet', roundId: 'round-one', bet: 100 });
    expect(send).toHaveBeenCalledTimes(1);
    ui.update({ ...betting(), roundId: 'round-two' }, 'alice');
    ui.stake.value = '500'; ui.bet.click(); expect(ui.summary.textContent).toContain('available balance');
});

test('double/split show the extra Gold and directly submit only once per turn', () => {
    const send = jest.fn(), ui = new BlackjackTableUI(send); ui.update(playing(), 'alice');
    expect(ui.actions.textContent).toContain('Double · +100 Gold'); ui.choose('double');
    expect(send).toHaveBeenCalledWith({ action: 'play', roundId: 'round-one', roundRevision: 1, gameAction: 'double' });
    ui.update(playing(), 'alice'); ui.choose('split'); expect(send).toHaveBeenCalledTimes(1);
    const next = playing(); next.round.revision = 2; next.gold = 10; ui.update(next, 'alice');
    ui.choose('split'); expect(ui.summary.textContent).toContain('Not enough Gold');
});

test('only public cards render; processing disables actions and leaving clears pending state', () => {
    const ui = new BlackjackTableUI(jest.fn()); ui.update(playing(), 'alice');
    expect(ui.root.querySelectorAll('.blackjack-card')).toHaveLength(4);
    expect(ui.root.querySelector('[aria-label="Dealer hidden card"]')).not.toBeNull();
    ui.update({ ...playing(), processing: true }, 'alice');
    expect([...ui.actions.querySelectorAll('button')].every(button => button.disabled)).toBe(true);
    ui.update(playing(), 'alice'); ui.choose('double'); ui.update(null, 'alice');
    expect(ui.root.hidden).toBe(true); expect(ui.pendingKey).toBeNull();
});

test('matching rejection releases controls without rebetting; stale errors do not', () => {
    const send = jest.fn(), ui = new BlackjackTableUI(send); ui.update(betting(), 'alice'); ui.bet.click();
    ui.rejectAction({ action: 'bet', roundId: 'old-round', roundRevision: 0, error: 'old' }); expect(ui.bet.disabled).toBe(true);
    ui.rejectAction({ action: 'bet', roundId: 'round-one', roundRevision: 0, error: 'Not enough Gold' });
    expect(ui.bet.disabled).toBe(false); expect(send).toHaveBeenCalledTimes(1);
});

test('a departed dealt hand stays attributed to its owner when the chair is reused', () => {
    const ui = new BlackjackTableUI(jest.fn());
    const v = playing(); v.players[0].name = '<Alice>';
    ui.update(v, 'observer', { yourSeat: { seat: 3 }, occupants: [
        { playerId: 'new-player', seat: 0, name: 'New patron', connected: true },
        { playerId: 'observer', seat: 3, name: 'Observer', connected: true }
    ] });
    expect(ui.table.seats[0].name.textContent).toBe('New patron');
    expect(ui.table.seats[0].status.textContent).toBe('Waiting for next hand');
    expect(ui.table.seats[0].hands.textContent).toContain('<Alice>’s earlier hand');
    expect(ui.table.seats[0].hands.querySelector('alice')).toBeNull();
    expect(ui.table.seats[0].root.classList.contains('current')).toBe(false);
    expect(ui.actions.children).toHaveLength(0);
    ui.dispose();
});

test('moving to another chair explains that the earlier wager remains at its funded seat', () => {
    const ui = new BlackjackTableUI(jest.fn()), v = playing();
    v.round.actions = [];
    ui.update(v, 'alice', { yourSeat: { seat: 1 }, occupants: [
        { playerId: 'alice', seat: 1, name: 'Alice', connected: true }
    ] });
    expect(ui.summary.textContent).toContain('Watching your earlier wager; return to its seat to act');
    expect(ui.actions.children).toHaveLength(0);
    expect(ui.table.seats[0].hands.textContent).toContain('Your earlier hand');
    ui.dispose();
});

test.each([
    ['blackjack', 250, 'Blackjack · 3:2 profit'], ['win', 200, 'Win · 1:1 profit'],
    ['push', 100, 'Push · stake refund'], ['bust', 0, 'Bust'], ['lose', 0, 'Loss']
])('the %s hand distinguishes a pending payout from saved currency', (outcome, payout, label) => {
    jest.useFakeTimers(); const send = jest.fn(), ui = new BlackjackTableUI(send);
    try {
        const v = playing(); v.phase = 'complete';
        v.round.players[0].hands[0] = { cards: [0, 12], bet: 100, outcome, payout };
        ui.update({ ...v, processing: true }, 'alice');
        expect(ui.table.seats[0].hands.textContent).toContain(`${label} · ${payout} Gold pending return`);
        expect(ui.celebration.active).toBe(false);
        ui.update(v, 'alice');
        expect(ui.table.seats[0].hands.textContent).toContain(`${label} · ${payout} Gold returned`);
        expect(ui.table.seats[0].hands.textContent).not.toContain('pending return');
        expect(ui.celebration.active).toBe(payout > 100);
        expect(send).not.toHaveBeenCalled();
    } finally { ui.dispose(); jest.useRealTimers(); }
});
