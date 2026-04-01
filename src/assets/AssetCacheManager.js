import { getVersionedAssetManifest } from './assetManifest.js';

export class AssetCacheManager {
    constructor() {
        this.manifest = getVersionedAssetManifest();
        this.cacheName = this.manifest.cacheName;
        this.progressListeners = new Map();
        this.handleServiceWorkerMessage = this.handleServiceWorkerMessage.bind(this);
        globalThis.navigator?.serviceWorker?.addEventListener?.('message', this.handleServiceWorkerMessage);
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

    handleServiceWorkerMessage(event) {
        if (event?.data?.type !== 'asset-pack-progress') {
            return;
        }

        const payload = event.data.payload || {};
        const listener = this.progressListeners.get(payload.packName);
        if (listener) {
            listener(payload);
        }
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
            if (onProgress) {
                this.progressListeners.set(packName, onProgress);
            }
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
        for (let index = 0; index < assets.length; index += 1) {
            await cache.add(assets[index]);
            reportProgress(index + 1);
        }
        return { mode: 'cache-storage', cacheName: this.cacheName, assets };
    }

    async inspectPack(packName) {
        const assets = this.getPackAssets(packName);
        const cacheApi = globalThis.caches;
        if (!cacheApi?.open || !cacheApi?.keys) {
            throw new Error('Cache Storage is not available');
        }

        const cache = await cacheApi.open(this.cacheName);
        let cachedCount = 0;
        for (const asset of assets) {
            const cached = await cache.match(asset);
            if (cached) {
                cachedCount += 1;
            }
        }

        const cacheNames = await cacheApi.keys();
        const updateAvailable = cacheNames.some((name) => name.startsWith('eidolon-assets-') && name !== this.cacheName);
        return {
            packName,
            total: assets.length,
            cachedCount,
            cached: assets.length > 0 && cachedCount === assets.length,
            updateAvailable,
            cacheName: this.cacheName
        };
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
