import { MeshCatalog } from '../utils/MeshCatalog.js';

const DEFAULT_ASSET_VERSION = '2026-09-02-15';

const ASSET_VERSION_OVERRIDES = {
    './assets/buildings/dungeons/the_verdant_bastion.glb': 'dungeon-verdant-v2'
};

const ASSET_PACKS = {
    'core-models': MeshCatalog.getStartupPreloadModelPaths(),
    'dungeon-models': MeshCatalog.getBackgroundPreloadModelPaths(),
    'environment-textures': [
        './assets/backgrounds/underground.png',
        './assets/backgrounds/water_texture.png',
        './assets/backgrounds/ground_texture.png',
        './assets/backgrounds/abyssal_well_floor.png',
        './assets/backgrounds/cobblestone.png',
        './assets/backgrounds/cobblestone_walls.png'
    ]
};

const ASSET_PACK_SIZE_ESTIMATES_MB = {
    'core-models': 0,
    'dungeon-models': 71,
    'environment-textures': 9
};

const RECOMMENDED_ASSET_PACKS = ['environment-textures'];

function shouldVersionAsset(path) {
    return typeof path === 'string' && /^\.\/assets\//.test(path);
}

function getAssetVersion(path) {
    return ASSET_VERSION_OVERRIDES[path] || DEFAULT_ASSET_VERSION;
}

function resolveAssetPath(path) {
    if (!shouldVersionAsset(path)) {
        return path;
    }

    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}v=${getAssetVersion(path)}`;
}

function getAssetPack(name) {
    if (!Object.prototype.hasOwnProperty.call(ASSET_PACKS, name)) return null;
    const assets = Array.from(new Set(ASSET_PACKS[name] || []));
    return { name, assets };
}

function getAssetPackNames() {
    return Object.keys(ASSET_PACKS);
}

function getAssetPackEntries(name) {
    const pack = getAssetPack(name);
    if (!pack) return [];
    return pack.assets.map((path) => ({
        path,
        version: getAssetVersion(path),
        versionedPath: resolveAssetPath(path)
    }));
}

function getAssetPackEstimateMb(name) {
    const estimate = ASSET_PACK_SIZE_ESTIMATES_MB[name];
    return typeof estimate === 'number' ? `${estimate} MB` : 'Unknown size';
}

function getRecommendedAssetPackNames() {
    return [...RECOMMENDED_ASSET_PACKS];
}

function getVersionedAssetManifest() {
    const packs = Object.fromEntries(
        getAssetPackNames().map((name) => [
            name,
            getAssetPackEntries(name).map((entry) => entry.versionedPath)
        ])
    );

    return {
        version: DEFAULT_ASSET_VERSION,
        cacheName: `eidolon-assets-${DEFAULT_ASSET_VERSION}`,
        packs
    };
}

export {
    ASSET_PACKS,
    ASSET_PACK_SIZE_ESTIMATES_MB,
    ASSET_VERSION_OVERRIDES,
    DEFAULT_ASSET_VERSION,
    RECOMMENDED_ASSET_PACKS,
    getAssetPack,
    getAssetPackEntries,
    getAssetPackEstimateMb,
    getAssetPackNames,
    getAssetVersion,
    getRecommendedAssetPackNames,
    getVersionedAssetManifest,
    resolveAssetPath,
    shouldVersionAsset
};
