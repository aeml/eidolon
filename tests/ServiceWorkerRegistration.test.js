import { jest } from '@jest/globals';

describe('asset service worker bootstrapping', () => {
    test('main boot path can request service worker registration without crashing', async () => {
        const register = jest.fn(async () => ({ scope: './' }));
        Object.defineProperty(globalThis, 'navigator', {
            configurable: true,
            value: {
                serviceWorker: {
                    register
                }
            }
        });

        const { AssetCacheManager } = await import('../src/assets/AssetCacheManager.js');
        await expect(AssetCacheManager.registerServiceWorker()).resolves.toEqual(expect.objectContaining({ scope: './' }));
        expect(register).toHaveBeenCalledWith('./sw.js', {
            scope: './',
            updateViaCache: 'none'
        });
    });
});
