import { isEquippableItem } from '../src/core/EquipmentSlots.js';

// A storage decision, never a sale: invested gear retains all its metadata.
export function planPersistentQAStashSpare({ inventory, equipment, stash }, capacity = 100) {
    if (!Array.isArray(inventory) || !Array.isArray(stash) || !equipment ||
        !Number.isInteger(capacity) || capacity < 1 || stash.filter(item => item?.id).length >= capacity) return null;
    const worn = new Set(Object.values(equipment).map(item => item?.id).filter(Boolean));
    const index = inventory.findIndex(item => item?.id && !item.id.startsWith('chronicle-item-') &&
        !worn.has(item.id) && item.type && isEquippableItem(item) &&
        (item.stack || 1) === 1 && !(item.maxStack > 1) &&
        inventory.filter(other => other?.id === item.id).length === 1 &&
        !stash.some(other => other?.id === item.id));
    return index < 0 ? null : { index, item: inventory[index] };
}
