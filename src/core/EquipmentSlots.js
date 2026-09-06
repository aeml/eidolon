export const EQUIPMENT_SLOT_KEYS = Object.freeze(['head', 'chest', 'legs', 'feet', 'gloves',
    'shoulders', 'belt', 'neck', 'mainHand', 'offHand', 'ring1', 'ring2', 'trinket1', 'trinket2']);
const slots = new Set(EQUIPMENT_SLOT_KEYS);
const types = new Set(['WEAPON', 'ARMOR', 'ACCESSORY', 'NECK', 'GLOVES']);
const equipmentType = item => item && (!item.type || types.has(item.type));
export const isEquipmentSlot = slot => slots.has(slot);
export const isEquippableItem = item => Boolean(equipmentType(item) &&
    (slots.has(item.slot) || item.slot === 'ring' || item.slot === 'trinket'));
export function itemFitsEquipmentSlot(item, slot) {
    return isEquippableItem(item) && slots.has(slot) && (item.slot === slot ||
        item.slot === 'ring' && ['ring1', 'ring2'].includes(slot) ||
        item.slot === 'trinket' && ['trinket1', 'trinket2'].includes(slot));
}
// Older real-slot gear can omit a slot/type descriptor. Preserve that gear;
// new equip requests still require an explicit matching, supported item slot.
export const isActiveEquipment = (slot, item) => Boolean(slots.has(slot) && equipmentType(item) &&
    (!item.slot || itemFitsEquipmentSlot(item, slot)));
