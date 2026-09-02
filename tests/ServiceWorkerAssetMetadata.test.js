import { jest } from '@jest/globals';

describe('asset service worker pack metadata', () => {
    test('warm-asset-pack writes per-pack metadata after caching assets', async () => {
        const listeners = new Map();
        const assetCache = { add: jest.fn(async () => undefined) };
        const metadataCache = { put: jest.fn(async () => undefined) };
        const clients = [{ postMessage: jest.fn() }];

        globalThis.self = {
            addEventListener: jest.fn((event, handler) => listeners.set(event, handler)),
            skipWaiting: jest.fn(),
            clients: {
                claim: jest.fn(async () => undefined),
                matchAll: jest.fn(async () => clients)
            }
        };
        globalThis.caches = {
            open: jest.fn(async (name) => (name.endsWith('-meta') ? metadataCache : assetCache)),
            keys: jest.fn(async () => []),
            delete: jest.fn(async () => true)
        };
        globalThis.fetch = jest.fn();
        globalThis.Response = class Response {
            constructor(body, init = {}) {
                this.body = body;
                this.headers = init.headers || {};
            }
            async json() {
                return JSON.parse(this.body);
            }
        };

        await import('../src/assets/sw-asset-cache.js');

        const messageHandler = listeners.get('message');
        let pending;
        messageHandler({
            data: {
                type: 'warm-asset-pack',
                payload: {
                    cacheName: 'eidolon-assets-2026-09-02-15',
                    metadataCacheName: 'eidolon-assets-2026-09-02-15-meta',
                    packName: 'core-models',
                    version: '2026-09-02-15',
                    assets: ['./assets/foo.glb?v=2026-09-02-15', './assets/bar.glb?v=2026-09-02-15']
                }
            },
            waitUntil: (promise) => {
                pending = promise;
            }
        });

        await pending;

        expect(assetCache.add).toHaveBeenCalledTimes(2);
        expect(metadataCache.put).toHaveBeenCalledWith(
            'eidolon-meta://packs/core-models',
            expect.any(Response)
        );
        const finalBroadcast = clients[0].postMessage.mock.calls.at(-1)[0];
        expect(finalBroadcast).toEqual(expect.objectContaining({
            type: 'asset-pack-progress',
            payload: expect.objectContaining({
                packName: 'core-models',
                percent: 100,
                cachedVersion: '2026-09-02-15'
            })
        }));
    });
});
