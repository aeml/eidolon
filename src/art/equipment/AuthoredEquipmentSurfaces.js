import * as THREE from 'three';
import { getEquipmentSurfaceMaps } from './EquipmentSurfaceMaps.js';

const namedSurfaces = new Map([
    ['Wrapped oxblood leather', 'leather'], ['Dark ashwood', 'wood'],
    ['Forged silver', 'metal'], ['Antique gold settings', 'metal'], ['Undersuit charcoal', 'cloth']
]);

// Exact names from the delivered catalog, not guesses based on rarity or item
// color. Keep crystals, luminous inlays, jewels, vellum and unknown materials.
export function authoredEquipmentSurface(name) {
    const family = /^(?:standard|legendary) (cloth|leather|wood|plate|holy) \| main$/.exec(name)?.[1];
    if (family) return ['plate', 'holy'].includes(family) ? 'metal' : family;
    if (/^(?:standard|legendary) (?:cloth|leather|wood|plate|holy) \| edges$/.test(name)) return 'metal';
    return namedSurfaces.get(name) || null;
}

export function applyAuthoredEquipmentSurface(material) {
    const surface = authoredEquipmentSurface(material.name);
    if (!surface || material.type !== 'MeshStandardMaterial' || material.transparent || material.opacity !== 1 ||
        material.emissive?.getHex() > 0 || Object.values(material).some(value => value?.isTexture) ||
        material.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile ||
        material.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey) return false;
    // Multiplicative maps retain supplied/appearance colors and PBR factors.
    // Shared, mip-filtered64px surfaces add no model downloads or frame work.
    Object.assign(material, getEquipmentSurfaceMaps(surface));
    material.userData.authoredEquipmentSurface = surface;
    return true;
}

// Batching accepts only the exact shared library maps on stock materials.
// An unrelated texture (including a later replacement) remains a boundary.
export function hasTrustedEquipmentSurfaceMaps(material) {
    const surface = material.userData.authoredEquipmentSurface;
    if (!['cloth', 'leather', 'wood', 'metal'].includes(surface)) return false;
    const maps = getEquipmentSurfaceMaps(surface);
    if (!['map', 'roughnessMap', 'bumpMap'].every(key => material[key] === maps[key])) return false;
    return Object.entries(material).every(([key, value]) => !value?.isTexture || maps[key] === value);
}
