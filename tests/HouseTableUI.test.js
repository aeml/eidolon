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
