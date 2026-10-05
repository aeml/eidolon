import { jest } from '@jest/globals';
import { BlackjackTableUI } from '../src/ui/BlackjackTableUI.js';
import { PokerTableUI } from '../src/ui/PokerTableUI.js';
import { HouseTableUI } from '../src/ui/HouseTableUI.js';
import { isOlderCasinoTableView } from '../src/ui/CasinoTableOrdering.js';

const presence = { yourSeat: { tableId: 'synthetic-table', seat: 0, sessionId: 'synthetic-private-seat' }, occupants: [] };
const betting = {
    tableId: presence.yourSeat.tableId, tableVersion: '9007199254740993', currency: 'gold',
    available: true, processing: false, phase: 'betting', roundId: 'previous-hand', balance: 1000,
    players: [], minBet: 20, maxBet: 100000, betStep: 20, minBuyIn: 100, maxBuyIn: 100000, buyInStep: 100,
    game: 'roulette', spots: [{ id: 'red', label: 'Red', multiplier: 2 }],
    serverNow: new Date().toISOString(), dealAt: new Date(Date.now() + 30000).toISOString()
};

test.each([BlackjackTableUI, PokerTableUI, HouseTableUI])('%p cannot reopen an older lobby across hand transitions or integer precision boundaries', UI => {
    const ui = new UI(jest.fn());
    try {
        const current = { ...betting, tableVersion: '9007199254740994', phase: 'settling', roundId: 'current-hand' };
        ui.update(current, 'hero', presence);
        ui.update(betting, 'hero', presence);
        expect(ui.view).toBe(current);
        expect(ui.view.phase).toBe('settling');
        // Fresh presence is still rendered even when its game snapshot trails.
        const freshPresence = { ...presence, occupants: [{ tableId: presence.yourSeat.tableId, seat: 1, name: 'A visitor', playerId: 'visitor' }] };
        ui.update(betting, 'hero', freshPresence);
        expect(ui.table.seats[1].root.textContent).toContain('A visitor');
    } finally { ui.dispose(); }
});

test.each(['new owner', 'new session', 'new table', 'new seat', 'new currency', 'new game', 'unavailable', 'saving', 'equal version', 'newer version', 'legacy', 'malformed'])(
    'table ordering does not hide %s', scenario => {
        const previous = { ...betting, tableVersion: '21', phase: 'settling' }, incoming = { ...betting, tableVersion: '20' };
        const oldSeat = { ...presence.yourSeat }, seat = { ...oldSeat };
        switch (scenario) {
        case 'new owner': oldSeat.sessionId = ''; break;
        case 'new session': seat.sessionId = 'different-session'; break;
        case 'new table': seat.tableId = incoming.tableId = 'other-table'; break;
        case 'new seat': seat.seat = 1; break;
        case 'new currency': incoming.currency = 'ep'; break;
        case 'new game': incoming.game = 'baccarat'; break;
        case 'unavailable': incoming.available = false; break;
        case 'saving': incoming.processing = true; break;
        case 'equal version': incoming.tableVersion = '21'; break;
        case 'newer version': incoming.tableVersion = '22'; break;
        case 'legacy': delete incoming.tableVersion; break;
        case 'malformed': incoming.tableVersion = '020'; break;
        }
        expect(isOlderCasinoTableView(previous, incoming, oldSeat, seat)).toBe(false);
    });

test.each(['', '0', '-1', '+1', ' 1', '01', '1e2', '1.1', '9223372036854775808', '9'.repeat(200), 1, null])(
    'table versions must be canonical bounded positive int64 strings (%p)', tableVersion => {
        expect(isOlderCasinoTableView({ ...betting, tableVersion: '9223372036854775807' },
            { ...betting, tableVersion }, presence.yourSeat, presence.yourSeat)).toBe(false);
    });

test.each([BlackjackTableUI, PokerTableUI, HouseTableUI])('%p applies a changed player even with an older counter', UI => {
    const ui = new UI(jest.fn());
    try {
        ui.update({ ...betting, tableVersion: '9007199254740994' }, 'hero', presence);
        ui.update(betting, 'other-owner', presence);
        expect(ui.playerID).toBe('other-owner');
        expect(ui.view).toBe(betting);
    } finally { ui.dispose(); }
});
