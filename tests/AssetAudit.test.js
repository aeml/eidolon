import { findBrokenRecipeAliases, findDuplicatePreloadPaths, summarizeAssetAudit } from '../src/utils/AssetAudit.js';

describe('AssetAudit', () => {
    test('preload path manifest has no duplicates', () => {
        expect(findDuplicatePreloadPaths()).toEqual([]);
    });

    test('recipe aliases have no unresolved legacy dependency', () => {
        expect(findBrokenRecipeAliases()).toEqual([]);
        expect(findBrokenRecipeAliases({
            SharedNpc: { type: 'npc' },
            AliasNpc: { type: 'npc', alias: 'SharedNpc' }
        })).toEqual([]);
        expect(findBrokenRecipeAliases({
            AliasNpc: { type: 'npc', alias: 'MissingNpc' }
        })).toEqual([{ name: 'AliasNpc', alias: 'MissingNpc', resolved: false }]);
    });

    test('summary reports a non-empty audited preload manifest', () => {
        const summary = summarizeAssetAudit();
        expect(summary.preloadCount).toBeGreaterThan(0);
        expect(summary.duplicatePreloads).toEqual([]);
        expect(summary.brokenAliases).toEqual([]);
    });
});
