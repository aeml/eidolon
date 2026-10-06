export function verifySoakHealth(sample, expectedCommit) {
    if (sample?.status !== 'ok' || sample.database !== 'ready' || sample.commit !== expectedCommit) {
        throw new Error('Soak endpoint is not the healthy build started by this run');
    }
    return sample;
}

export function validateSoakEvidence(log, samples, { durationSeconds = 0, minimumClientStateRate = 0 } = {}) {
    if (!Number.isFinite(durationSeconds) || durationSeconds < 0 || durationSeconds > 86400 ||
        !Number.isFinite(minimumClientStateRate) || minimumClientStateRate < 0 || minimumClientStateRate > 60 ||
        (durationSeconds === 0) !== (minimumClientStateRate === 0)) throw new Error('Invalid declared soak coverage');
    const summaries = [...log.matchAll(/Load summary: connected=(\d+) joined=(\d+) state_frames=(\d+) read_errors=(\d+) write_errors=(\d+) decode_errors=(\d+)\r?$/gm)];
    const summary = summaries[0];
    if (summaries.length !== 1 || log.split('\n').filter(line => line.includes('Load summary:')).length !== 1 ||
        !summary.slice(1).every(value => Number.isSafeInteger(Number(value))) ||
        Number(summary[1]) !== 100 || Number(summary[2]) !== 100 || Number(summary[3]) < 1 ||
        Number(summary[4]) !== 0 || Number(summary[5]) !== 0 || Number(summary[6]) !== 0) throw new Error('100-client soak summary failed');
    const coverages = [...log.matchAll(/State coverage: clients=(\d+) min_frames=(\d+) min_active_ms=(\d+) max_gap_ms=(\d+) wire_bytes=(\d+)\r?$/gm)];
    const coverage = coverages[0];
    if (coverages.length !== 1 || log.split('\n').filter(line => line.includes('State coverage:')).length !== 1 ||
        !coverage.slice(1).every(value => Number.isSafeInteger(Number(value))) ||
        Number(coverage[1]) !== 100 || Number(coverage[2]) < 2 || Number(coverage[3]) < 1 || Number(coverage[5]) < 1 ||
        Number(coverage[2]) > Math.floor(Number(summary[3]) / 100) ||
        durationSeconds > 0 && (Number(coverage[2]) < Math.ceil(durationSeconds * minimumClientStateRate) ||
            Number(coverage[3]) < durationSeconds * 1000 * .9)) throw new Error('Per-client soak coverage failed');
    const admissions = [...log.matchAll(/Admission coverage: authenticated=(\d+) failed=(\d+) max_registration_ms=(\d+) max_login_ms=(\d+) max_join_ms=(\d+)\r?$/gm)];
    const admission = admissions[0];
    if (admissions.length !== 1 || log.split('\n').filter(line => line.includes('Admission coverage:')).length !== 1 ||
        !admission.slice(1).every(value => Number.isSafeInteger(Number(value))) ||
        Number(admission[1]) !== 100 || Number(admission[2]) !== 0) throw new Error('Acknowledged soak admission failed');
    const ownCoverages = [...log.matchAll(/Own state coverage: clients=(\d+) min_updates=(\d+)\r?$/gm)];
    const ownCoverage = ownCoverages[0];
    if (ownCoverages.length !== 1 || log.split('\n').filter(line => line.includes('Own state coverage:')).length !== 1 ||
        !ownCoverage.slice(1).every(value => Number.isSafeInteger(Number(value))) ||
        Number(ownCoverage[1]) !== 100 || Number(ownCoverage[2]) < 1 ||
        Number(ownCoverage[2]) > Number(coverage[2])) throw new Error('Fresh own-state soak coverage failed');
    const recoveries = [...log.matchAll(/Recovery coverage: clients=(\d+) requested=(\d+) completed=(\d+) pending=(\d+) failed=(\d+)\r?$/gm)];
    const recovery = recoveries[0];
    if (recoveries.length !== 1 || log.split('\n').filter(line => line.includes('Recovery coverage:')).length !== 1 ||
        !recovery.slice(1).every(value => Number.isSafeInteger(Number(value))) ||
        Number(recovery[1]) !== 100 || Number(recovery[2]) !== Number(recovery[3]) ||
        Number(recovery[4]) !== 0 || Number(recovery[5]) !== 0) throw new Error('Acknowledged town recovery failed');
    if (samples.length < 2) throw new Error('Insufficient runtime samples');
    if (samples.some(sample => sample?.status !== 'ok' || sample.database !== 'ready' ||
        typeof sample.commit !== 'string' || !sample.commit || sample.commit !== samples[0].commit ||
        !Number.isSafeInteger(sample.goroutines) || sample.goroutines < 1 ||
        !Number.isSafeInteger(sample.heapAllocBytes) || sample.heapAllocBytes < 0)) throw new Error('Invalid runtime sample');
    const maxGoroutines = Math.max(...samples.map(sample => sample.goroutines));
    const maxHeap = Math.max(...samples.map(sample => sample.heapAllocBytes));
    const growth = samples.at(-1).heapAllocBytes - samples[0].heapAllocBytes;
    if (maxGoroutines > 2000) throw new Error(`Goroutine ceiling exceeded: ${maxGoroutines}`);
    if (maxHeap > 1610612736) throw new Error(`Heap ceiling exceeded: ${maxHeap}`);
    if (growth > 536870912) throw new Error(`Heap growth exceeded: ${growth}`);
    return { samples: samples.length, maxGoroutines, maxHeap, growth, stateFrames: Number(summary[3]),
        minClientFrames: Number(coverage[2]), minClientActiveMS: Number(coverage[3]),
        maxClientStateGapMS: Number(coverage[4]), receivedPayloadBytes: Number(coverage[5]),
        minClientOwnUpdates: Number(ownCoverage[2]),
        completedRecoveries: Number(recovery[3]),
        maxRegistrationMS: Number(admission[3]), maxLoginMS: Number(admission[4]), maxJoinMS: Number(admission[5]) };
}
