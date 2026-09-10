import { EQUIPMENT_SLOT_KEYS, isEquippableItem, itemFitsEquipmentSlot } from '../src/core/EquipmentSlots.js';

// QA build preferences, NOT new game stats, item valuation or a balance model.
// Four primary-stat points supply one basic damage on the server. Retain health,
// mana and defense value too; item level/rarity alone never wins a comparison.
const shared = { strength: .25, dexterity: .25, intelligence: .5, wisdom: .5,
    vitality: 1, damage: 4, defense: 1, critChance: 1, cdr: 1, manaRegen: 1,
    moveSpeed: 1, allResist: 1, lifesteal: 1, poisonDamage: 0, fireDamage: 0,
    healingDone: 0, holyDamage: 0 };
const builds = {
    Fighter: { strength: 1 }, Rogue: { dexterity: 1, poisonDamage: 1 },
    Wizard: { intelligence: 1, fireDamage: 1 },
    Cleric: { wisdom: 1, healingDone: 1, holyDamage: 1 }
};

export function earnedGearScore(item, className) {
    if (!builds[className]) throw new Error(`No earned equipment build for ${className}`);
    if (!item?.id) return 0;
    // Do not pretend additive scores model set breakpoints or unique mechanics.
    if (item.setId || item.uniqueEffect || !item.stats || !Array.isArray(item.gems || [])) return null;
    const weights = { ...shared, ...builds[className] };
    let score = 0;
    for (const stats of [item.stats, ...(item.gems || []).map(gem => gem?.stats)]) {
        if (!stats || typeof stats !== 'object' || Array.isArray(stats)) return null;
        for (const [key, value] of Object.entries(stats)) {
            if (!Object.hasOwn(weights, key) || !Number.isFinite(value)) return null;
            score += value * weights[key];
        }
    }
    return score;
}

// Pick one strictly improving replacement; callers re-read replicated inventory
// after every action. Explicit paired slots avoid overwriting a stronger ring1.
export function planEarnedEquipmentUpgrade({ inventory, equipment, level, className }) {
    earnedGearScore(null, className); // Fail unknown classes even with an empty bag.
    const worn = new Set(Object.values(equipment).map(item => item?.id).filter(Boolean));
    let best = null;
    for (const item of inventory) {
        if (!item?.id || worn.has(item.id) || item.id.startsWith('chronicle-item-') ||
            !isEquippableItem(item) || !Number.isFinite(item.level) || item.level > level ||
            (item.stack || 1) !== 1 || item.maxStack > 1) continue;
        const score = earnedGearScore(item, className);
        if (score === null) continue;
        for (const slot of EQUIPMENT_SLOT_KEYS) {
            // Empty slots are handled by the existing verified fill operation.
            if (!equipment[slot]?.id || !itemFitsEquipmentSlot(item, slot)) continue;
            const previousScore = earnedGearScore(equipment[slot], className);
            if (previousScore === null || score <= previousScore) continue;
            const gain = score - previousScore;
            if (!best || gain > best.gain) best = { id: item.id, slot,
                previousId: equipment[slot].id, score, previousScore, gain };
        }
    }
    return best;
}
