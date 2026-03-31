import { MeshCatalog } from './MeshCatalog.js';

export function findDuplicatePreloadPaths(paths = MeshCatalog.getPreloadModelPaths()) {
    const counts = new Map();
    for (const path of paths) {
        counts.set(path, (counts.get(path) || 0) + 1);
    }
    return [...counts.entries()]
        .filter(([, count]) => count > 1)
        .map(([path, count]) => ({ path, count }));
}

export function findBrokenRecipeAliases(recipes = MeshCatalog.recipes) {
    const aliases = [];
    for (const [name, recipe] of Object.entries(recipes)) {
        if (!recipe.alias) continue;
        const target = Object.entries(recipes).find(([, candidate]) => candidate.loader === 'loadQuestManModel');
        aliases.push({ name, alias: recipe.alias, resolved: Boolean(target) });
    }
    return aliases.filter((entry) => !entry.resolved);
}

export function summarizeAssetAudit() {
    return {
        preloadCount: MeshCatalog.getPreloadModelPaths().length,
        duplicatePreloads: findDuplicatePreloadPaths(),
        brokenAliases: findBrokenRecipeAliases()
    };
}
