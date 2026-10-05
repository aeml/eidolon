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
