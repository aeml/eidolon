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

    async warmPack(packName, { preferServiceWorker = true, onProgress = null } = {}) {
        const assets = this.getPackAssets(packName);
        if (assets.length === 0) {
            throw new Error(`Unknown asset pack: ${packName}`);
        }

        const reportProgress = (completed) => {
            if (!onProgress) return;
            const total = assets.length;
            const percent = total === 0 ? 100 : Math.round((completed / total) * 100);
            onProgress({ packName, completed, total, percent });
        };

        reportProgress(0);

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
            reportProgress(assets.length);
            return { mode: 'service-worker', cacheName: this.cacheName, assets };
        }

        const cacheApi = globalThis.caches;
        if (!cacheApi?.open) {
            throw new Error('Cache Storage is not available');
        }
        const cache = await cacheApi.open(this.cacheName);
        for (let index = 0; index < assets.length; index += 1) {
            await cache.add(assets[index]);
            reportProgress(index + 1);
        }
        return { mode: 'cache-storage', cacheName: this.cacheName, assets };
    }

    async clearAll() {
        const cacheApi = globalThis.caches;
        if (!cacheApi?.keys || !cacheApi?.delete) {
            throw new Error('Cache Storage is not available');
        }

        const cacheNames = (await cacheApi.keys()).filter((name) => name.startsWith('eidolon-assets-'));
        let cleared = 0;
        for (const cacheName of cacheNames) {
            const removed = await cacheApi.delete(cacheName);
            if (removed) {
                cleared += 1;
            }
        }
        return { cleared, cacheNames };
    }
}
