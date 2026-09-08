const equipmentSlots = new Set(['head', 'chest', 'legs', 'feet', 'gloves', 'shoulders',
    'belt', 'neck', 'mainHand', 'offHand', 'ring', 'ring1', 'ring2', 'trinket', 'trinket1', 'trinket2']);

export function earnedEquipmentCandidates(inventory, equipment, level) {
    return inventory.filter(item => {
        if (!item?.id || !Number.isFinite(item.level) || item.level > level ||
            !equipmentSlots.has(item.slot) || ['MATERIAL', 'RELIC', 'GEM'].includes(item.type)) return false;
        const slots = item.slot === 'ring' ? ['ring1', 'ring2'] :
            item.slot === 'trinket' ? ['trinket1', 'trinket2'] : [item.slot];
        return slots.some(slot => !equipment[slot]?.id);
    }).map(({ id, slot, name }) => ({ id, slot, name }));
}
