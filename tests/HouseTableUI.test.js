import { jest } from '@jest/globals';
import { HouseTableUI } from '../src/ui/HouseTableUI.js';

const view = (game = 'roulette', currency = 'gold') => ({
    game, currency, available: true, processing: false, phase: 'betting', roundId: 'round-a', balance: 100,
    minBet: game === 'roulette' && currency === 'ep' ? 1 : 20, maxBet: currency === 'ep' ? 100 : 100000,
    betStep: game === 'roulette' && currency === 'ep' ? 1 : 20, players: [],
    serverNow: new Date().toISOString(), dealAt: new Date(Date.now() + 30000).toISOString(),
    spots: [{ id: 'red', label: 'Red', multiplier: 2 }, { id: 'split:1-2', label: 'Split 1/2', multiplier: 18 }]
});

// Legal saved outside-bet results, with the ball still completing its visual
// landing. Server funding/settlement remains covered by the socket suites.
function rouletteLandingReview(currency = 'gold') {
    const sound = jest.fn(), send = jest.fn(), ui = new HouseTableUI(send, sound);
    const stake = currency === 'ep' ? 1 : 20, tableId = `${currency === 'ep' ? 'vip' : 'public'}-roulette`;
    const own = { playerId:'hero', name:'You', seat:0, wagers:[{spot:'red',amount:stake}], paid:false, payout:0 };
    const state = { ...view('roulette',currency), tableId, tableVersion:'2', phase:'revealing', balance:100-stake,
        revealAt:new Date(Date.now()+6000).toISOString(), players:[own] };
    const presence = { yourSeat:{tableId,seat:0,sessionId:'landing-seat'}, occupants:[{playerId:'hero',name:'You',seat:0,connected:true}] };
    const complete = { ...state, tableVersion:'3', phase:'complete', number:32, balance:100+stake,
        nextRoundAt:new Date(Date.now()+12000).toISOString(), players:[{...own,paid:true,payout:stake*2}] };
    ui.update(state,'hero',presence);
    return { ui, sound, send, complete, presence };
}

test.each(['gold','ep'])('roulette shows a saved %s win after the known ball landing, once across repeated polls', currency=>{
    jest.useFakeTimers(); const f=rouletteLandingReview(currency), {ui,sound,complete,presence}=f;
    try {
        ui.update(complete,'hero',presence); expect(ui.presentation.landing).toBeTruthy();
        expect(ui.celebration.active).toBe(false);
        expect(sound.mock.calls.filter(([cue])=>cue === 'win')).toHaveLength(0);
        jest.advanceTimersByTime(400); ui.update(complete,'hero',presence);
        expect(ui.celebration.active).toBe(false);
        jest.advanceTimersByTime(1250);
        expect(ui.presentation.root.classList.contains('close-up')).toBe(false);
        expect(ui.celebration.active).toBe(true); ui.update(complete,'hero',presence);
        expect(sound.mock.calls.filter(([cue])=>cue === 'win')).toHaveLength(1);
        expect(f.send).not.toHaveBeenCalled();
    } finally {ui.dispose();jest.useRealTimers();}
});

test.each(['gold','ep'])('skipping roulette reveals the saved %s win as soon as its result arrives', currency=>{
    jest.useFakeTimers(); const f=rouletteLandingReview(currency), {ui,sound,complete,presence}=f;
    try {
        ui.presentation.skip.click(); expect(ui.celebration.active).toBe(false);
        expect(sound.mock.calls.filter(([cue])=>cue === 'win')).toHaveLength(0);
        ui.update(complete,'hero',presence);
        expect(ui.presentation.root.classList.contains('close-up')).toBe(false);
        expect(ui.celebration.active).toBe(true); jest.advanceTimersByTime(1800);
        expect(sound.mock.calls.filter(([cue])=>cue === 'win')).toHaveLength(1);
        expect(f.send).not.toHaveBeenCalled();
    } finally {ui.dispose();jest.useRealTimers();}
});

test.each(['gold','ep'])('reduced motion shows the saved %s roulette win without waiting for an animation', currency=>{
    jest.useFakeTimers(); const before=document.documentElement.dataset.reducedMotion;
    document.documentElement.dataset.reducedMotion='true';
    const f=rouletteLandingReview(currency), {ui,sound,complete,presence}=f;
    try {
        ui.update(complete,'hero',presence);
        expect(ui.presentation.root.classList.contains('close-up')).toBe(false);
        expect(ui.celebration.active).toBe(true);
        expect(sound.mock.calls.filter(([cue])=>cue === 'win')).toHaveLength(1);
        expect(f.send).not.toHaveBeenCalled();
    } finally {
        ui.dispose();jest.useRealTimers();
        if(before === undefined) delete document.documentElement.dataset.reducedMotion;
        else document.documentElement.dataset.reducedMotion=before;
    }
});

test.each(['leaving','unavailable','next round'])('roulette suppresses a deferred win after %s', change=>{
    jest.useFakeTimers(); const f=rouletteLandingReview(), {ui,sound,complete,presence}=f;
    try {
        ui.update(complete,'hero',presence); expect(ui.celebration.active).toBe(false);
        if(change === 'leaving') ui.update(null,'hero',presence);
        else if(change === 'unavailable') ui.update({...complete,available:false},'hero',presence);
        else ui.update({...view(),tableId:complete.tableId,tableVersion:'4',roundId:'next-round'},'hero',presence);
        jest.advanceTimersByTime(1800);
        expect(ui.celebration.active).toBe(false);
        expect(sound.mock.calls.filter(([cue])=>cue === 'win')).toHaveLength(0);
        if(change === 'unavailable') {
            ui.update(complete,'hero',presence); expect(ui.celebration.active).toBe(true);
            expect(sound.mock.calls.filter(([cue])=>cue === 'win')).toHaveLength(1);
        }
        expect(f.send).not.toHaveBeenCalled();
    } finally {ui.dispose();jest.useRealTimers();}
});

test.each(['roulette','baccarat'])('%s keeps an earlier wager separate from the new chair occupant', game=>{
    const send=jest.fn(),ui=new HouseTableUI(send);
    try {
        const state={...view(game),phase:'complete',nextRoundAt:new Date(Date.now()+30000).toISOString(),
            players:[{playerId:'old-patron',name:'Old patron',seat:0,wagers:[{spot:game === 'roulette' ? 'red' : 'banker',amount:20}],paid:true,payout:game === 'roulette' ? 40 : 39}]};
        if(game === 'roulette')state.number=32;
        else state.baccarat={player:[2,3],banker:[2,4],playerTotal:7,bankerTotal:8,winner:'banker'};
        ui.update(state,'new-patron',{yourSeat:{seat:0,sessionId:'new-chair-session'},
            occupants:[{playerId:'new-patron',name:'New patron',seat:0,connected:true}]});
        expect(ui.table.seats[0].name.textContent).toBe('New patron · You');
        expect(ui.table.seats[0].status.textContent).toBe('Waiting for next hand');
        expect(ui.table.seats[0].hands.textContent).toContain('Old patron');
        expect(ui.table.seats[0].hands.textContent).toContain('earlier wager');
        expect(ui.table.seats[0].hands.textContent).toContain('20 Gold staked');
        expect(ui.celebration.active).toBe(false);
        expect(send).not.toHaveBeenCalled();
    } finally {ui.dispose();}
});

test.each(['roulette', 'baccarat'].flatMap(game => [undefined, null, {}].map(wagers => [game, wagers])))('%s retains seats without inventing a wager or win from unavailable details (%p)', (game, wagers) => {
    const send = jest.fn(), ui = new HouseTableUI(send), state = view(game);
    try {
        const own = { playerId: 'hero', name: 'Hero', seat: 0, wagers, paid: true, payout: 100 };
        expect(() => ui.update({ ...state, players: [own] }, 'hero')).not.toThrow();
        expect(ui.table.seats[0].hands.textContent).toBe('Wager details unavailable');
        expect(ui.table.seats[0].status.textContent).toBe('Wager details unavailable');
        expect(ui.slip.textContent).toContain('Refresh the table');
        expect(ui.slip.textContent).not.toContain('confirmed');
        expect(ui.summary.textContent).toContain('Wager details unavailable');
        expect(ui.canBet()).toBe(false);
        ui.spotButtons[0].click(); ui.choose(game === 'roulette' ? 'red' : 'banker');
        expect(send).not.toHaveBeenCalled();
        expect(() => ui.update({ ...state, phase: 'complete', players: [own] }, 'hero')).not.toThrow();
        expect(ui.celebrated).toBeUndefined();
        expect(ui.celebration.root.textContent).not.toContain('YOU WON');
        ui.update({ ...state, roundId: 'round-b' }, 'hero');
        expect(ui.canBet()).toBe(true);
    } finally { ui.dispose(); }
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
