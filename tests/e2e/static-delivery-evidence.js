import { readdirSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { knownModules, safeNetworkCode } from './startup-module-evidence.js';

const workerPath = /^\/src\/core\/ActorGameplayGeometryWorker(?:\.bundle|\.[a-f0-9]{16})\.js$/;
let repositoryAssets;
function knownAssets() {
    if (!repositoryAssets) repositoryAssets = new Set([...knownModules(), ...readdirSync(
        new URL('../../assets/gameplay-geometry/', import.meta.url)
    ).filter(name => /^indices\.[a-f0-9]{16}\.bin$/.test(name)).map(name => `/assets/gameplay-geometry/${name}`)]);
    return repositoryAssets;
}

// Page-observable static delivery only. Never read headers, bodies, frame URLs,
// account traffic or arbitrary browser error text. Observing does not retry,
// cancel, change deadlines or decide whether a browser failure is acceptable.
export function observeStaticDelivery(page, baseURL, { allowed = knownAssets(), now = () => performance.now() } = {}) {
    const origin = new URL(baseURL).origin, startedAt = now(), requests = new WeakMap(), recordedFailures = new WeakSet();
    const recent = [], failures = [], workers = [], navigations = [], listeners = new Map();
    let observed = 0, active = 0, workerCount = 0, navigationCount = 0, failureCount = 0, ended = null;
    const time = () => Math.max(0, Math.round((now() - startedAt) * 10) / 10);
    const pathOf = raw => {
        try {
            const url = new URL(raw);
            return url.origin === origin && !url.username && !url.password &&
                (allowed.has(url.pathname) || workerPath.test(url.pathname)) ? url.pathname : null;
        } catch { return null; }
    };
    const bounded = (rows, value, limit) => { rows.push(value); if (rows.length > limit) rows.shift(); };
    const recordFailure = row => {
        if (recordedFailures.has(row)) return;
        recordedFailures.add(row); failureCount++; bounded(failures, row, 32);
    };
    const started = request => {
        if (request.method() !== 'GET' || !['script', 'fetch'].includes(request.resourceType())) return;
        const path = pathOf(request.url());
        if (!path || requests.has(request)) return;
        const row = { id: ++observed, path, startedMs: time(), outcome: 'pending' };
        requests.set(request, row); active++;
        bounded(recent, row, 256);
    };
    const response = result => {
        const row = requests.get(result.request()), status = result.status();
        if (!row || row.outcome !== 'pending') return;
        row.responseMs = time();
        if (Number.isInteger(status) && status >= 100 && status <= 599) row.status = status;
        row.fromServiceWorker = result.fromServiceWorker();
        if (row.status >= 400) recordFailure(row);
    };
    const terminal = (request, outcome) => {
        const row = requests.get(request);
        if (!row || row.outcome !== 'pending') return;
        row.outcome = outcome; row.endedMs = time(); active--;
        if (outcome === 'failed') row.code = safeNetworkCode(request.failure()?.errorText);
        if (outcome === 'failed' || row.status >= 400) recordFailure(row);
    };
    const finished = request => terminal(request, 'finished');
    const failed = request => terminal(request, 'failed');
    const worker = instance => {
        const path = pathOf(instance.url());
        if (!path || !workerPath.test(path)) return;
        const row = { id: ++workerCount, path, openedMs: time() };
        bounded(workers, row, 32);
        if (listeners.size >= 16) { row.closeUnobserved = true; return; }
        const close = () => { row.closedMs = time(); instance.removeListener('close', close); listeners.delete(instance); };
        listeners.set(instance, { close, row }); instance.once('close', close);
    };
    const navigated = frame => {
        if (frame !== page.mainFrame()) return;
        bounded(navigations, { id: ++navigationCount, atMs: time() }, 32);
    };
    const handlers = { request: started, response, requestfinished: finished, requestfailed: failed, worker, framenavigated: navigated };
    const end = reason => {
        if (ended) return;
        ended = { atMs: time(), reason };
        for (const [event, handler] of Object.entries(handlers)) page.removeListener(event, handler);
        page.removeListener('close', closed);
        for (const [instance, { close, row }] of listeners) {
            instance.removeListener('close', close);
            row.closeUnobserved = true;
        }
        listeners.clear();
    };
    const closed = () => end('page-close');
    for (const [event, handler] of Object.entries(handlers)) page.on(event, handler);
    page.once('close', closed);
    return {
        snapshot() {
            return { schema: 1, elapsedMs: ended?.atMs ?? time(), observationEnded: ended ? { ...ended } : null,
                observed, active, dropped: Math.max(0, observed - recent.length),
                requests: recent.map(row => ({ ...row })), failures: failures.map(row => ({ ...row })),
                failureCount, droppedFailures: Math.max(0, failureCount - failures.length),
                workerCount, droppedWorkers: Math.max(0, workerCount - workers.length), workers: workers.map(row => ({ ...row })),
                navigationCount, droppedNavigations: Math.max(0, navigationCount - navigations.length), navigations: navigations.map(row => ({ ...row })) };
        },
        dispose() { end('manual'); }
    };
}

// Automatic test fixture teardown freezes observation before attachment, even
// when the route fails or has already closed its page.
export async function recordStaticDelivery({ page, baseURL }, use, testInfo) {
    const evidence = observeStaticDelivery(page, baseURL);
    try { await use(evidence); }
    finally {
        evidence.dispose();
        await testInfo.attach('static-delivery-evidence', {
            body: JSON.stringify(evidence.snapshot()), contentType: 'application/json'
        });
    }
}
