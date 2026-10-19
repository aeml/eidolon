import { test, expect } from './static-delivery-test.js';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { observeStaticDelivery } from './static-delivery-evidence.js';
import { collectBrowserFailures } from './helpers.js';
import catalog from '../../src/data/gameplayGeometryPrecomputed.js';

const modulePath = '/src/core/GameEngine.bundle.js';
const workerPath = '/src/core/ActorGameplayGeometryWorker.28b738eaf5aa3a9b.js';
const binaryPath = '/assets/gameplay-geometry/indices.51e1054c0867a1e5.bin';

test('geometry worker recovers one timed-out shard with exact indices and retains the canceled delivery evidence', async ({ page }, testInfo) => {
    const [key, row] = Object.entries(catalog.entries)[0], shard = catalog.shards[row.shard];
    const files = new Map();
    for (const name of ['src/core/GameplayGeometryPrecomputed.js', 'src/core/GameplayGeometryFingerprint.js',
        'src/core/GameplayGeometryIndexCodec.js', 'src/data/gameplayGeometryPrecomputed.js', shard.url.slice(6)]) {
        files.set('/' + name, await readFile(new URL('../../' + name, import.meta.url)));
    }
    const path = '/' + shard.url.slice(6), timers = new Set(); let attempts = 0;
    const server = createServer((request, response) => {
        if (request.url === '/fixture') {
            response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><link rel="icon" href="data:,">');
        } else if (request.url === '/probe-worker.js') {
            response.setHeader('Content-Type', 'text/javascript');
            response.end(`import { gameplayGeometryPrecomputed } from '/src/core/GameplayGeometryPrecomputed.js';
                const row = ${JSON.stringify(row)};
                const source = { index:new Uint32Array(row.sourceIndexCount), attributes:{position:{itemSize:3,array:new Float32Array(row.vertices*3)}} };
                const [a,b] = await Promise.all([gameplayGeometryPrecomputed('${key}',row.kind,source),gameplayGeometryPrecomputed('${key}',row.kind,source)]);
                const digest = async result => result && [...new Uint8Array(await crypto.subtle.digest('SHA-256',result.indices))].map(v=>v.toString(16).padStart(2,'0')).join('');
                postMessage({precomputed:a?.precomputed === true && b?.precomputed === true,hashes:[await digest(a),await digest(b)]});`);
        } else if (files.has(request.url)) {
            response.setHeader('Content-Type', request.url.endsWith('.js') ? 'text/javascript' : 'application/octet-stream');
            if (request.url === path && ++attempts === 1) {
                const timer = setTimeout(() => { timers.delete(timer); response.end(files.get(path)); }, 2000);
                timers.add(timer); response.once('close', () => { clearTimeout(timer); timers.delete(timer); });
            } else response.end(files.get(request.url));
        } else { response.statusCode = 404; response.end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`, evidence = observeStaticDelivery(page, origin);
    const failures = collectBrowserFailures(page, origin);
    try {
        await page.goto(origin + '/fixture');
        const result = await page.evaluate(() => new Promise((resolve, reject) => {
            const worker = new Worker('/probe-worker.js', {type:'module'});
            worker.onmessage = event => { worker.terminate(); resolve(event.data); };
            worker.onerror = event => { worker.terminate(); reject(Error(event.message)); };
        }));
        expect(result).toEqual({precomputed:true,hashes:[row.sha256,row.sha256]});
        expect(attempts).toBe(2);
        await expect.poll(() => evidence.snapshot().requests.filter(r => r.path === path && r.outcome === 'finished').length).toBe(1);
        const observed = evidence.snapshot();
        expect(observed.failures).toHaveLength(1);
        expect(observed.failures[0]).toMatchObject({path,code:'net::ERR_ABORTED'});
        expect(observed.requests.filter(r => r.path === path)).toHaveLength(2);
        expect(failures, failures.join('\n')).toEqual([]);
        await testInfo.attach('recovered-geometry-delivery', {body:JSON.stringify(observed),contentType:'application/json'});
    } finally {
        evidence.dispose(); for (const timer of timers) clearTimeout(timer);
        server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    }
});

test('static delivery evidence sees actual dedicated-worker fetch cancellation and retirement', async ({ page }, testInfo) => {
    // Disposable anonymous HTTP fixture, with real browser network events.
    // Its delayed body establishes observer coverage, not product deadlines or
    // a causal explanation for an older production failure.
    const timers = new Set(), pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    const server = createServer((request, response) => {
        const url = new URL(request.url, 'http://fixture.invalid');
        if (url.pathname === '/fixture') {
            response.setHeader('Content-Type', 'text/html');
            response.end('<!doctype html><title>Static delivery observer fixture</title>');
        } else if (url.pathname === modulePath) {
            response.setHeader('Content-Type', 'text/javascript'); response.end('export const fixture = true;');
        } else if (url.pathname === workerPath) {
            response.setHeader('Content-Type', 'text/javascript');
            response.end(`onmessage = async () => {
                await fetch('${binaryPath}?mode=complete&token=private').then(result => result.arrayBuffer());
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 80);
                try { await fetch('${binaryPath}?mode=abort&token=private', { signal: controller.signal }); }
                catch { postMessage('aborted'); }
                finally { clearTimeout(timer); }
            };`);
        } else if (url.pathname === binaryPath) {
            response.setHeader('Content-Type', 'application/octet-stream');
            if (url.searchParams.get('mode') !== 'abort') response.end(Buffer.alloc(32));
            else {
                const timer = setTimeout(() => { timers.delete(timer); response.end(Buffer.alloc(32)); }, 2_000);
                timers.add(timer);
                response.once('close', () => { clearTimeout(timer); timers.delete(timer); });
            }
        } else if (url.pathname === '/favicon.ico') { response.statusCode = 204; response.end(); }
        else { response.statusCode = 404; response.end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const evidence = observeStaticDelivery(page, origin);
    try {
        await page.goto(`${origin}/fixture?account=private`);
        await page.evaluate(async ({ modulePath, workerPath }) => {
            await import(modulePath + '?token=private');
            window.fixtureWorker = new Worker(workerPath + '?token=private');
            await new Promise((resolve, reject) => {
                window.fixtureWorker.onmessage = resolve;
                window.fixtureWorker.onerror = reject;
                window.fixtureWorker.postMessage('start');
            });
        }, { modulePath, workerPath });
        await expect.poll(() => evidence.snapshot().failures.length).toBe(1);
        await page.evaluate(() => window.fixtureWorker.terminate());
        await expect.poll(() => evidence.snapshot().workers[0]?.closedMs).toBeGreaterThan(0);
        const result = evidence.snapshot();
        expect(result.requests.filter(row => row.path === modulePath && row.outcome === 'finished')).toHaveLength(1);
        expect(result.requests.filter(row => row.path === binaryPath && row.outcome === 'finished')).toHaveLength(1);
        expect(result.failures[0]).toMatchObject({ path: binaryPath, outcome: 'failed', code: 'net::ERR_ABORTED' });
        expect(result.active).toBe(0);
        expect(result.failures[0].endedMs).toBeGreaterThan(result.failures[0].startedMs);
        expect(result.workers[0].closedMs).toBeGreaterThanOrEqual(result.failures[0].endedMs);
        expect(pageErrors).toEqual([]);
        expect(JSON.stringify(result)).not.toMatch(/private|token|127\.0\.0\.1|account/);
        await testInfo.attach('anonymous-static-delivery-evidence', { body: JSON.stringify(result), contentType: 'application/json' });
    } finally {
        evidence.dispose();
        for (const timer of timers) clearTimeout(timer);
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    }
});

test('automatic static delivery fixture records an actual first-party module', async ({ page, baseURL, staticDeliveryEvidence }) => {
    await page.route('**/fixture-auto', route => route.fulfill({
        contentType: 'text/html', body: '<!doctype html><title>Anonymous observer fixture</title>'
    }));
    await page.goto(`${baseURL}/fixture-auto`);
    await page.evaluate(() => import('/src/data/worldPopulation.js'));
    await expect.poll(() => staticDeliveryEvidence.snapshot().requests.some(row =>
        row.path === '/src/data/worldPopulation.js' && row.outcome === 'finished')).toBe(true);
    expect(staticDeliveryEvidence.snapshot().failures).toEqual([]);
});
