import { EventEmitter } from 'node:events';
import { observeStartupModules } from './e2e/startup-module-evidence.js';

const origin = 'https://game.example';
const module = '/src/core/GameEngine.bundle.js';
const request = (url = `${origin}${module}?release=private&token=secret`, options = {}) => ({
    url: () => url, method: () => options.method || 'GET', resourceType: () => options.type || 'script',
    failure: () => ({ errorText: options.error || 'net::ERR_CONNECTION_CLOSED' })
});
const fixture = () => {
    const page = new EventEmitter(), evidence = observeStartupModules(page, origin, new Set([module]));
    return { page, evidence };
};

test('known first-party module errors retain fixed network code and path without query, host or raw text', () => {
    const { page, evidence } = fixture();
    const req = request(); page.emit('request', req); page.emit('requestfailed', req);
    page.emit('response', { request: () => req, status: () => 503 });
    expect(evidence.snapshot()).toEqual({ observed: 2, dropped: 0, failures: [
        { module, kind: 'request', code: 'net::ERR_CONNECTION_CLOSED' }, { module, kind: 'http', status: 503 }
    ] });
    expect(JSON.stringify(evidence.snapshot())).not.toMatch(/private|secret|https|game.example/);
});

test.each([
    [`https://other.example${module}`, {}], [`${origin}/src/account-private.js`, {}],
    [`${origin}/assets/account-private.glb`, { type: 'fetch' }], [`${origin}/account/private`, { type: 'fetch' }],
    [`${origin}${module}`, { method: 'POST' }], [`${origin}${module}`, { type: 'document' }],
    [`https://user:secret@game.example${module}`, {}], ['invalid URL', {}]
])('unknown routes, credentials and non-module requests cannot enter startup diagnostics %#', (url, options) => {
    const { page, evidence } = fixture();
    const req = request(url, options);
    page.emit('request', req);
    page.emit('requestfailed', req); page.emit('response', { request: () => req, status: () => 403 });
    expect(evidence.snapshot()).toEqual({ observed: 0, dropped: 0, failures: [] });
});

test.each(['private credential failure', 'net::ERR_PRIVATE secret', 'net::ERR_PRIVATE_TOKEN', '', 'net::ERR_' + 'A'.repeat(65)])(
    'arbitrary browser failure text is replaced by a constant category %#', error => {
        const { page, evidence } = fixture();
        const req = request(); req.failure = () => ({ errorText: error });
        page.emit('request', req); page.emit('requestfailed', req);
        expect(evidence.snapshot().failures[0].code).toBe('unknown');
    });

test.each([200, 399, 600, NaN, Infinity, '503', 503.5])('only actual HTTP error status codes are retained: %s', status => {
    const { page, evidence } = fixture(); const req = request(); page.emit('request', req);
    page.emit('response', { request: () => req, status: () => status });
    expect(evidence.snapshot().observed).toBe(0);
});

test('evidence is bounded, copied on read, reset per document and released on close', () => {
    const { page, evidence } = fixture();
    const req = request(); page.emit('request', req);
    for (let i = 0; i < 19; i++) page.emit('response', { request: () => req, status: () => 500 + i });
    expect(evidence.snapshot().observed).toBe(19); expect(evidence.snapshot().dropped).toBe(11);
    expect(evidence.snapshot().failures).toHaveLength(8); expect(evidence.snapshot().failures[0].status).toBe(511);
    evidence.snapshot().failures[0].module = '/private';
    expect(evidence.snapshot().failures[0].module).toBe(module);
    evidence.reset(); expect(evidence.snapshot()).toEqual({ observed: 0, dropped: 0, failures: [] });
    page.emit('close'); evidence.dispose();
    expect(page.listenerCount('requestfailed')).toBe(0); expect(page.listenerCount('response')).toBe(0);
    expect(page.listenerCount('close')).toBe(0);
    expect(page.listenerCount('request')).toBe(0);
});

test('late failures from the abandoned document cannot contaminate the next startup', () => {
    const { page, evidence } = fixture(), old = request(), current = request();
    page.emit('request', old); evidence.reset();
    page.emit('requestfailed', old); page.emit('response', { request: () => old, status: () => 503 });
    expect(evidence.snapshot().observed).toBe(0);
    page.emit('request', current); page.emit('requestfailed', current);
    expect(evidence.snapshot().observed).toBe(1);
});
