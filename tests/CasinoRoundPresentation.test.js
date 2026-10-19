import { jest } from '@jest/globals';
import { RoulettePresentation, rouletteOrder, rouletteLanding } from '../src/ui/RoulettePresentation.js';
import { BaccaratPresentation } from '../src/ui/BaccaratPresentation.js';
import { HouseTableUI } from '../src/ui/HouseTableUI.js';
import { HouseHistory } from '../src/ui/HouseHistory.js';
import { casinoCard } from '../src/ui/CasinoCard.js';
import { CardTableScene } from '../src/ui/CardTableScene.js';

const state = (extra = {}) => ({ tableId: 'public-roulette', tableVersion: '1', game: 'roulette', currency: 'gold',
    phase: 'betting', available: true, balance: 1000, minBet: 20, maxBet: 100000, betStep: 20, roundId: 'r1',
    players: [], serverNow: new Date().toISOString(), dealAt: new Date(Date.now() + 30000).toISOString(), ...extra });
afterEach(() => { delete document.documentElement.dataset.reducedMotion; jest.useRealTimers(); });

test('shared card faces expose one accessible identity and never draw hidden values', () => {
    for (let value = 0; value < 52; value++) {
        const card = casinoCard(value);
        expect(card.getAttribute('role')).toBe('img');
        expect(card.querySelector('.casino-card-index').textContent).toBe(card.getAttribute('aria-label'));
        expect(card.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2);
    }
    for (const value of [-1, null, undefined, 52, 1.5]) {
        const card = casinoCard(value);
        expect(card.textContent).toBe('✦'); expect(card.getAttribute('aria-label')).toBe('Hidden card');
        expect(card.querySelector('.casino-card-index')).toBeNull();
    }
});

test('every server-confirmed pocket lands at its actual European wheel position', () => {
    expect(new Set(rouletteOrder).size).toBe(37);
    for (const wheel of [0, -846, 3911]) for (const number of rouletteOrder) {
        const angle = rouletteLanding(wheel, number);
        expect((angle - wheel - rouletteOrder.indexOf(number) * 360 / 37 + 36000) % 360).toBeCloseTo(0, 7);
    }
});

test('roulette launches a visible ball, zooms, bounces then lands on the confirmed pocket without replaying duplicate polls', () => {
    jest.useFakeTimers(); const root = document.createElement('div'), ui = new RoulettePresentation(root);
    try {
        ui.update(state(), 'table:gold:r1');
        expect(ui.ball.hidden).toBe(true);
        const spinning = state({ phase: 'revealing', revealAt: new Date(Date.now() + 6000).toISOString() });
        ui.update(spinning, 'table:gold:r1');
        expect(ui.root.classList.contains('close-up')).toBe(true); expect(ui.ball.hidden).toBe(false);
        jest.advanceTimersByTime(2000); const orbit = ui.ballAngle;
        expect(orbit).toBeGreaterThan(0);
        ui.update({ ...spinning, phase: 'settling', number: 32 }, 'table:gold:r1');
        const landing = ui.landing; ui.update({ ...spinning, phase: 'complete', number: 32 }, 'table:gold:r1');
        expect(ui.landing).toBe(landing);
        jest.advanceTimersByTime(1800);
        expect(ui.frame).toBeNull(); expect(ui.root.classList.contains('close-up')).toBe(false);
        expect(ui.ballAngle).toBeCloseTo(rouletteLanding(ui.wheelAngle, 32));
        expect(ui.label.textContent).toBe('32 · Red');
        ui.update({ ...spinning, phase: 'complete', number: 32 }, 'table:gold:r1'); expect(ui.frame).toBeNull();
    } finally { ui.dispose(); }
    expect(jest.getTimerCount()).toBe(0);
});

test('roulette skips motion without inventing an unknown result; reduced motion and reopened results snap directly', () => {
    jest.useFakeTimers(); const ui = new RoulettePresentation(document.createElement('div'));
    try {
        ui.update(state({ phase: 'revealing' }), 'round'); ui.skip.click();
        expect(ui.number).toBeNull(); expect(ui.label.textContent).toContain('bets closed'); expect(ui.frame).toBeNull();
        ui.update(state({ phase: 'complete', number: 0 }), 'round');
        expect(ui.ballAngle).toBeCloseTo(rouletteLanding(ui.wheelAngle, 0));
        ui.clear(); document.documentElement.dataset.reducedMotion = 'true';
        ui.update(state({ phase: 'revealing' }), 'another-round'); expect(ui.frame).toBeNull();
        ui.update(state({ phase: 'complete', number: 26 }), 'another-round');
        expect(ui.ballAngle).toBeCloseTo(rouletteLanding(ui.wheelAngle, 26));
    } finally { ui.dispose(); }
    expect(jest.getTimerCount()).toBe(0);
});

test('baccarat counts only dealt cards and never retracts them on older equal-version projections', () => {
    const ui = new BaccaratPresentation(document.createElement('div'));
    try {
        ui.update(state({ game: 'baccarat', phase: 'revealing', dealt: { player: [0], banker: [] } }), 'r1');
        expect(ui.hands.player.title.textContent).toBe('Player · 1'); expect(ui.hands.banker.title.textContent).toBe('Banker');
        expect(ui.root.textContent).not.toContain('wins');
        ui.update(state({ dealt: { player: [0, 8], banker: [12, 3] }, phase: 'revealing' }), 'r1');
        expect(ui.hands.player.title.textContent).toBe('Player · 0'); expect(ui.hands.banker.title.textContent).toBe('Banker · 4');
        ui.update(state({ dealt: { player: [0], banker: [] }, phase: 'revealing' }), 'r1');
        expect(ui.hands.player.cards.querySelectorAll('[data-card]')).toHaveLength(2);
        ui.update(state({ baccarat: { player: [0, 8], banker: [12, 3, 3], winner: 'banker' } }), 'r1');
        expect(ui.hands.banker.title.textContent).toBe('Banker · 8'); expect(ui.status.textContent).toBe('banker wins');
        ui.update(state({ phase: 'betting' }), 'r2'); expect(ui.root.querySelectorAll('[data-card]')).toHaveLength(0);
    } finally { ui.dispose(); }
});

test('history comes from the current server table and currency; switching clears previous results', () => {
    const ui = new HouseHistory(document.createElement('div'));
    ui.update(state({ history: [{ roundId: 'a', number: 7 }, { roundId: 'b', number: 0 }] }));
    expect([...ui.list.children].map(n => n.textContent)).toEqual(['7', '0']);
    expect(ui.list.children[0].getAttribute('aria-label')).toBe('7 red');
    ui.update(state({ tableId: 'vip-baccarat', currency: 'ep', game: 'baccarat', history: [] }));
    expect(ui.list.children).toHaveLength(0); expect(ui.empty.hidden).toBe(false);
});

test('chips and undo edit only drafts; reuse needs explicit confirmation and never spends on round transition', () => {
    const send = jest.fn(), ui = new HouseTableUI(send);
    try {
        ui.update(state(), 'hero'); ui.builder.checked = true; ui.builder.onchange();
        ui.choose('number:1'); ui.choose('number:1'); ui.choose('number:2'); ui.undo.click();
        expect(ui.draftWagers()).toEqual([{ spot: 'number:1', amount: 40 }]);
        ui.confirm.click(); expect(send).toHaveBeenCalledTimes(1);
        const own = { playerId: 'hero', seat: 0, wagers: [{ spot: 'number:1', amount: 40 }] };
        ui.update(state({ tableVersion: '2', players: [own] }), 'hero');
        ui.update(state({ tableVersion: '3', roundId: 'r2' }), 'hero');
        expect(send).toHaveBeenCalledTimes(1); ui.repeat.click(); expect(send).toHaveBeenCalledTimes(1);
        expect(ui.slip.textContent).toContain('not yet wagered'); ui.confirm.click();
        expect(send).toHaveBeenLastCalledWith({ action: 'house_bet', roundId: 'r2', wagers: [{ spot: 'number:1', amount: 40 }] });
        ui.update(state({ tableVersion: '4', roundId: 'r3', tableId: 'vip-roulette', currency: 'ep' }), 'hero');
        expect(ui.repeat.hidden).toBe(true);
    } finally { ui.dispose(); }
});

test('leaving or changing currency retires roulette animation and outstanding old controls', () => {
    jest.useFakeTimers(); const send = jest.fn(), ui = new HouseTableUI(send);
    ui.update(state({ phase: 'revealing' }), 'hero'); const motion = ui.presentation;
    expect(motion.frame).not.toBeNull(); ui.update(null); expect(motion.frame).toBeNull();
    ui.dispose(); jest.advanceTimersByTime(10000); expect(send).not.toHaveBeenCalled(); expect(jest.getTimerCount()).toBe(0);
});


test('table motion marks only new visible cards, without replaying old hands or exposing backs', () => {
    const table = new CardTableScene('poker');
    try {
        table.update(state({ phase: 'playing' }), 'hero');
        expect(table.decorateCard(casinoCard(7), 'hero:0:7').classList.contains('casino-card-arriving')).toBe(false);
        table.update(state({ phase: 'playing' }), 'hero');
        expect(table.decorateCard(casinoCard(7), 'hero:0:7').classList.contains('casino-card-arriving')).toBe(false);
        expect(table.decorateCard(casinoCard(8), 'board:0:8').classList.contains('casino-card-arriving')).toBe(true);
        expect(table.decorateCard(casinoCard(-1), 'guest:0:hidden').classList.contains('casino-card-arriving')).toBe(false);
        document.documentElement.dataset.reducedMotion = 'true';
        expect(table.decorateCard(casinoCard(9), 'board:1:9').classList.contains('casino-card-arriving')).toBe(false);
        table.clear(); table.update(state({ phase: 'playing' }), 'hero');
        expect(table.decorateCard(casinoCard(8), 'board:0:8').classList.contains('casino-card-arriving')).toBe(false);
    } finally { table.clear(); }
});
