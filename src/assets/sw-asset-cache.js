const DEFAULT_ASSET_VERSION = '2026-04-01';
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

self.addEventListener('message', (event) => {
    if (event.data?.type !== 'warm-asset-pack') return;
    const payload = event.data.payload || {};
    const cacheName = payload.cacheName || DEFAULT_CACHE_NAME;
    const packName = payload.packName || 'unknown-pack';
    const assets = Array.isArray(payload.assets) ? payload.assets : [];
    event.waitUntil((async () => {
        if (assets.length === 0) return;
        const cache = await caches.open(cacheName);
        await broadcastProgress({ packName, completed: 0, total: assets.length, percent: 0 });
        for (let index = 0; index < assets.length; index += 1) {
            await cache.add(assets[index]);
            await broadcastProgress({
                packName,
                completed: index + 1,
                total: assets.length,
                percent: Math.round(((index + 1) / assets.length) * 100)
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
