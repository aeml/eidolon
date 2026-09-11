import { GEM_TYPES } from '../core/ItemSystem.js';

// Socket data may use canonical display names or the item system's enum keys.
// Unknown values remain neutral decoration, never a fabricated Ruby identity.
export function socketGemAppearanceName(gem) {
    const value = gem?.type || gem?.gemType;
    if (typeof value !== 'string') return null;
    return GEM_TYPES[value.toUpperCase()]?.name || null;
}
