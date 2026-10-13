import { EventEmitter } from 'node:events';
import { observeStaticDelivery } from './e2e/static-delivery-evidence.js';

const origin = 'https://game.example';
const module = '/src/core/GameEngine.bundle.js';
const binary = '/assets/gameplay-geometry/indices.51e1054c0867a1e5.bin';
const workerPath = '/src/core/ActorGameplayGeometryWorker.28b738eaf5aa3a9b.js';
const request = (path = module, options = {}) => ({
    url: () => options.url || `${origin}${path}?account=private&token=secret`,
    method: () => options.method || 'GET', resourceType: () => options.type || 'script',
    failure: () => ({ errorText: options.error || 'net::ERR_ABORTED' })
});
const response = (req, status = 200) => ({ request: () => req, status: () => status, fromServiceWorker: () => true });
const fixture = () => {
    const page = new EventEmitter(), frame = {}; page.mainFrame = () => frame;
    let clock = 100;
    const evidence = observeStaticDelivery(page, origin, { allowed: new Set([module, binary]), now: () => clock });
    return { page, frame, evidence, tick: milliseconds => { clock += milliseconds; } };
};

test('overlapping module and geometry requests retain response, completion and failure ordering', () => {
    const { page, tick, evidence } = fixture(), first = request(), second = request(binary, { type: 'fetch' });
    page.emit('request', first); tick(20); page.emit('request', second);
    tick(30); page.emit('response', response(second)); tick(100); page.emit('requestfinished', second);
    tick(1350); page.emit('requestfailed', first);
    const result = evidence.snapshot();
    expect(result.active).toBe(0);
    expect(result.requests).toEqual([
        { id: 1, path: module, startedMs: 0, endedMs: 1500, outcome: 'failed', code: 'net::ERR_ABORTED' },
        { id: 2, path: binary, startedMs: 20, responseMs: 50, endedMs: 150, outcome: 'finished', status: 200, fromServiceWorker: true }
    ]);
    page.emit('requestfinished', first); page.emit('request', first);
    expect(evidence.snapshot().observed).toBe(2); expect(evidence.snapshot().active).toBe(0);
    expect(result.failures).toEqual([result.requests[0]]);
    expect(JSON.stringify(result)).not.toMatch(/private|secret|https|game.example/);
});

test.each([
    { url: 'https://other.example' + module }, { url: 'https://user:secret@game.example' + module },
    { url: 'invalid URL' }, { url: origin + '/account/private' }, { method: 'POST' }, { type: 'document' },
    { url: origin + '/assets/gameplay-geometry/indices.aaaaaaaaaaaaaaaa.bin', type: 'fetch' },
    { url: origin + '/src/core/ActorGameplayGeometryWorker.private.js' }
])('private, foreign and unrecognized traffic is excluded: %j', options => {
    const { page, evidence } = fixture(), req = request(module, options);
    page.emit('request', req); page.emit('response', response(req, 403)); page.emit('requestfailed', req);
    expect(evidence.snapshot().observed).toBe(0); expect(evidence.snapshot().failures).toEqual([]);
});

test('HTTP failure remains through a later successful request and document change', () => {
    const { page, frame, tick, evidence } = fixture(), bad = request(), recovered = request();
    page.emit('request', bad); tick(4); page.emit('response', response(bad, 503));
    page.emit('requestfailed', bad); page.emit('request', recovered); page.emit('response', response(recovered));
    page.emit('requestfinished', recovered); page.emit('framenavigated', {}); tick(2); page.emit('framenavigated', frame);
    const result = evidence.snapshot();
    expect(result.failures).toHaveLength(1); expect(result.failures[0]).toMatchObject({ status: 503, outcome: 'failed' });
    expect(result.navigations).toEqual([{ id: 1, atMs: 6 }]);
});

test.each(['private credential failure', 'net::ERR_UNKNOWN secret', ''])('unknown failure text is discarded: %j', error => {
    const { page, evidence } = fixture(), req = request(module, { error });
    req.failure = () => ({ errorText: error }); page.emit('request', req); page.emit('requestfailed', req);
    expect(evidence.snapshot().failures[0].code).toBe('unknown');
    expect(JSON.stringify(evidence.snapshot())).not.toMatch(/credential|secret/);
});

test('bounded request history retains early failures and pending failures without unbounded rows', () => {
    const { page, evidence } = fixture(), old = request();
    page.emit('request', old); page.emit('response', response(old, 502));
    for (let i = 0; i < 300; i++) {
        const req = request(); page.emit('request', req); page.emit('requestfinished', req);
    }
    let result = evidence.snapshot();
    expect(result.observed).toBe(301); expect(result.dropped).toBe(45); expect(result.active).toBe(1);
    expect(result.requests).toHaveLength(256); expect(result.failures[0].id).toBe(1);
    result.failures[0].path = '/private'; result.requests[0].path = '/private';
    page.emit('requestfailed', old);
    result = evidence.snapshot();
    expect(result.active).toBe(0); expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toMatchObject({ path: module, outcome: 'failed' });
    for (let i = 0; i < 40; i++) {
        const req = request(); page.emit('request', req); page.emit('requestfailed', req);
    }
    expect(evidence.snapshot().failures).toHaveLength(32);
    expect(evidence.snapshot().failureCount).toBe(41);
    expect(evidence.snapshot().droppedFailures).toBe(9);
});

test('qualified geometry worker lifetimes share the request clock and release listeners', () => {
    const { page, evidence, tick } = fixture(), worker = new EventEmitter();
    worker.url = () => `${origin}${workerPath}?token=secret`;
    tick(3); page.emit('worker', worker); tick(1497); worker.emit('close');
    expect(evidence.snapshot().workers).toEqual([{ id: 1, path: workerPath, openedMs: 3, closedMs: 1500 }]);
    expect(worker.listenerCount('close')).toBe(0);
    const live = [];
    for (let i = 0; i < 40; i++) {
        const instance = new EventEmitter(); instance.url = worker.url; page.emit('worker', instance); live.push(instance);
    }
    expect(evidence.snapshot().workers).toHaveLength(32); expect(evidence.snapshot().workerCount).toBe(41);
    expect(evidence.snapshot().droppedWorkers).toBe(9);
    expect(live.reduce((sum, instance) => sum + instance.listenerCount('close'), 0)).toBe(16);
    expect(evidence.snapshot().workers.at(-1).closeUnobserved).toBe(true);
    page.emit('close'); evidence.dispose();
    for (const event of ['request', 'response', 'requestfinished', 'requestfailed', 'worker', 'framenavigated', 'close']) {
        expect(page.listenerCount(event)).toBe(0);
    }
    expect(live.every(instance => instance.listenerCount('close') === 0)).toBe(true);
});

test('unknown and foreign workers never enter diagnostics or acquire listeners', () => {
    const { page, evidence } = fixture();
    for (const url of ['blob:' + origin + '/private', origin + '/src/private.js', 'https://other.example' + workerPath]) {
        const instance = new EventEmitter(); instance.url = () => url; page.emit('worker', instance);
        expect(instance.listenerCount('close')).toBe(0);
    }
    expect(evidence.snapshot().workers).toEqual([]);
});

test('page closure freezes the observation clock and makes pending lifetime limits explicit', () => {
    const { page, evidence, tick, frame } = fixture(), req = request(), worker = new EventEmitter();
    worker.url = () => origin + workerPath;
    page.emit('request', req); page.emit('worker', worker);
    for (let i = 0; i < 40; i++) page.emit('framenavigated', frame);
    tick(30); page.emit('close'); tick(100);
    worker.emit('close'); page.emit('requestfailed', req);
    const result = evidence.snapshot();
    expect(result.elapsedMs).toBe(30); expect(result.observationEnded).toEqual({ atMs: 30, reason: 'page-close' });
    expect(result.active).toBe(1); expect(result.requests[0].outcome).toBe('pending');
    expect(result.workers[0]).toEqual({ id: 1, path: workerPath, openedMs: 0, closeUnobserved: true });
    expect(result.navigationCount).toBe(40); expect(result.droppedNavigations).toBe(8);
    expect(result.navigations).toHaveLength(32);
    result.observationEnded.reason = 'private'; evidence.dispose();
    expect(evidence.snapshot().observationEnded.reason).toBe('page-close');
});
