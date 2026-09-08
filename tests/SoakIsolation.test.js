import { verifySoakHealth, validateSoakEvidence } from '../scripts/lib/soak-policy.mjs';

const health = { status: 'ok', database: 'ready', commit: 'owned-run', goroutines: 400, heapAllocBytes: 100_000_000 };
const log = 'Load summary: connected=100 joined=100 state_frames=1000 read_errors=0 write_errors=0';

test('readiness requires the exact owned run and a ready database', () => {
    expect(verifySoakHealth(health, 'owned-run')).toBe(health);
    for (const wrong of [{ ...health, commit: 'other-job' }, { ...health, status: 'error' },
        { ...health, database: 'unavailable' }, {}]) {
        expect(() => verifySoakHealth(wrong, 'owned-run')).toThrow();
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
        [health, { ...health, goroutines: NaN }]]) {
        expect(() => validateSoakEvidence(log, samples)).toThrow();
    }
});
