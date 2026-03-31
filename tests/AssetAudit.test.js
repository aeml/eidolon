import { findBrokenRecipeAliases, findDuplicatePreloadPaths, summarizeAssetAudit } from '../src/utils/AssetAudit.js';

describe('AssetAudit', () => {
    test('preload path manifest has no duplicates', () => {
        expect(findDuplicatePreloadPaths()).toEqual([]);
    });

    test('recipe aliases resolve to an implemented quest-man loader recipe', () => {
        expect(findBrokenRecipeAliases()).toEqual([]);
    });

    test('summary reports a non-empty audited preload manifest', () => {
        const summary = summarizeAssetAudit();
        expect(summary.preloadCount).toBeGreaterThan(0);
        expect(summary.duplicatePreloads).toEqual([]);
        expect(summary.brokenAliases).toEqual([]);
    });
});
