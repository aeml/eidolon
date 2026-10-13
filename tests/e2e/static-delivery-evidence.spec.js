import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { observeStaticDelivery } from './static-delivery-evidence.js';

const modulePath = '/src/core/GameEngine.bundle.js';
const workerPath = '/src/core/ActorGameplayGeometryWorker.28b738eaf5aa3a9b.js';
const binaryPath = '/assets/gameplay-geometry/indices.51e1054c0867a1e5.bin';

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
