import { getAssetPackNames, getVersionedAssetManifest } from './assetManifest.js';

export class AssetCacheManager {
    constructor() {
        this.manifest = getVersionedAssetManifest();
        this.cacheName = this.manifest.cacheName;
        this.metadataCacheName = `${this.cacheName}-meta`;
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
        return serviceWorker.register('./sw.js', {
            scope: './',
            updateViaCache: 'none'
        });
    }

    getPackAssets(packName) {
        return this.manifest.packs[packName] || [];
    }

    hasPack(packName) {
        return Object.prototype.hasOwnProperty.call(this.manifest.packs, packName);
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

        if (payload.packName && payload.cachedVersion && payload.percent === 100) {
            void this.writePackMetadata(payload.packName, payload.cachedVersion);
        }

        if (payload.packName && payload.percent === 100) {
            this.progressListeners.delete(payload.packName);
        }
    }

    async writePackMetadata(packName, version = this.manifest.version) {
        const cacheApi = globalThis.caches;
        if (!cacheApi?.open) {
            return;
        }

        const metadataCache = await cacheApi.open(this.metadataCacheName);
        if (!metadataCache?.put) {
            return;
        }
        await metadataCache.put(
            `eidolon-meta://packs/${packName}`,
            {
                json: async () => ({ packName, version })
            }
        );
    }

    async readPackMetadata(packName) {
        const cacheApi = globalThis.caches;
        if (!cacheApi?.open) {
            return null;
        }

        const metadataCache = await cacheApi.open(this.metadataCacheName);
        const response = await metadataCache.match(`eidolon-meta://packs/${packName}`);
        if (!response?.json) {
            return null;
        }

        return response.json();
    }

    async warmPack(packName, { preferServiceWorker = true, onProgress = null } = {}) {
        if (!this.hasPack(packName)) {
            throw new Error(`Unknown asset pack: ${packName}`);
        }
        const assets = this.getPackAssets(packName);

        const reportProgress = (completed) => {
            if (!onProgress) return;
            const total = assets.length;
            const percent = total === 0 ? 100 : Math.round((completed / total) * 100);
            onProgress({ packName, completed, total, percent });
        };

        reportProgress(0);

        // The procedural core is emitted from JavaScript and has no external
        // payload to cache. Keep the named pack valid so callers can inspect it,
        // while completing immediately instead of waiting on a service worker
        // progress message that can never arrive for an empty asset list.
        if (assets.length === 0) {
            await this.writePackMetadata(packName);
            return { mode: 'built-in', cacheName: this.cacheName, assets };
        }

        const serviceWorker = globalThis.navigator?.serviceWorker;
        if (preferServiceWorker && serviceWorker?.controller?.postMessage) {
            if (onProgress) {
                this.progressListeners.set(packName, onProgress);
            }
            const completionPromise = new Promise((resolve) => {
                const baseListener = this.progressListeners.get(packName);
                this.progressListeners.set(packName, (payload) => {
                    if (baseListener) {
                        baseListener(payload);
                    }
                    if (payload?.percent === 100) {
                        resolve();
                    }
                });
            });
            serviceWorker.controller.postMessage({
                type: 'warm-asset-pack',
                payload: {
                    cacheName: this.cacheName,
                    metadataCacheName: this.metadataCacheName,
                    packName,
                    version: this.manifest.version,
                    assets
                }
            });
            await completionPromise;
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
        await this.writePackMetadata(packName);
        return { mode: 'cache-storage', cacheName: this.cacheName, assets };
    }

    async inspectPack(packName) {
        if (!this.hasPack(packName)) {
            throw new Error(`Unknown asset pack: ${packName}`);
        }
        const assets = this.getPackAssets(packName);
        if (assets.length === 0) {
            return {
                packName,
                total: 0,
                cachedCount: 0,
                cached: true,
                builtIn: true,
                updateAvailable: false,
                cachedVersion: this.manifest.version,
                cacheName: this.cacheName
            };
        }
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

        const metadata = await this.readPackMetadata(packName);
        const cachedVersion = metadata?.version;
        const cacheNames = await cacheApi.keys();
        const hasLegacyCache = cacheNames.some((name) => name.startsWith('eidolon-assets-') && !name.endsWith('-meta') && name !== this.cacheName);
        const updateAvailable = cachedCount > 0 && (
            (cachedVersion && cachedVersion !== this.manifest.version)
            || (!cachedVersion && hasLegacyCache)
        );
        return {
            packName,
            total: assets.length,
            cachedCount,
            cached: assets.length > 0 && cachedCount === assets.length,
            builtIn: false,
            updateAvailable,
            cachedVersion,
            cacheName: this.cacheName
        };
    }

    async getOutdatedPacks() {
        const packNames = getAssetPackNames();
        const inspections = await Promise.all(packNames.map((packName) => this.inspectPack(packName)));
        return inspections
            .filter((inspection) => inspection.updateAvailable && inspection.cachedCount > 0)
            .map((inspection) => inspection.packName);
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
