import { isActiveEquipment, itemFitsEquipmentSlot } from './EquipmentSlots.js';
import { GARMENT_MODELS } from '../assets/garments.generated.js';

// Render-only copies. Individual slot looks require real equipment. A complete
// outfit has separate renderer metadata; equipment identity and stats stay real.
export function equipmentWithAppearances(equipment = {}, appearances = {}) {
    const rendered = { ...equipment };
    delete rendered.outfit;
    const outfit = appearances?.outfit;
    if (outfit?.slot === 'outfit' && outfit.rarity === 'Common' && GARMENT_MODELS.outfits[outfit.baseName]) {
        rendered.outfit = { ...outfit };
    }
    for (const [slot, look] of Object.entries(appearances || {})) {
        const item = equipment?.[slot];
        if (!item?.id || !isActiveEquipment(slot, item) || !look?.baseName ||
            !itemFitsEquipmentSlot({ slot: look.slot, type: look.slot === 'mainHand' ? 'WEAPON' : 'ARMOR' }, slot)) continue;
        rendered[slot] = { ...item, equipmentBaseName: item.baseName || item.name, baseName: look.baseName, name: look.baseName, rarity: look.rarity || 'Common' };
    }
    return rendered;
}
