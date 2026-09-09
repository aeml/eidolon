import { isEquippableItem } from '../src/core/EquipmentSlots.js';

export const EARNED_BAG_MIN_FREE = 5;
export const EARNED_BAG_TARGET_FREE = 8;
export const earnedBagFreeSlots = inventory => inventory.filter(item => !item?.id).length;

// A conservative ordinary-player baseline after filling empty equipment slots.
// Never dispose of quest fragments, crafting items, rare+ gear or future-level
// equipment. This is a QA decision policy, not automatic selling in the game.
export function planEarnedBagSales({ inventory, equipment, level }, targetFree = EARNED_BAG_TARGET_FREE) {
    if (!Number.isInteger(targetFree) || targetFree < 0 || targetFree > inventory.length) throw new Error('Invalid bag space target');
    const needed = Math.max(0, targetFree - earnedBagFreeSlots(inventory));
    const equippedIds = new Set(Object.values(equipment).map(item => item?.id).filter(Boolean));
    const candidates = inventory.filter(item => {
        if (!item?.id || item.id.startsWith('chronicle-item-') || equippedIds.has(item.id) ||
            !isEquippableItem(item) || !Number.isFinite(item.level) || item.level > level ||
            !['Common', 'Uncommon'].includes(item.rarity?.name || item.rarity)) return false;
        const slots = item.slot === 'ring' ? ['ring1', 'ring2'] :
            item.slot === 'trinket' ? ['trinket1', 'trinket2'] : [item.slot];
        return slots.every(slot => equipment[slot]?.id);
    }).map(item => ({ id: item.id, rarity: item.rarity?.name || item.rarity,
        value: Math.max(1, item.value || 0) * Math.max(1, item.stack || 0) }));
    candidates.sort((a, b) => (a.rarity === 'Common' ? 0 : 1) - (b.rarity === 'Common' ? 0 : 1) ||
        a.value - b.value || a.id.localeCompare(b.id));
    return candidates.slice(0, needed);
}
