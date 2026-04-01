import { getVersionedAssetManifest } from './assetManifest.js';

export class AssetCacheManager {
    constructor() {
        this.manifest = getVersionedAssetManifest();
        this.cacheName = this.manifest.cacheName;
    }

    static isSupported() {
        return typeof window !== 'undefined' && 'caches' in window;
    }

    static async registerServiceWorker() {
        const serviceWorker = globalThis.navigator?.serviceWorker;
        if (!serviceWorker?.register) {
            return null;
        }
        return serviceWorker.register('./sw.js', { scope: './' });
    }

    getPackAssets(packName) {
        return this.manifest.packs[packName] || [];
    }

    async warmPack(packName, { preferServiceWorker = true } = {}) {
        const assets = this.getPackAssets(packName);
        if (assets.length === 0) {
            throw new Error(`Unknown asset pack: ${packName}`);
        }

        const serviceWorker = globalThis.navigator?.serviceWorker;
        if (preferServiceWorker && serviceWorker?.controller?.postMessage) {
            serviceWorker.controller.postMessage({
                type: 'warm-asset-pack',
                payload: {
                    cacheName: this.cacheName,
                    packName,
                    assets
                }
            });
            return { mode: 'service-worker', cacheName: this.cacheName, assets };
        }

        const cacheApi = globalThis.caches;
        if (!cacheApi?.open) {
            throw new Error('Cache Storage is not available');
        }
        const cache = await cacheApi.open(this.cacheName);
        await cache.addAll(assets);
        return { mode: 'cache-storage', cacheName: this.cacheName, assets };
    }
}
