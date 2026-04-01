import { jest } from '@jest/globals';
import { AssetCacheManager } from '../src/assets/AssetCacheManager.js';

describe('AssetCacheManager refresh outdated assets', () => {
    beforeEach(() => {
        global.caches = {
            keys: jest.fn(async () => ['eidolon-assets-legacy']),
            open: jest.fn(async () => ({
                match: jest.fn(async () => undefined),
                add: jest.fn(async () => undefined)
            })),
            delete: jest.fn(async () => true)
        };
        Object.defineProperty(globalThis, 'navigator', {
            configurable: true,
            value: {
                serviceWorker: {
                    controller: { postMessage: jest.fn() },
                    addEventListener: jest.fn(),
                    register: jest.fn(async () => ({ scope: './' }))
                }
            }
        });
    });

    test('finds stale packs from inspection results', async () => {
        const manager = new AssetCacheManager();
        jest.spyOn(manager, 'inspectPack').mockImplementation(async (packName) => ({
            packName,
            cached: false,
            cachedCount: packName === 'core-models' ? 0 : 1,
            total: 4,
            updateAvailable: packName !== 'core-models'
        }));

        const stale = await manager.getOutdatedPacks();

        expect(stale).toEqual(['dungeon-models', 'environment-textures']);
    });
});
