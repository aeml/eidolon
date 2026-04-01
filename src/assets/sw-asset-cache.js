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

self.addEventListener('message', (event) => {
    if (event.data?.type !== 'warm-asset-pack') return;
    const payload = event.data.payload || {};
    const cacheName = payload.cacheName || DEFAULT_CACHE_NAME;
    const assets = Array.isArray(payload.assets) ? payload.assets : [];
    event.waitUntil((async () => {
        if (assets.length === 0) return;
        const cache = await caches.open(cacheName);
        await cache.addAll(assets);
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
