import { jest } from '@jest/globals';
import { startPartyCombatWorkers } from './partyCombatWorkers.js';

const deferred = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
};
async function flush() { for (let i = 0; i < 16; i++) await Promise.resolve(); }

test('a slow Rogue operation does not prevent a second healer observation', async () => {
    const slow = deferred(), pause = deferred(), calls = [];
    const worker = startPartyCombatWorkers(['Cleric', 'Rogue'], async role => {
        calls.push(role);
        if (role === 'Rogue') await slow.promise;
    }, () => pause.promise);
    await flush(); pause.resolve(); await flush();
    const observed = [...calls];
    const stop = worker.stop(); slow.resolve(); await stop;
    expect(observed.filter(role => role === 'Cleric').length).toBeGreaterThan(1);
    expect(observed.filter(role => role === 'Rogue')).toHaveLength(1);
});

test('one browser never receives overlapping inputs, and stop waits for its real operation', async () => {
    const operation = deferred(), step = jest.fn(() => operation.promise);
    const pause = jest.fn();
    const worker = startPartyCombatWorkers(['Rogue'], step, pause);
    await flush(); expect(step).toHaveBeenCalledTimes(1);
    let stopped = false;
    const stop = worker.stop().then(() => { stopped = true; });
    await flush(); expect(stopped).toBe(false);
    operation.resolve(); await stop;
    expect(step).toHaveBeenCalledTimes(1); expect(pause).not.toHaveBeenCalled();
    await worker.stop(); expect(step).toHaveBeenCalledTimes(1);
});

test.each(['step', 'pause'])('a %s failure is retained while all outstanding roles are joined', async stage => {
    const other = deferred(), failure = new Error('actual input failed');
    const worker = startPartyCombatWorkers(['Cleric', 'Rogue'], role => {
        if (role === 'Cleric') return other.promise;
        if (stage === 'step') throw failure;
    }, () => { throw failure; });
    await flush(); expect(() => worker.check()).toThrow(failure);
    let joined = false;
    const stop = worker.stop().catch(error => { joined = true; return error; });
    await flush(); expect(joined).toBe(false);
    other.resolve(); expect(await stop).toBe(failure);
});

test('stopping while paused never starts a new input and joins the pause', async () => {
    const delay = deferred(), step = jest.fn(), worker = startPartyCombatWorkers(['Cleric'], step, () => delay.promise);
    await flush(); const stop = worker.stop(); delay.resolve(); await stop;
    expect(step).toHaveBeenCalledTimes(1);
});
