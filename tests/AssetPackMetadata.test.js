import { jest } from '@jest/globals';
import { DEFAULT_ASSET_VERSION } from '../src/assets/assetManifest.js';
import { AssetCacheManager } from '../src/assets/AssetCacheManager.js';

describe('AssetCacheManager pack metadata', () => {
    beforeEach(() => {
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

    test('uses cached pack metadata version instead of only legacy cache names', async () => {
        global.caches = {
            keys: jest.fn(async () => [`eidolon-assets-${DEFAULT_ASSET_VERSION}`]),
            open: jest.fn(async (name) => {
                if (name.endsWith('-meta')) {
                    return {
                        match: jest.fn(async () => ({
                            json: async () => ({ packName: 'dungeon-models', version: 'older-pack-version' })
                        }))
                    };
                }
                return {
                    match: jest.fn(async () => ({ ok: true }))
                };
            })
        };

        const manager = new AssetCacheManager();
        const status = await manager.inspectPack('dungeon-models');

        expect(status.cachedVersion).toBe('older-pack-version');
        expect(status.updateAvailable).toBe(true);
    });
});
