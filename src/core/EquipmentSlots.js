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
        item.type === 'WEAPON' && item.slot === 'mainHand' && slot === 'offHand' ||
        item.slot === 'ring' && ['ring1', 'ring2'].includes(slot) ||
        item.slot === 'trinket' && ['trinket1', 'trinket2'].includes(slot));
}
// Older real-slot gear can omit a slot/type descriptor. Preserve that gear;
// new equip requests still require an explicit matching, supported item slot.
export const isActiveEquipment = (slot, item, actorClass) => Boolean(slots.has(slot) && equipmentType(item) &&
    (!item.slot || itemFitsEquipmentSlot(item, slot)) && classAllowsEquipment(actorClass, item, slot));

const armorFamilies = {
    cloth: ['Silk Hood', 'Robes', 'Silk Skirt', 'Sandals', 'Silk Gloves', 'Velvet Mantle', 'Silk Sash'],
    leather: ['Leather Cap', 'Leather Tunic', 'Leather Pants', 'Leather Boots', 'Leather Gloves', 'Reinforced Spaulders', 'Studded Belt'],
    plate: ['Iron Helm', 'Plate Mail', 'Plate Greaves', 'Iron Boots', 'Iron Gauntlets', 'Steel Pauldrons', 'Plated Girdle']
};
const armorSlots = new Set(['head', 'chest', 'legs', 'feet', 'gloves', 'shoulders', 'belt']);
const hasBase = (item, base) => (item?.equipmentBaseName || item?.baseName || item?.name || '').includes(base);
// Use the same canonical families as class eligibility, including decorated
// names and explicit base names. Never guess a material for unknown legacy gear.
export function getEquipmentTypeLabel(item) {
    if (!isEquippableItem(item)) return '';
    if (armorSlots.has(item.slot)) {
        for (const [family, bases] of Object.entries(armorFamilies)) {
            if (bases.some(base => hasBase(item, base))) return family[0].toUpperCase() + family.slice(1);
        }
    }
    for (const [base, label] of [['Iron Sword', 'Sword'], ['Steel Dagger', 'Dagger'],
        ['Cleric Mace', 'Mace'], ['Wooden Staff', 'Staff'], ['Wooden Shield', 'Shield'], ['Spell Tome', 'Tome']]) {
        if (hasBase(item, base)) return label;
    }
    return ({ WEAPON: 'Weapon', ARMOR: 'Armor', GLOVES: 'Armor', ACCESSORY: 'Accessory', NECK: 'Accessory' })[item.type] || 'Equipment';
}
export function classAllowsEquipment(actorClass, item, slot = item?.slot) {
    if (!item || !['Fighter', 'Cleric', 'Wizard', 'Rogue'].includes(actorClass)) return true;
    if (actorClass === 'Rogue' && slot === 'offHand' && item.type !== 'WEAPON') return false;
    if (actorClass === 'Rogue' && hasBase(item, 'Wooden Staff')) return false;
    if (armorSlots.has(slot)) {
        if (actorClass === 'Wizard' && [...armorFamilies.leather, ...armorFamilies.plate].some(base => hasBase(item, base))) return false;
        if (actorClass === 'Rogue' && armorFamilies.plate.some(base => hasBase(item, base))) return false;
    }
    // Unknown legacy gear is retained, not destroyed or assigned a guessed family.
    return true;
}
export function canEquipItem(actorClass, item, slot) {
    return itemFitsEquipmentSlot(item, slot) && classAllowsEquipment(actorClass, item, slot);
}
export function isDualWieldingRogue(actorClass, equipment = {}) {
    return actorClass === 'Rogue' && ['mainHand', 'offHand'].every(slot =>
        equipment[slot]?.type === 'WEAPON' && isActiveEquipment(slot, equipment[slot], actorClass));
}
