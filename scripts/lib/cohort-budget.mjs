// Read only the original full-cohort interval. Lifetime counters, shorter runs,
// combined-only diagnostics and a Go PASS alone cannot qualify this budget.
export function assessCohortBudget(log) {
    const name = 'TestLoadCohortActual100MixedRaidEventAndSaves';
    const terminal = [...log.matchAll(new RegExp(`^--- (PASS|FAIL|SKIP): ${name} \\(`, 'gm'))];
    if (terminal.length !== 1 || terminal[0][1] !== 'PASS') {
        throw new Error('Original full cohort has not passed');
    }
    const common = [...log.matchAll(/Cohort concurrency coverage: clients=100 common_active_ms=(\d+)\r?$/gm)];
    const saves = [...log.matchAll(/Cohort saved coverage: clients=100 independent_fresh_saves=100 elapsed_ms=(\d+)\r?$/gm)];
    if (common.length !== 1 || saves.length !== 1 ||
        log.split('\n').filter(line => line.includes('Cohort concurrency coverage:')).length !== 1 ||
        log.split('\n').filter(line => line.includes('Cohort saved coverage:')).length !== 1 ||
        !Number.isSafeInteger(Number(common[0][1])) || Number(common[0][1]) < 108000 ||
        !Number.isSafeInteger(Number(saves[0][1])) || Number(saves[0][1]) < 1) {
        throw new Error('Original concurrency or independent-save evidence unavailable');
    }
    const label = 'Cohort phase measurements:';
    const rows = log.split('\n').filter(line => line.includes(label));
    if (rows.length !== 2) throw new Error('Original two phase samples unavailable');
    const stages = rows.map((row, index) => {
        const match = row.match(/Cohort phase measurements: stage=([01]) counters=(\{.*\})\r?$/);
        if (!match || Number(match[1]) !== index) throw new Error('Original phase order invalid');
        try { return JSON.parse(match[2]); }
        catch { throw new Error('Original phase counters invalid'); }
    });
    const interval = key => {
        for (const stage of stages) {
            const counter = stage[key];
            if (counter?.inFlightKnown !== true ||
                !['timedSamples', 'totalMicros', 'completed', 'failed'].every(field =>
                    Number.isSafeInteger(counter[field]) && counter[field] >= 0) ||
                counter.timedSamples > counter.completed) {
                throw new Error('Original phase counters invalid');
            }
        }
        const samples = stages[1][key].timedSamples - stages[0][key].timedSamples;
        const micros = stages[1][key].totalMicros - stages[0][key].totalMicros;
        if (samples <= 0 || micros < 0 ||
            stages[1][key].completed - stages[0][key].completed < samples ||
            stages[1][key].failed !== stages[0][key].failed) {
            throw new Error('Original phase interval invalid');
        }
        return { samples, micros, meanMs: micros / samples / 1000 };
    };
    const update = interval('realtimeUpdate'), broadcast = interval('stateBroadcast');
    // Separate boundary counts are valid. Compare exact fractions; do not pair
    // samples, round a failure down, or interpret these means as percentiles.
    const passed = BigInt(update.micros) * BigInt(broadcast.samples) +
        BigInt(broadcast.micros) * BigInt(update.samples) <=
        33000n * BigInt(update.samples) * BigInt(broadcast.samples);
    return {
        functionalPassed: true,
        clients: 100,
        commonActiveMs: Number(common[0][1]),
        independentFreshSaves: 100,
        phaseBudget: { limitMs: 33, update, broadcast, sumOfMeansMs: update.meanMs + broadcast.meanMs, passed },
        scope: 'Original 10s-to-110s elapsed phase means; not CPU, paired-frame percentiles, graphics or launch signoff.'
    };
}
