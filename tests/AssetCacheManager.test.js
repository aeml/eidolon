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
        expect(corePack.assets).toEqual([]);
        expect(new Set(corePack.assets).size).toBe(corePack.assets.length);
        expect(getAssetPack('unknown-pack')).toBeNull();

        const manifest = getVersionedAssetManifest();
        expect(manifest.version).toBe(DEFAULT_ASSET_VERSION);
        expect(manifest.packs['core-models'].every((path) => path.includes('?v='))).toBe(true);
    });

    test('external pack entries preserve original and versioned URLs while procedural packs stay payload-free', () => {
        const entries = getAssetPackEntries('environment-textures');
        expect(entries.length).toBeGreaterThan(0);
        expect(entries[0]).toEqual(expect.objectContaining({
            path: expect.stringMatching(/^\.\/assets\//),
            versionedPath: expect.stringContaining('?v=')
        }));
        expect(getAssetPackEntries('core-models')).toEqual([]);
        expect(getAssetPackEntries('dungeon-models')).toEqual([]);
    });
});

describe('AssetCacheManager', () => {
    beforeEach(() => {
        global.caches = {
            open: jest.fn(async () => ({
                addAll: jest.fn(async () => undefined),
                add: jest.fn(async () => undefined)
            })),
            keys: jest.fn(async () => []),
            delete: jest.fn(async () => true)
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

    test('warms an external pack directly through Cache Storage when requested', async () => {
        const metadataCache = { put: jest.fn(async () => undefined) };
        const assetCache = { addAll: jest.fn(async () => undefined), add: jest.fn(async () => undefined) };
        caches.open = jest.fn(async (name) => (name === `eidolon-assets-${DEFAULT_ASSET_VERSION}-meta` ? metadataCache : assetCache));

        const manager = new AssetCacheManager();
        await manager.warmPack('environment-textures', { preferServiceWorker: false });

        expect(caches.open).toHaveBeenCalledWith(`eidolon-assets-${DEFAULT_ASSET_VERSION}`);
        expect(caches.open).toHaveBeenCalledWith(`eidolon-assets-${DEFAULT_ASSET_VERSION}-meta`);
        expect(assetCache.add).toHaveBeenCalledTimes(ASSET_PACKS['environment-textures'].length);
        expect(assetCache.add.mock.calls[0][0]).toEqual(expect.stringContaining(ASSET_PACKS['environment-textures'][0].replace('./', '')));
        expect(metadataCache.put).toHaveBeenCalledWith(
            'eidolon-meta://packs/environment-textures',
            expect.objectContaining({ json: expect.any(Function) })
        );
    });

    test.each(['core-models', 'dungeon-models'])('recognizes code-generated %s as built in without a cache payload', async (packName) => {
        const metadataCache = { put: jest.fn(async () => undefined) };
        caches.open = jest.fn(async () => metadataCache);

        const manager = new AssetCacheManager();
        const updates = [];
        const result = await manager.warmPack(packName, {
            onProgress: (update) => updates.push(update)
        });
        const inspection = await manager.inspectPack(packName);

        expect(result).toEqual(expect.objectContaining({ mode: 'built-in', assets: [] }));
        expect(updates).toEqual([expect.objectContaining({ completed: 0, total: 0, percent: 100 })]);
        expect(navigator.serviceWorker.controller.postMessage).not.toHaveBeenCalled();
        expect(inspection).toEqual(expect.objectContaining({
            cached: true,
            builtIn: true,
            cachedCount: 0,
            total: 0,
            updateAvailable: false,
            cachedVersion: DEFAULT_ASSET_VERSION
        }));
    });

    test('still rejects unknown pack names', async () => {
        const manager = new AssetCacheManager();
        await expect(manager.warmPack('missing-pack')).rejects.toThrow('Unknown asset pack');
        await expect(manager.inspectPack('missing-pack')).rejects.toThrow('Unknown asset pack');
    });

    test('registerServiceWorker registers the root asset service worker', async () => {
        const registration = await AssetCacheManager.registerServiceWorker();
        expect(navigator.serviceWorker.register).toHaveBeenCalledWith('./sw.js', {
            scope: './',
            updateViaCache: 'none'
        });
        expect(registration).toEqual(expect.objectContaining({ scope: '/' }));
    });

    test('warmPack can delegate an external pack to an active service worker controller and await completion', async () => {
        const assetCache = { match: jest.fn(async () => undefined) };
        const metadataCache = { put: jest.fn(async () => undefined), match: jest.fn(async () => undefined) };
        global.caches = {
            open: jest.fn(async (name) => (name.endsWith('-meta') ? metadataCache : assetCache)),
            keys: jest.fn(async () => []),
            delete: jest.fn(async () => true)
        };
        Object.defineProperty(globalThis, 'navigator', {
            configurable: true,
            value: {
                serviceWorker: {
                    controller: { postMessage: jest.fn() },
                    register: jest.fn(async () => ({ scope: '/', active: {} })),
                    addEventListener: jest.fn(),
                    removeEventListener: jest.fn()
                }
            }
        });

        const manager = new AssetCacheManager();
        const packName = 'environment-textures';
        const warmPromise = manager.warmPack(packName, { preferServiceWorker: true });

        expect(navigator.serviceWorker.controller.postMessage).toHaveBeenCalledWith({
            type: 'warm-asset-pack',
            payload: {
                cacheName: `eidolon-assets-${DEFAULT_ASSET_VERSION}`,
                metadataCacheName: `eidolon-assets-${DEFAULT_ASSET_VERSION}-meta`,
                packName,
                version: DEFAULT_ASSET_VERSION,
                assets: getVersionedAssetManifest().packs[packName]
            }
        });

        manager.handleServiceWorkerMessage({
            data: {
                type: 'asset-pack-progress',
                payload: {
                    packName,
                    completed: getVersionedAssetManifest().packs[packName].length,
                    total: getVersionedAssetManifest().packs[packName].length,
                    percent: 100,
                    cachedVersion: DEFAULT_ASSET_VERSION
                }
            }
        });

        await expect(warmPromise).resolves.toEqual({
            mode: 'service-worker',
            cacheName: `eidolon-assets-${DEFAULT_ASSET_VERSION}`,
            assets: getVersionedAssetManifest().packs[packName]
        });
        expect(metadataCache.put).toHaveBeenCalledWith(
            `eidolon-meta://packs/${packName}`,
            expect.objectContaining({ json: expect.any(Function) })
        );
    });
});
