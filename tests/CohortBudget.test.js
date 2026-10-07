import { assessCohortBudget } from '../scripts/lib/cohort-budget.mjs';

const counter = (samples, micros) => ({ inFlightKnown: true, completed: samples, failed: 0, timedSamples: samples, totalMicros: micros });
const makeLog = (u = 330000, b = 0, us = 10, bs = 10) => {
    const before = { realtimeUpdate: counter(100, 1000000), stateBroadcast: counter(100, 1000000) };
    const after = { realtimeUpdate: counter(100 + us, 1000000 + u), stateBroadcast: counter(100 + bs, 1000000 + b) };
    return `Cohort phase measurements: stage=0 counters=${JSON.stringify(before)}\nCohort phase measurements: stage=1 counters=${JSON.stringify(after)}\nCohort concurrency coverage: clients=100 common_active_ms=112735\nCohort saved coverage: clients=100 independent_fresh_saves=100 elapsed_ms=390100\n--- PASS: TestLoadCohortActual100MixedRaidEventAndSaves (564.89s)\n`;
};

test('original 33ms bound accepts equality and rejects one excess microsecond', () => {
    expect(assessCohortBudget(makeLog()).phaseBudget.passed).toBe(true);
    expect(assessCohortBudget(makeLog(330001)).phaseBudget.passed).toBe(false);
});

test('separate boundary counts preserve the measured pre-roster budget failure', () => {
    const result = assessCohortBudget(makeLog(38201260, 50657677, 2441, 2440));
    expect(result.phaseBudget.sumOfMeansMs).toBeCloseTo(36.411183262201064, 12);
    expect(result.phaseBudget.passed).toBe(false);
    expect(result.independentFreshSaves).toBe(100);
});

test.each([
    log => log.replace('--- PASS:', '--- FAIL:'),
    log => log.replace('--- PASS:', '--- SKIP:'),
    log => log.replace('--- PASS:', 'PASS:'),
    log => log + '--- PASS: TestLoadCohortActual100MixedRaidEventAndSaves (1s)\n',
    log => log.replace('common_active_ms=112735', 'common_active_ms=107999'),
    log => log.replace('independent_fresh_saves=100', 'independent_fresh_saves=99'),
    log => log + 'Cohort concurrency coverage: malformed\n',
    log => log + 'Cohort saved coverage: malformed\n',
    log => log.replace('stage=1', 'stage=0'),
    log => log.replace('stage=0', 'stage=1'),
    log => log + log.split('\n')[0] + '\n',
    log => log.replace('"inFlightKnown":true', '"inFlightKnown":false'),
    log => log.replace('"timedSamples":100', '"timedSamples":-1'),
    log => log.replace('"totalMicros":1000000', '"totalMicros":9007199254740992'),
    log => log.replace('"totalMicros":1000000', '"totalMicros":"1000000"'),
    log => log.replace('"completed":100', '"completed":99'),
    log => log.replace('"failed":0', '"failed":1'),
    log => log.replace('counters={', 'counters=invalid{'),
    () => '',
    () => makeLog(1000, 1000, 0, 10),
    () => makeLog(-1, 1000),
])('missing, ambiguous, failed or invalid evidence cannot qualify (%#)', mutate => {
    expect(() => assessCohortBudget(mutate(makeLog()))).toThrow();
});

test('within-budget means report scope without fabricated CPU or percentiles', () => {
    const result = assessCohortBudget(makeLog(100000, 200000));
    expect(result.phaseBudget.sumOfMeansMs).toBe(30);
    expect(result.phaseBudget.passed).toBe(true);
    expect(result.scope).toContain('not CPU, paired-frame percentiles');
});
