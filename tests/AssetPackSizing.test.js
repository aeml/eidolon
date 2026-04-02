import {
    getAssetPackEstimateMb,
    getRecommendedAssetPackNames
} from '../src/assets/assetManifest.js';

describe('asset manifest sizing and recommendations', () => {
    test('exposes recommended asset packs for quick device setup', () => {
        expect(getRecommendedAssetPackNames()).toEqual(['core-models', 'environment-textures']);
    });

    test('returns readable size estimates for known packs', () => {
        expect(getAssetPackEstimateMb('core-models')).toMatch(/MB$/);
        expect(getAssetPackEstimateMb('dungeon-models')).toMatch(/MB$/);
        expect(getAssetPackEstimateMb('environment-textures')).toMatch(/MB$/);
    });
});
