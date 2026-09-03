import {
    getAssetPackEstimateMb,
    getRecommendedAssetPackNames
} from '../src/assets/assetManifest.js';

describe('asset manifest sizing and recommendations', () => {
    test('needs no recommended downloads after the procedural cutover', () => {
        expect(getRecommendedAssetPackNames()).toEqual([]);
    });

    test('returns readable size estimates for known packs', () => {
        expect(getAssetPackEstimateMb('core-models')).toMatch(/MB$/);
        expect(getAssetPackEstimateMb('core-models')).toBe('0 MB');
        expect(getAssetPackEstimateMb('dungeon-models')).toMatch(/MB$/);
        expect(getAssetPackEstimateMb('environment-textures')).toBe('0 MB');
    });
});
