// Test-only, scoped to this fixture directory. Exercise the real worker with
// controlled storage/network faults, never production credentials or state.
const mode = new URL(self.location.href).searchParams.get('mode');
const originalFetch = self.fetch.bind(self);
let modelAttempts = 0;
const originalOpen = caches.open.bind(caches);
caches.open = async (...args) => {
    if (mode === 'denied-open') throw new Error('fixture storage denied');
    const cache = await originalOpen(...args);
    if (mode === 'failed-read') cache.match = async () => { throw new Error('fixture read failed'); };
    if (mode === 'quota-and-network') cache.put = async () => { throw new Error('fixture quota exceeded'); };
    return cache;
};
self.fetch = async (...args) => {
    const url = args[0]?.url || String(args[0]);
    if (url.includes('/Fighter/fighter-runtime-low.glb')) {
        modelAttempts++;
        if (mode === 'quota-and-network' && modelAttempts === 1) throw new TypeError('fixture transient network failure');
    }
    return originalFetch(...args);
};
self.addEventListener('message', event => {
    if (event.data === 'fixture-model-attempts') event.ports[0].postMessage(modelAttempts);
});
self.importScripts('/src/assets/sw-asset-cache.js');
