import { isEquippableItem } from '../src/core/EquipmentSlots.js';
import { earnedGearScore } from './earnedEquipmentUpgrades.js';

export const EARNED_BAG_MIN_FREE = 5;
export const EARNED_BAG_TARGET_FREE = 8;
export const earnedBagFreeSlots = inventory => inventory.filter(item => !item?.id).length;

// Stash messages pad the client's array with nulls after a transfer. Its length
// is not occupancy; the rendered grid supplies capacity, actual item IDs usage.
export function earnedStashFreeSlots(stash, capacity) {
    if (!Array.isArray(stash) || !Number.isInteger(capacity) || capacity < 0) {
        throw new Error('Invalid observed stash capacity');
    }
    const occupied = stash.filter(item => item?.id).length;
    if (occupied > capacity) throw new Error('Observed stash exceeds rendered capacity');
    return capacity - occupied;
}

// A conservative ordinary-player baseline after filling empty equipment slots.
// Preserve quest/crafting items, Epic+ gear, invested gear and future upgrades.
// Obsolete unmodified Rares may be sold after ordinary spares, using the same
// class utility as equip preparation and a ten-level gap to every worn match.
// This is a disposable QA character's decision, not in-game automatic selling.
export function planEarnedBagSales({ inventory, equipment, level, className }, targetFree = EARNED_BAG_TARGET_FREE) {
    if (!Number.isInteger(targetFree) || targetFree < 0 || targetFree > inventory.length) throw new Error('Invalid bag space target');
    const needed = Math.max(0, targetFree - earnedBagFreeSlots(inventory));
    const equippedIds = new Set(Object.values(equipment).map(item => item?.id).filter(Boolean));
    const candidates = inventory.filter(item => {
        if (!item?.id || item.id.startsWith('chronicle-item-') || equippedIds.has(item.id) ||
            item.potency || item.sockets || item.gems?.length || item.setId || item.uniqueEffect ||
            !isEquippableItem(item) || !Number.isFinite(item.level) || item.level > level) return false;
        const slots = item.slot === 'ring' ? ['ring1', 'ring2'] :
            item.slot === 'trinket' ? ['trinket1', 'trinket2'] : [item.slot];
        if (!slots.every(slot => equipment[slot]?.id)) return false;
        const rarity = item.rarity?.name || item.rarity;
        if (['Common', 'Uncommon'].includes(rarity)) return true;
        if (rarity !== 'Rare' || !className || (item.stack || 1) !== 1 || item.maxStack > 1) return false;
        const score = earnedGearScore(item, className);
        return score !== null && slots.every(slot => {
            const worn = equipment[slot], wornScore = earnedGearScore(worn, className);
            return Number.isFinite(worn.level) && worn.level >= item.level + 10 &&
                wornScore !== null && wornScore > score;
        });
    }).map(item => ({ id: item.id, rarity: item.rarity?.name || item.rarity,
        value: Math.max(1, item.value || 0) * Math.max(1, item.stack || 0) }));
    const rarityOrder = ['Common', 'Uncommon', 'Rare'];
    candidates.sort((a, b) => rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity) ||
        a.value - b.value || a.id.localeCompare(b.id));
    return candidates.slice(0, needed);
}

// Consolidate existing stacks first, then preserve spare gear and bank other
// valuables. Quest fragments and consumables stay carried; no items are sold.
export function planEarnedBagStorage({ inventory, equipment, stash = [] }, targetFree = EARNED_BAG_TARGET_FREE) {
    if (!Number.isInteger(targetFree) || targetFree < 0 || targetFree > inventory.length) throw new Error('Invalid bag space target');
    const needed = Math.max(0, targetFree - earnedBagFreeSlots(inventory));
    const equippedIds = new Set(Object.values(equipment).map(item => item?.id).filter(Boolean));
    const gear = inventory.filter(item => {
        if (!item?.id || item.id.startsWith('chronicle-item-') || equippedIds.has(item.id) ||
            !isEquippableItem(item) || Math.max(1, item.stack || 1) !== 1 || item.maxStack > 1) return false;
        const slots = item.slot === 'ring' ? ['ring1', 'ring2'] :
            item.slot === 'trinket' ? ['trinket1', 'trinket2'] : [item.slot];
        return slots.every(slot => equipment[slot]?.id);
    });
    const valuables = inventory.filter(item => item?.id && !item.id.startsWith('chronicle-item-') &&
        !equippedIds.has(item.id) && ['GEM', 'MATERIAL', 'RELIC'].includes(item.type) &&
        Number.isInteger(item.stack) && item.stack > 0 && Number.isInteger(item.maxStack) && item.maxStack >= item.stack);
    const merged = [];
    let projected = stash.filter(item => item?.id);
    for (const item of valuables) {
        const next = expectedEarnedStashDeposit(projected, item);
        if (next.length === projected.length) {
            merged.push(item);
            projected = next;
        }
    }
    const mergedIds = new Set(merged.map(item => item.id));
    return [...merged, ...gear, ...valuables.filter(item => !mergedIds.has(item.id))]
        .slice(0, needed).map(item => ({ id: item.id, name: item.name }));
}

// Mirror the existing full-stack deposit semantics for read-only conservation
// assertions. Merged quantities retain the destination ID and metadata; overflow
// retains the source ID. This predicts evidence, never writes character state.
export function expectedEarnedStashDeposit(stash, item) {
    if (!Number.isInteger(item.stack) || item.stack < 1) throw new Error('Invalid deposit quantity');
    const result = stash.filter(entry => entry?.id).map(entry => ({ ...entry }));
    let remaining = item.stack;
    if (item.maxStack > 1) for (const entry of result) {
        if (entry.name !== item.name) continue;
        entry.maxStack = Math.max(entry.maxStack || 0, item.maxStack);
        if (!entry.icon && item.icon) entry.icon = item.icon;
        const amount = Math.min(remaining, Math.max(0, entry.maxStack - entry.stack));
        entry.stack += amount;
        remaining -= amount;
        if (!remaining) break;
    }
    if (remaining) result.push({ ...item, stack: remaining });
    return result;
}
