import { jest } from '@jest/globals';
import { HouseTableUI } from '../src/ui/HouseTableUI.js';

const view = (game = 'roulette', currency = 'gold') => ({
    game, currency, available: true, processing: false, phase: 'betting', roundId: 'round-a', balance: 100,
    minBet: game === 'roulette' && currency === 'ep' ? 1 : 20, maxBet: currency === 'ep' ? 100 : 100000,
    betStep: game === 'roulette' && currency === 'ep' ? 1 : 20, players: [],
    serverNow: new Date().toISOString(), dealAt: new Date(Date.now() + 30000).toISOString(),
    spots: [{ id: 'red', label: 'Red', multiplier: 2 }, { id: 'split:1-2', label: 'Split 1/2', multiplier: 18 }]
});

test.each(['roulette', 'baccarat'])('%s quick bet takes one click and ignores repeated clicks pending confirmation', game => {
    const send = jest.fn(), ui = new HouseTableUI(send), state = view(game, 'ep');
    try {
        ui.update(state, 'hero'); ui.stake.value = '100'; ui.spotButtons[0].click(); ui.spotButtons[0].click();
        expect(send).toHaveBeenCalledTimes(1);
        expect(send).toHaveBeenCalledWith({ action: 'house_bet', roundId: 'round-a', wagers: [{ spot: game === 'roulette' ? 'number:0' : 'player', amount: 100 }] });
        expect(ui.root.textContent).not.toContain('Gold');
        ui.rejectAction({ action: 'house_bet', roundId: 'round-a', error: 'Retry' });
        ui.stake.value = '101'; ui.spotButtons[0].click(); expect(send).toHaveBeenCalledTimes(1);
        ui.stake.value = '20'; ui.spotButtons[0].click(); expect(send).toHaveBeenCalledTimes(2);
    } finally { ui.dispose(); }
});

test('roulette multi-spot builder aggregates chips and enforces the total balance', () => {
    const send = jest.fn(), ui = new HouseTableUI(send);
    try {
        ui.update(view(), 'hero'); ui.builder.checked = true; ui.builder.onchange();
        ui.choose('number:1'); ui.choose('number:1'); ui.choose('red');
        expect(send).not.toHaveBeenCalled(); expect(ui.slip.textContent).toContain('60 Gold total');
        ui.stake.value = '60'; ui.choose('number:2'); expect(ui.slip.textContent).toContain('60 Gold total');
        ui.confirm.click(); expect(send).toHaveBeenCalledWith({ action: 'house_bet', roundId: 'round-a', wagers: [{ spot: 'number:1', amount: 40 }, { spot: 'red', amount: 20 }] });
    } finally { ui.dispose(); }
});

test('table keeps seats/dealer and counts every second without a new server poll', () => {
    jest.useFakeTimers(); const ui = new HouseTableUI(jest.fn()), state = view();
    try {
        ui.update(state, 'hero', { yourSeat: { seat: 2 }, occupants: [{ playerId: 'hero', name: 'Thorn', seat: 2 }] });
        const dealer = ui.table.dealer, seat = ui.table.seats[2].root;
        expect(ui.table.clockValue.textContent).toBe('30s'); jest.advanceTimersByTime(1000);
        expect(ui.table.clockValue.textContent).toBe('29s'); ui.update(state, 'hero');
        expect(ui.table.clockValue.textContent).toBe('29s'); jest.advanceTimersByTime(29000);
        expect(ui.spotButtons[0].disabled).toBe(true);
        const now = new Date().toISOString();
        ui.update({ ...state, phase: 'revealing', serverNow: now, revealAt: new Date(Date.now() + 6000).toISOString() }, 'hero');
        expect(ui.display.classList.contains('revealing')).toBe(true); expect(ui.table.clockValue.textContent).toBe('6s');
        ui.update({ ...state, phase: 'complete', serverNow: now, nextRoundAt: new Date(Date.now() + 12000).toISOString(), number: 7 }, 'hero');
        expect(ui.table.dealer).toBe(dealer); expect(ui.table.seats[2].root).toBe(seat);
        expect(ui.table.clockValue.textContent).toBe('12s'); jest.advanceTimersByTime(1000);
        expect(ui.table.clockValue.textContent).toBe('11s'); expect(ui.display.textContent).toContain('7 · Red');
    } finally { ui.dispose(); jest.useRealTimers(); }
});

test('saved baccarat win shows counts, hand result, amount and next-round stake can change', () => {
    const send = jest.fn(), ui = new HouseTableUI(send), state = view('baccarat');
    try {
        ui.update({ ...state, phase: 'complete', nextRoundAt: new Date(Date.now() + 12000).toISOString(),
            baccarat: { player: [2, 3], banker: [3, 3], playerTotal: 7, bankerTotal: 8, winner: 'banker' },
            players: [{ playerId: 'hero', name: 'Hero', seat: 0, wagers: [{ spot: 'banker', amount: 20 }], paid: true, payout: 39 }] }, 'hero');
        expect(ui.display.textContent).toContain('Player · 7'); expect(ui.display.textContent).toContain('Banker · 8');
        expect(ui.celebration.root.textContent).toContain('+19 Gold'); expect(ui.celebration.root.textContent).toContain('banker wins');
        ui.update({ ...state, roundId: 'round-b' }, 'hero'); ui.stake.value = '40'; ui.choose('banker');
        expect(send).toHaveBeenLastCalledWith({ action: 'house_bet', roundId: 'round-b', wagers: [{ spot: 'banker', amount: 40 }] });
    } finally { ui.dispose(); }
});

test('unavailable-first load recovers full betting options and leaving clears pending/timers', () => {
    const send = jest.fn(() => false), ui = new HouseTableUI(send);
    try {
        ui.update({ ...view(), available: false, spots: [] }, 'hero');
        ui.update(view(), 'hero'); expect(ui.combination.options).toHaveLength(1);
        ui.choose('red'); expect(ui.pending).toBe(false); expect(ui.summary.textContent).toContain('Connection lost');
        ui.update(null); expect(ui.table.interval).toBeNull(); expect(ui.root.hidden).toBe(true);
    } finally { ui.dispose(); }
});

test('disposed house controls cannot wager or restart clocks, including stale updates', () => {
    jest.useFakeTimers(); const send = jest.fn(), ui = new HouseTableUI(send);
    try {
        const state = view(); ui.update(state, 'hero');
        const oldBet = ui.spotButtons[0]; ui.dispose();
        oldBet.click(); ui.choose('red'); ui.placeWagers([{ spot: 'red', amount: 20 }]);
        ui.update({ ...state, roundId: 'late-update' }, 'hero'); oldBet.click();
        expect(send).not.toHaveBeenCalled(); expect(ui.view).toBeNull();
        expect(ui.table.interval).toBeNull(); expect(jest.getTimerCount()).toBe(0);
    } finally { ui.dispose(); jest.useRealTimers(); }
});

test('retired roulette controls cannot become baccarat bets after changing games', () => {
    const send = jest.fn(), ui = new HouseTableUI(send);
    try {
        ui.update(view(), 'hero'); const oldNumber = ui.spotButtons[0], oldCombo = ui.combinationBet;
        ui.update(view('baccarat'), 'hero');
        oldNumber.click(); oldCombo.click(); expect(send).not.toHaveBeenCalled();
        ui.spotButtons[0].click();
        expect(send).toHaveBeenCalledWith({ action: 'house_bet', roundId: 'round-a', wagers: [{ spot: 'player', amount: 20 }] });
    } finally { ui.dispose(); }
});

test('processing results say saving payouts, not saving a new wager', () => {
    const ui = new HouseTableUI(jest.fn());
    try {
        ui.update({ ...view(), phase: 'settling', processing: true }, 'hero');
        expect(ui.summary.textContent).toContain('Saving payouts');
        expect(ui.summary.textContent).not.toContain('Saving wager');
    } finally { ui.dispose(); }
});

test('close and re-open retire the old board but leave current one-click bets working', () => {
    const send = jest.fn(), ui = new HouseTableUI(send), state = view();
    try {
        ui.update(state, 'hero'); const oldBet = ui.spotButtons[0];
        ui.update(null); ui.update(state, 'hero');
        oldBet.click(); expect(send).not.toHaveBeenCalled();
        ui.spotButtons[0].click(); expect(send).toHaveBeenCalledTimes(1);
    } finally { ui.dispose(); }
});

test('same-length catalog replacement retires old combinations without resetting the round clock', () => {
    const send = jest.fn(), ui = new HouseTableUI(send), state = view();
    try {
        ui.update(state, 'hero'); const oldCombo = ui.combinationBet, expires = ui.table.expires;
        ui.update({ ...state, spots: [{ id: 'red', label: 'Red', multiplier: 2 }, { id: 'split:2-3', label: 'Split 2/3', multiplier: 18 }] }, 'hero');
        expect(ui.combination.options[0].textContent).toContain('Split 2/3'); expect(ui.table.expires).toBe(expires);
        oldCombo.click(); expect(send).not.toHaveBeenCalled();
        ui.combinationBet.click();
        expect(send).toHaveBeenCalledWith({ action: 'house_bet', roundId: 'round-a', wagers: [{ spot: 'split:2-3', amount: 20 }] });
    } finally { ui.dispose(); }
});

test('confirmed slips show saved totals and selected spots, not an unconfirmed draft', () => {
    const send = jest.fn(), ui = new HouseTableUI(send), state = view();
    try {
        ui.update(state, 'hero'); ui.builder.checked = true; ui.builder.onchange();
        ui.choose('number:1'); ui.choose('red'); ui.confirm.click();
        const own = { playerId: 'hero', seat: 0, wagers: [{ spot: 'number:1', amount: 20 }, { spot: 'red', amount: 20 }] };
        ui.update({ ...state, players: [own] }, 'hero');
        expect(ui.draft.size).toBe(0); expect(ui.slip.textContent).toContain('40 Gold confirmed');
        expect(ui.slip.textContent).not.toContain('not yet wagered');
        expect(ui.spotButtons.filter(b => b.classList.contains('selected')).map(b => b.dataset.spot)).toEqual(['number:1', 'red']);
        ui.confirm.click(); expect(send).toHaveBeenCalledTimes(1);
        ui.update({ ...state, roundId: 'next-round' }, 'hero');
        expect(ui.spotButtons.some(b => b.classList.contains('selected'))).toBe(false);
        expect(ui.slip.textContent).toContain('not yet wagered');
    } finally { ui.dispose(); }
});

test('catalog changes retire only the unconfirmed slip with a visible explanation', () => {
    const send = jest.fn(), ui = new HouseTableUI(send), state = view();
    try {
        ui.update(state, 'hero'); ui.builder.checked = true; ui.builder.onchange(); ui.choose('red');
        ui.update({ ...state, spots: [{ id: 'black', label: 'Black', multiplier: 2 }] }, 'hero');
        expect(ui.draft.size).toBe(0); expect(ui.confirm.disabled).toBe(true);
        expect(ui.summary.textContent).toContain('Unconfirmed slip cleared');
        ui.confirm.click(); expect(send).not.toHaveBeenCalled();
    } finally { ui.dispose(); }
});
