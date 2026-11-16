// Persistent table counters survive hand transitions. Keep them as bounded
// decimal strings: native int64 versions can exceed JavaScript's exact numbers.
const validVersion = value => typeof value === 'string' && /^[1-9][0-9]{0,18}$/.test(value) &&
    (value.length < 19 || value <= '9223372036854775807');

export function isOlderCasinoTableView(previous, incoming, previousSeat, seat) {
    if (!previous?.available || !incoming?.available || incoming.processing ||
        !previousSeat?.sessionId || previousSeat.sessionId !== seat?.sessionId ||
        previousSeat.tableId !== seat.tableId || previousSeat.seat !== seat.seat ||
        !incoming.tableId || incoming.tableId !== seat.tableId || previous.tableId !== incoming.tableId ||
        previous.currency !== incoming.currency || previous.game !== incoming.game ||
        !validVersion(previous.tableVersion) || !validVersion(incoming.tableVersion)) return false;
    return incoming.tableVersion.length < previous.tableVersion.length ||
        (incoming.tableVersion.length === previous.tableVersion.length && incoming.tableVersion < previous.tableVersion);
}

// One owner/seat's highest validated table counter, not hand/card/wallet history.
// Failure feedback remains visible but cannot erase the ordering fence.
export class CasinoTableOrdering {
    reset() { this.highest = null; this.seat = null; this.playerID = null; }

    accept(view, playerID, seat) {
        if (!view || !seat?.sessionId) { this.reset(); return true; }
        if (this.playerID !== playerID || this.seat?.sessionId !== seat.sessionId ||
            this.seat?.tableId !== seat.tableId || this.seat?.seat !== seat.seat ||
            this.highest && (view.currency != null && view.currency !== this.highest.currency ||
                view.game != null && view.game !== this.highest.game)) this.reset();
        this.playerID = playerID;
        this.seat = { sessionId: seat.sessionId, tableId: seat.tableId, seat: seat.seat };
        if (!['betting', 'playing', 'revealing', 'settling', 'complete'].includes(view.phase)) return true;
        if (isOlderCasinoTableView(this.highest, view, this.seat, seat)) return false;
        if (view.available && view.tableId === seat.tableId && ['gold', 'ep'].includes(view.currency) && validVersion(view.tableVersion)) {
            const counter = { available: true, tableId: view.tableId, tableVersion: view.tableVersion, currency: view.currency, game: view.game };
            // Saving feedback can advance, but never lower, the counter.
            if (!isOlderCasinoTableView(this.highest, counter, this.seat, seat)) this.highest = counter;
        }
        return true;
    }
}
