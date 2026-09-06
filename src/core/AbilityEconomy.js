import { CONSTANTS } from './Constants.js';

export function getAbilityEconomyBonus(player, skillName) {
    const className = player?.meshType || player?.subType || player?.constructor?.name;
    let cdr = 0, manaReduction = 0;
    for (const talent of CONSTANTS.PASSIVE_TALENTS[className] || []) {
        const bonus = talent.abilityEconomy;
        if (!bonus || bonus.skill && bonus.skill !== skillName) continue;
        const raw = Number(player.talentRanks?.[talent.id] || 0);
        const rank = Number.isFinite(raw) ? Math.max(0, Math.min(talent.maxRank, Math.floor(raw))) : 0;
        cdr += (bonus.cdr || 0) * rank;
        manaReduction += (bonus.manaReduction || 0) * rank;
    }
    return { cdr, manaReduction };
}

export function getAbilityManaCost(player, skillName, baseCost) {
    const equipmentCost = Math.floor(baseCost * (1 - (player.stats?.manaCostReduction || 0)) + 1e-9);
    const { manaReduction } = getAbilityEconomyBonus(player, skillName);
    return Math.max(0, Math.floor(equipmentCost * (1 - manaReduction) + 1e-9));
}

export function getAbilityCooldown(player, skillName, baseCooldown) {
    const global = Math.max(0, Math.min(1, player.stats?.cooldownReduction || 0));
    const { cdr } = getAbilityEconomyBonus(player, skillName);
    return baseCooldown * (1 - global) * Math.max(0, 1 - cdr);
}
