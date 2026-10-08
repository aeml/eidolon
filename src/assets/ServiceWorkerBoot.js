// Login needs only registration, not the 3D asset manifest and mesh catalog.
export async function registerAssetServiceWorker() {
    const serviceWorker = globalThis.navigator?.serviceWorker;
    if (!serviceWorker?.register) return null;
    return serviceWorker.register('./sw.js', {
        scope: './',
        updateViaCache: 'none'
    });
}
