import { jest } from '@jest/globals';
import {
    ASSET_PACKS,
    DEFAULT_ASSET_VERSION,
    getAssetPack,
    getAssetPackEntries,
    getAssetPackNames,
    getVersionedAssetManifest
} from '../src/assets/assetManifest.js';
import { AssetCacheManager } from '../src/assets/AssetCacheManager.js';

describe('asset pack manifest', () => {
    test('exposes named packs with versioned asset URLs and no duplicates', () => {
        const packNames = getAssetPackNames();
        expect(packNames).toContain('core-models');
        expect(packNames).toContain('dungeon-models');

        const corePack = getAssetPack('core-models');
        expect(corePack).toBeDefined();
        expect(new Set(corePack.assets).size).toBe(corePack.assets.length);

        const manifest = getVersionedAssetManifest();
        expect(manifest.version).toBe(DEFAULT_ASSET_VERSION);
        expect(manifest.packs['core-models'].every((path) => path.includes('?v='))).toBe(true);
    });

    test('pack entries preserve original and versioned URLs', () => {
        const entries = getAssetPackEntries('dungeon-models');
        expect(entries.length).toBeGreaterThan(0);
        expect(entries[0]).toEqual(expect.objectContaining({
            path: expect.stringMatching(/^\.\/assets\//),
            versionedPath: expect.stringContaining('?v=')
        }));
    });
});

describe('AssetCacheManager', () => {
    beforeEach(() => {
        global.caches = {
            open: jest.fn(async () => ({ addAll: jest.fn(async () => undefined) }))
        };
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

    test('warms a pack directly through Cache Storage when requested', async () => {
        const manager = new AssetCacheManager();
        await manager.warmPack('core-models', { preferServiceWorker: false });

        expect(caches.open).toHaveBeenCalledWith(`eidolon-assets-${DEFAULT_ASSET_VERSION}`);
        const cache = await caches.open.mock.results[0].value;
        expect(cache.addAll).toHaveBeenCalledWith(ASSET_PACKS['core-models'].map((path) => expect.stringContaining(path.replace('./', ''))));
    });

    test('registerServiceWorker registers the root asset service worker', async () => {
        const registration = await AssetCacheManager.registerServiceWorker();
        expect(navigator.serviceWorker.register).toHaveBeenCalledWith('./sw.js', { scope: './' });
        expect(registration).toEqual(expect.objectContaining({ scope: '/' }));
    });

    test('warmPack can delegate to an active service worker controller', async () => {
        const manager = new AssetCacheManager();
        await manager.warmPack('dungeon-models', { preferServiceWorker: true });

        expect(navigator.serviceWorker.controller.postMessage).toHaveBeenCalledWith({
            type: 'warm-asset-pack',
            payload: {
                cacheName: `eidolon-assets-${DEFAULT_ASSET_VERSION}`,
                packName: 'dungeon-models',
                assets: getVersionedAssetManifest().packs['dungeon-models']
            }
        });
    });
});
