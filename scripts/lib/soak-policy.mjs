export function verifySoakHealth(sample, expectedCommit) {
    if (sample?.status !== 'ok' || sample.database !== 'ready' || sample.commit !== expectedCommit) {
        throw new Error('Soak endpoint is not the healthy build started by this run');
    }
    return sample;
}

export function validateSoakEvidence(log, samples) {
    const summary = log.match(/Load summary: connected=(\d+) joined=(\d+) state_frames=(\d+) read_errors=(\d+) write_errors=(\d+)/);
    if (!summary || Number(summary[1]) !== 100 || Number(summary[2]) !== 100 || Number(summary[3]) < 1 ||
        Number(summary[4]) !== 0 || Number(summary[5]) !== 0) throw new Error('100-client soak summary failed');
    if (samples.length < 2) throw new Error('Insufficient runtime samples');
    if (samples.some(sample => !Number.isFinite(sample.goroutines) || sample.goroutines < 1 ||
        !Number.isFinite(sample.heapAllocBytes) || sample.heapAllocBytes < 0)) throw new Error('Invalid runtime sample');
    const maxGoroutines = Math.max(...samples.map(sample => sample.goroutines));
    const maxHeap = Math.max(...samples.map(sample => sample.heapAllocBytes));
    const growth = samples.at(-1).heapAllocBytes - samples[0].heapAllocBytes;
    if (maxGoroutines > 2000) throw new Error(`Goroutine ceiling exceeded: ${maxGoroutines}`);
    if (maxHeap > 1610612736) throw new Error(`Heap ceiling exceeded: ${maxHeap}`);
    if (growth > 536870912) throw new Error(`Heap growth exceeded: ${growth}`);
    return { samples: samples.length, maxGoroutines, maxHeap, growth, stateFrames: Number(summary[3]) };
}
