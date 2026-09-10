import { planEarnedEquipmentUpgrade } from './earnedEquipmentUpgrades.js';

// Same conservative class preferences as carried gear, never a new game rule.
// Inspect the opened stash first; missing storage is not verified empty storage.
export function planEarnedStashUpgrade(state) {
    if (!Array.isArray(state.stash)) throw new Error('Opened stash contents are required');
    const best = planEarnedEquipmentUpgrade({ ...state, inventory: [...state.inventory, ...state.stash] });
    if (!best || !state.stash.some(item => item?.id === best.id) ||
        state.inventory.some(item => item?.id === best.id)) return null;
    return { ...best, blockedByFullBag: !state.inventory.some(item => !item?.id) };
}
