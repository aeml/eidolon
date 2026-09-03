const DEFAULT_ASSET_VERSION = '2026-09-03-27';
const DEFAULT_CACHE_NAME = `eidolon-assets-${DEFAULT_ASSET_VERSION}`;

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys
            .filter((key) => key.startsWith('eidolon-assets-') && key !== DEFAULT_CACHE_NAME)
            .map((key) => caches.delete(key)));
        await self.clients.claim();
    })());
});

async function broadcastProgress(payload) {
    const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    for (const client of clients) {
        client.postMessage({
            type: 'asset-pack-progress',
            payload
        });
    }
}

async function writePackMetadata(metadataCacheName, packName, version) {
    const metadataCache = await caches.open(metadataCacheName);
    await metadataCache.put(
        `eidolon-meta://packs/${packName}`,
        new Response(JSON.stringify({ packName, version }), {
            headers: { 'Content-Type': 'application/json' }
        })
    );
}

self.addEventListener('message', (event) => {
    if (event.data?.type !== 'warm-asset-pack') return;
    const payload = event.data.payload || {};
    const cacheName = payload.cacheName || DEFAULT_CACHE_NAME;
    const metadataCacheName = payload.metadataCacheName || `${cacheName}-meta`;
    const packName = payload.packName || 'unknown-pack';
    const version = payload.version || DEFAULT_ASSET_VERSION;
    const assets = Array.isArray(payload.assets) ? payload.assets : [];
    event.waitUntil((async () => {
        if (assets.length === 0) return;
        const cache = await caches.open(cacheName);
        await broadcastProgress({ packName, completed: 0, total: assets.length, percent: 0 });
        for (let index = 0; index < assets.length; index += 1) {
            await cache.add(assets[index]);
            const completed = index + 1;
            const percent = Math.round((completed / assets.length) * 100);
            if (completed === assets.length) {
                await writePackMetadata(metadataCacheName, packName, version);
            }
            await broadcastProgress({
                packName,
                completed,
                total: assets.length,
                percent,
                cachedVersion: completed === assets.length ? version : undefined
            });
        }
    })());
});

self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);
    if (!requestUrl.pathname.includes('/assets/')) {
        return;
    }

    event.respondWith((async () => {
        const cache = await caches.open(DEFAULT_CACHE_NAME);
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const response = await fetch(event.request);
        if (response && response.ok) {
            cache.put(event.request, response.clone());
        }
        return response;
    })());
});
