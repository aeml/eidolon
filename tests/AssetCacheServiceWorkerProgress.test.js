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

        await manager.warmPack('core-models', {
            preferServiceWorker: true,
            onProgress: (update) => updates.push(update)
        });

        const messageHandler = navigator.serviceWorker.__listeners.get('message');
        messageHandler({
            data: {
                type: 'asset-pack-progress',
                payload: {
                    packName: 'core-models',
                    completed: 2,
                    total: 4,
                    percent: 50
                }
            }
        });

        expect(updates).toContainEqual(expect.objectContaining({
            packName: 'core-models',
            completed: 2,
            total: 4,
            percent: 50
        }));
    });

    test('inspects current cache coverage and detects legacy caches', async () => {
        const manager = new AssetCacheManager();
        const status = await manager.inspectPack('core-models');

        expect(status.packName).toBe('core-models');
        expect(status.cached).toBe(false);
        expect(status.cachedCount).toBe(1);
        expect(status.total).toBeGreaterThan(1);
        expect(status.updateAvailable).toBe(true);
    });
});
