import { verifySoakHealth, validateSoakEvidence } from '../scripts/lib/soak-policy.mjs';

const health = { status: 'ok', database: 'ready', commit: 'owned-run', goroutines: 400, heapAllocBytes: 100_000_000 };
const log = 'Load summary: connected=100 joined=100 state_frames=1000 read_errors=0 write_errors=0 decode_errors=0\n' +
    'State coverage: clients=100 min_frames=10 min_active_ms=1000 max_gap_ms=150 wire_bytes=100000\n' +
    'Own state coverage: clients=100 min_updates=1\n' +
    'Admission coverage: authenticated=100 failed=0 max_registration_ms=400 max_login_ms=300 max_join_ms=100\n' +
    'Recovery coverage: clients=100 requested=0 completed=0 pending=0 failed=0';

test('recovery must include fresh town acknowledgement without missing, pending or failed operations', () => {
    const recovered = log.replace('requested=0 completed=0', 'requested=3 completed=3');
    expect(validateSoakEvidence(recovered, [health, health])).toMatchObject({ completedRecoveries: 3 });
    for (const bad of [recovered.replace('requested=3', 'requested=4'),
        recovered.replace('completed=3', 'completed=4'), recovered.replace('pending=0', 'pending=1'),
        recovered.replace('pending=0 failed=0', 'pending=0 failed=1'),
        recovered.replace('Recovery coverage: clients=100', 'Recovery coverage: clients=99'),
        recovered.replace('completed=3', 'completed=9007199254740992'),
        recovered.replace('completed=3', 'completed=3.5'), recovered.replace('pending=0', 'pending=-1'),
        log.replace(/\nRecovery coverage:.*$/, ''), `${log}\nRecovery coverage: incomplete`,
        `${log}\nRecovery coverage: clients=100 requested=0 completed=0 pending=0 failed=0`]) {
        expect(() => validateSoakEvidence(bad, [health, health])).toThrow();
    }
});

test('readiness requires the exact owned run and a ready database', () => {
    expect(verifySoakHealth(health, 'owned-run')).toBe(health);
    for (const wrong of [{ ...health, commit: 'other-job' }, { ...health, status: 'error' },
        { ...health, database: 'unavailable' }, {}]) {
        expect(() => verifySoakHealth(wrong, 'owned-run')).toThrow();
    }
});

test('fresh own updates are separate from cached view frames and required for every client', () => {
    expect(validateSoakEvidence(log, [health, health])).toMatchObject({ minClientFrames: 10, minClientOwnUpdates: 1 });
    for (const bad of [log.replace('Own state coverage: clients=100', 'Own state coverage: clients=99'),
        log.replace('min_updates=1', 'min_updates=0'), log.replace('min_updates=1', 'min_updates=11'),
        log.replace('min_updates=1', 'min_updates=9007199254740992'),
        log.replace('min_updates=1', 'min_updates=1.5'),
        log.replace('Own state coverage: clients=100 min_updates=1\n', ''),
        `${log}\nOwn state coverage: clients=100 min_updates=1`, `${log}\nOwn state coverage: incomplete`]) {
        expect(() => validateSoakEvidence(bad, [health, health])).toThrow();
    }
});

test('100-client coverage and runtime ceilings remain mandatory', () => {
    expect(validateSoakEvidence(log, [health, health])).toMatchObject({ samples: 2, stateFrames: 1000 });
    for (const bad of ['', log.replace('joined=100', 'joined=99'), log.replace('read_errors=0', 'read_errors=1'),
        log.replace('write_errors=0', 'write_errors=1'), log.replace('state_frames=1000', 'state_frames=0')]) {
        expect(() => validateSoakEvidence(bad, [health, health])).toThrow();
    }
    for (const samples of [[health], [health, { ...health, goroutines: 2001 }],
        [health, { ...health, heapAllocBytes: 1610612737 }], [health, { ...health, heapAllocBytes: 700_000_000 }],
        [health, { ...health, goroutines: NaN }], [health, { ...health, goroutines: 1.5 }],
        [health, { ...health, heapAllocBytes: .5 }], [health, { ...health, commit: 'wrong-run' }],
        [health, { ...health, database: 'unavailable' }], [health, null]]) {
        expect(() => validateSoakEvidence(log, samples)).toThrow();
    }
});

test('decode failures, omitted fields and contradictory or duplicate evidence fail closed', () => {
    for (const bad of [log.replace('decode_errors=0', 'decode_errors=1'), log.replace(' decode_errors=0', ''),
        `${log}\n${log}`, `${log}\nLoad summary: incomplete`, `${log}\nState coverage: incomplete`,
        log.replace('clients=100', 'clients=99'), log.replace('min_frames=10', 'min_frames=0'),
        log.replace('min_frames=10', 'min_frames=1'), log.replace('min_frames=10', 'min_frames=11'),
        log.replace('min_active_ms=1000', 'min_active_ms=0'), log.replace('wire_bytes=100000', 'wire_bytes=0'),
        log.replace('state_frames=1000', 'state_frames=9007199254740992'),
        log.replace('max_gap_ms=150', 'max_gap_ms=-1'), log.replace('authenticated=100', 'authenticated=99'),
        log.replace('failed=0', 'failed=1'), log.replace('max_join_ms=100', 'max_join_ms=9007199254740992'),
        `${log}\nAdmission coverage: incomplete`, log.split('\n').slice(0, 2).join('\n')]) {
        expect(() => validateSoakEvidence(bad, [health, health])).toThrow();
    }
});

test('declared duration and rate require coverage from every client, not just aggregate traffic', () => {
    const evidence = log.replace('state_frames=1000', 'state_frames=60000')
        .replace('min_frames=10', 'min_frames=300').replace('min_active_ms=1000', 'min_active_ms=54000');
    const declaration = { durationSeconds: 60, minimumClientStateRate: 5 };
    expect(validateSoakEvidence(evidence, [health, health], declaration)).toMatchObject({
        minClientFrames: 300, minClientActiveMS: 54000, receivedPayloadBytes: 100000, maxClientStateGapMS: 150
    });
    for (const starved of [evidence.replace('min_frames=300', 'min_frames=299'),
        evidence.replace('min_active_ms=54000', 'min_active_ms=53999')]) {
        expect(() => validateSoakEvidence(starved, [health, health], declaration)).toThrow();
    }
    for (const wrong of [{ durationSeconds: 60 }, { minimumClientStateRate: 5 },
        { durationSeconds: Infinity, minimumClientStateRate: 5 }, { durationSeconds: 86401, minimumClientStateRate: 5 },
        { durationSeconds: 60, minimumClientStateRate: -1 }, { durationSeconds: 60, minimumClientStateRate: 61 }]) {
        expect(() => validateSoakEvidence(evidence, [health, health], wrong)).toThrow();
    }
});
