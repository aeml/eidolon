import { eidolon } from '../src/proto/state_pb.js';

describe('Well Rested network fields', () => {
    test.each([
        [0, ''], [0.001, 'lanternhold'], [123.456789, ''], [7200, 'future-shrine']
    ])('round-trips %s seconds and zone %s', (wellRestedSeconds, safeZoneId) => {
        const encoded = eidolon.state.Entity.encode({ id: 'rested-player', wellRestedSeconds, safeZoneId }).finish();
        const decoded = eidolon.state.Entity.decode(encoded);
        expect(decoded.wellRestedSeconds).toBe(wellRestedSeconds);
        expect(decoded.safeZoneId).toBe(safeZoneId);
    });

    test('older packets default to no active rest and no safe zone', () => {
        const decoded = eidolon.state.Entity.decode(eidolon.state.Entity.encode({ id: 'legacy' }).finish());
        expect(decoded.wellRestedSeconds).toBe(0);
        expect(decoded.safeZoneId).toBe('');
    });
});
