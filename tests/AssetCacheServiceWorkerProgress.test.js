import { jest } from '@jest/globals';
import { AssetCacheManager } from '../src/assets/AssetCacheManager.js';

describe('AssetCacheManager service worker progress and inspection', () => {
    beforeEach(() => {
        global.caches = {
            keys: jest.fn(async () => ['eidolon-assets-legacy']),
            open: jest.fn(async () => {
                let seenMatch = false;
                return {
                    match: jest.fn(async () => {
                        if (seenMatch) {
                            return undefined;
                        }
                        seenMatch = true;
                        return { ok: true };
                    })
                };
            })
        };

        const listeners = new Map();
        Object.defineProperty(globalThis, 'navigator', {
            configurable: true,
            value: {
                serviceWorker: {
                    controller: { postMessage: jest.fn() },
                    register: jest.fn(async () => ({ scope: './', active: {} })),
                    addEventListener: jest.fn((event, handler) => listeners.set(event, handler)),
                    removeEventListener: jest.fn((event) => listeners.delete(event)),
                    __listeners: listeners
                }
            }
        });
    });

    test('forwards service worker progress events to warmPack listeners', async () => {
        const manager = new AssetCacheManager();
        const updates = [];

        const warmPromise = manager.warmPack('environment-textures', {
            preferServiceWorker: true,
            onProgress: (update) => updates.push(update)
        });

        const messageHandler = navigator.serviceWorker.__listeners.get('message');
        messageHandler({
            data: {
                type: 'asset-pack-progress',
                payload: {
                    packName: 'environment-textures',
                    completed: 2,
                    total: 4,
                    percent: 50
                }
            }
        });
        messageHandler({
            data: {
                type: 'asset-pack-progress',
                payload: {
                    packName: 'environment-textures',
                    completed: 4,
                    total: 4,
                    percent: 100,
                    cachedVersion: '2026-09-02-14'
                }
            }
        });

        await warmPromise;

        expect(updates).toContainEqual(expect.objectContaining({
            packName: 'environment-textures',
            completed: 2,
            total: 4,
            percent: 50
        }));
    });

    test('inspects current cache coverage and detects legacy caches', async () => {
        global.caches.open = jest.fn(async (name) => {
            if (name.endsWith('-meta')) {
                return {
                    match: jest.fn(async () => ({
                        json: async () => ({ packName: 'environment-textures', version: 'legacy-build' })
                    }))
                };
            }
            let seenMatch = false;
            return {
                match: jest.fn(async () => {
                    if (seenMatch) {
                        return undefined;
                    }
                    seenMatch = true;
                    return { ok: true };
                })
            };
        });

        const manager = new AssetCacheManager();
        const status = await manager.inspectPack('environment-textures');

        expect(status.packName).toBe('environment-textures');
        expect(status.cached).toBe(false);
        expect(status.cachedCount).toBe(1);
        expect(status.total).toBeGreaterThan(1);
        expect(status.cachedVersion).toBe('legacy-build');
        expect(status.updateAvailable).toBe(true);
    });
});
