import { jest } from '@jest/globals';
import { BlackjackTableUI } from '../src/ui/BlackjackTableUI.js';
import { PokerTableUI } from '../src/ui/PokerTableUI.js';

beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date('2026-09-13T12:00:00Z')); });
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });
const view = () => ({ available: true, processing: false, gold: 1000, roundId: 'one', phase: 'betting', players: [],
    serverNow: '2026-09-13T11:00:00Z', dealAt: '2026-09-13T11:00:30Z' });
const presence = { yourSeat: { seat: 4 }, occupants: [{ playerId: 'me', seat: 4, name: 'Thorn', connected: true },
    { playerId: 'friend', seat: 2, name: 'Mira', connected: true }, { playerId: 'away', seat: 3, name: 'Orin', connected: false }] };

for (const UI of [BlackjackTableUI, PokerTableUI]) describe(UI.name, () => {
    test('persistent dealer, your seat and unfunded occupants survive every phase', () => {
        const ui = new UI(jest.fn()); const v = view(); ui.update(v, 'me', presence);
        const seats = ui.table.seats.map(s => s.root), dealer = ui.table.dealer;
        expect(seats).toHaveLength(6); expect(seats[4].dataset.position).toBe('0');
        expect(seats[4].textContent).toContain('Thorn · You'); expect(seats[2].textContent).toContain('Mira');
        expect(seats[3].textContent).toContain('Reconnecting'); expect(seats[0].textContent).toContain('Open seat');
        for (const phase of ['playing', 'settling', 'complete', 'betting']) {
            ui.update({ ...v, phase, roundId: phase === 'betting' ? 'two' : 'one' }, 'me', presence);
            expect(ui.table.seats.map(s => s.root)).toEqual(seats); expect(ui.table.dealer).toBe(dealer);
            expect(ui.table.root.hidden).toBe(false); expect(dealer.textContent).toContain('House dealer');
        }
        ui.dispose(); expect(jest.getTimerCount()).toBe(0);
    });
    test('countdown ticks every second without polls, ignores local clock skew and never resets on polls', () => {
        const send = jest.fn(), ui = new UI(send), v = view(); ui.update(v, 'me', presence);
        for (const seconds of [30, 29, 28, 27]) {
            expect(ui.table.clockValue.textContent).toBe(`${seconds}s`); jest.advanceTimersByTime(1000);
        }
        ui.update({ ...v, serverNow: '2026-09-13T11:00:04Z' }, 'me', presence);
        expect(ui.table.clockValue.textContent).toBe('26s');
        jest.advanceTimersByTime(26000); expect(ui.table.clockValue.textContent).toBe('0s');
        (ui.bet || ui.buy).click(); expect(send).not.toHaveBeenCalled();
        ui.update({ ...v, phase: 'complete', nextRoundAt: '2026-09-13T11:00:42Z', serverNow: '2026-09-13T11:00:30Z' }, 'me', presence);
        expect(ui.table.clockLabel.textContent).toBe('Next betting window'); expect(ui.table.clockValue.textContent).toBe('12s');
        jest.advanceTimersByTime(2000); expect(ui.table.clockValue.textContent).toBe('10s');
        ui.update(null); expect(jest.getTimerCount()).toBe(0);
    });
});
