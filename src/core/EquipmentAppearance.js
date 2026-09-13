import { isActiveEquipment, itemFitsEquipmentSlot } from './EquipmentSlots.js';

// Render-only copies. Equipment, tooltips, damage and upgrades retain the real
// item identity and stats; a cosmetic never creates a missing equipped item.
export function equipmentWithAppearances(equipment = {}, appearances = {}) {
    const rendered = { ...equipment };
    for (const [slot, look] of Object.entries(appearances || {})) {
        const item = equipment?.[slot];
        if (!item?.id || !isActiveEquipment(slot, item) || !look?.baseName ||
            !itemFitsEquipmentSlot({ slot: look.slot, type: 'ARMOR' }, slot)) continue;
        rendered[slot] = { ...item, baseName: look.baseName, name: look.baseName, rarity: look.rarity || 'Common' };
    }
    return rendered;
}
