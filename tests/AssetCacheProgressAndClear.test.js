import { jest } from '@jest/globals';
import { DEFAULT_ASSET_VERSION } from '../src/assets/assetManifest.js';
import { AssetCacheManager } from '../src/assets/AssetCacheManager.js';

describe('AssetCacheManager progress and clearing', () => {
    beforeEach(() => {
        Object.defineProperty(globalThis, 'navigator', {
            configurable: true,
            value: {
                serviceWorker: {
                    controller: { postMessage: jest.fn() },
                    register: jest.fn(async () => ({ scope: '/', active: {} }))
                }
            }
        });
    });

    test('reports progress while warming a pack through Cache Storage', async () => {
        const add = jest.fn(async () => undefined);
        const put = jest.fn(async () => undefined);
        global.caches = {
            open: jest.fn(async (name) => (name.endsWith('-meta') ? { put } : { add })),
            keys: jest.fn(async () => [])
        };

        const manager = new AssetCacheManager();
        manager.manifest.packs['environment-textures'] = ['./synthetic/a.bin', './synthetic/b.bin'];
        const updates = [];
        const result = await manager.warmPack('environment-textures', {
            preferServiceWorker: false,
            onProgress: (update) => updates.push(update)
        });

        expect(result.mode).toBe('cache-storage');
        expect(add).toHaveBeenCalled();
        expect(updates[0]).toEqual(expect.objectContaining({
            completed: 0,
            total: expect.any(Number),
            percent: 0
        }));
        expect(updates.at(-1)).toEqual(expect.objectContaining({
            completed: expect.any(Number),
            total: expect.any(Number),
            percent: 100
        }));
    });

    test('clears versioned asset caches and reports whether anything was removed', async () => {
        const deleted = jest.fn(async () => true);
        global.caches = {
            open: jest.fn(async () => ({ add: jest.fn(async () => undefined) })),
            keys: jest.fn(async () => ['eidolon-assets-old', `eidolon-assets-${DEFAULT_ASSET_VERSION}`, 'other-cache']),
            delete: deleted
        };

        const manager = new AssetCacheManager();
        const result = await manager.clearAll();

        expect(result).toEqual({ cleared: 2, cacheNames: ['eidolon-assets-old', `eidolon-assets-${DEFAULT_ASSET_VERSION}`] });
        expect(deleted).toHaveBeenCalledWith('eidolon-assets-old');
        expect(deleted).toHaveBeenCalledWith(`eidolon-assets-${DEFAULT_ASSET_VERSION}`);
    });
});
