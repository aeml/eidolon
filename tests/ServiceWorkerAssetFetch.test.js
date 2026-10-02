import { jest } from '@jest/globals';

const listeners = new Map();
const cache = { match: jest.fn(), put: jest.fn() };
const response = { ok: true, clone: jest.fn() };
const originalSelf = globalThis.self;
const originalCaches = globalThis.caches;
const originalFetch = globalThis.fetch;

beforeAll(async () => {
    globalThis.self = { addEventListener: (name, handler) => listeners.set(name, handler) };
    globalThis.caches = { open: jest.fn() };
    globalThis.fetch = jest.fn();
    await import('../src/assets/sw-asset-cache.js');
});
beforeEach(() => {
    jest.clearAllMocks();
    caches.open.mockResolvedValue(cache);
    cache.match.mockResolvedValue(undefined);
    cache.put.mockResolvedValue(undefined);
    response.clone.mockReturnValue({ cached: true });
    fetch.mockResolvedValue(response);
});
afterAll(() => {
    globalThis.self = originalSelf;
    globalThis.caches = originalCaches;
    globalThis.fetch = originalFetch;
});

function request({ method = 'GET', signal = {} } = {}) {
    const event = { request: { url: 'https://example.test/assets/body.glb?v=hash', method, signal },
        respondWith: jest.fn(), waitUntil: jest.fn() };
    listeners.get('fetch')(event);
    return { event, result: event.respondWith.mock.calls[0]?.[0] };
}

test('returns exact cached response without a network request', async () => {
    cache.match.mockResolvedValue(response);
    expect(await request().result).toBe(response);
    expect(fetch).not.toHaveBeenCalled();
});

test.each(['open', 'match'])('unavailable cache %s does not block the network asset', async operation => {
    const target = operation === 'open' ? caches.open : cache.match;
    target.mockRejectedValueOnce(new Error('storage unavailable'));
    const { event, result } = request();
    expect(await result).toBe(response);
    expect(fetch).toHaveBeenCalledWith(event.request);
    expect(cache.put).not.toHaveBeenCalled();
});

test.each([false, true])('storage write failure is contained (synchronous: %s)', async synchronous => {
    cache.put.mockImplementationOnce(() => {
        if (synchronous) throw new Error('quota exceeded');
        return Promise.reject(new Error('quota exceeded'));
    });
    const { event, result } = request();
    expect(await result).toBe(response);
    expect(event.waitUntil).toHaveBeenCalledTimes(1);
    await expect(event.waitUntil.mock.calls[0][0]).resolves.toBeUndefined();
});

test('one transient rejected GET recovers before the page receives a response', async () => {
    fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const { event, result } = request();
    expect(await result).toBe(response);
    expect(fetch.mock.calls).toEqual([[event.request], [event.request]]);
});

test('two rejected network GETs remain a real failure, with no third worker attempt', async () => {
    const error = new TypeError('Failed to fetch');
    fetch.mockRejectedValue(error);
    await expect(request().result).rejects.toBe(error);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(cache.put).not.toHaveBeenCalled();
});

test('cancellation during the short retry delay prevents a second fetch', async () => {
    const error = new TypeError('Failed to fetch');
    fetch.mockRejectedValueOnce(error);
    const signal = { aborted: false };
    const { result } = request({ signal });
    const cancelled = setTimeout(() => { signal.aborted = true; }, 20);
    try {
        await expect(result).rejects.toBe(error);
        expect(fetch).toHaveBeenCalledTimes(1);
    } finally { clearTimeout(cancelled); }
});

test.each(['abort', 'cancelled-signal', 'non-network'])('does not replay %s', async reason => {
    const error = new Error(reason);
    error.name = reason === 'abort' ? 'AbortError' : reason === 'cancelled-signal' ? 'TypeError' : 'Error';
    fetch.mockRejectedValueOnce(error);
    await expect(request({ signal: { aborted: reason === 'cancelled-signal' } }).result).rejects.toBe(error);
    expect(fetch).toHaveBeenCalledTimes(1);
});

test('HTTP failure responses remain failures and are never cached or retried', async () => {
    const missing = { ok: false, status: 404 };
    fetch.mockResolvedValue(missing);
    expect(await request().result).toBe(missing);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(cache.put).not.toHaveBeenCalled();
});

test('does not intercept or replay non-GET asset requests', () => {
    expect(request({ method: 'POST' }).event.respondWith).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
});
