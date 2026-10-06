const gearSlots = new Set(['head', 'chest', 'legs', 'feet', 'gloves', 'shoulders',
    'belt', 'ring', 'neck', 'trinket', 'mainHand', 'offHand']);

// A storage decision, never a sale: invested gear retains all its metadata.
export function planPersistentQAStashSpare({ inventory, equipment, stash }, capacity = 100) {
    if (!Array.isArray(inventory) || !Array.isArray(stash) || !equipment ||
        !Number.isInteger(capacity) || capacity < 1 || stash.filter(item => item?.id).length >= capacity) return null;
    const worn = new Set(Object.values(equipment).map(item => item?.id).filter(Boolean));
    const index = inventory.findIndex(item => item?.id && !item.id.startsWith('chronicle-item-') &&
        !worn.has(item.id) && ['ARMOR', 'WEAPON', 'ACCESSORY'].includes(item.type) && gearSlots.has(item.slot) &&
        (item.stack || 1) === 1 && !(item.maxStack > 1) &&
        inventory.filter(other => other?.id === item.id).length === 1 &&
        !stash.some(other => other?.id === item.id));
    return index < 0 ? null : { index, item: inventory[index] };
}
