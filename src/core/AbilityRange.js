import { CONSTANTS } from './Constants.js';

export function getAbilityRange(player, skillName, baseRange) {
    const className = player?.meshType || player?.subType || player?.constructor?.name;
    let bonus = 0;
    for (const talent of CONSTANTS.PASSIVE_TALENTS[className] || []) {
        const effect = talent.abilityRange;
        if (!effect || effect.skill && effect.skill !== skillName) continue;
        const raw = Number(player?.talentRanks?.[talent.id] || 0);
        const rank = Number.isFinite(raw) ? Math.max(0, Math.min(talent.maxRank, Math.floor(raw))) : 0;
        bonus += effect.range * rank;
    }
    return baseRange * Math.max(0, 1 + bonus);
}

export function getTeleportCastRange(player) {
    const base = player?.skillRunes?.Teleport === 'teleport_blink' ? 22.5 : 15;
    return getAbilityRange(player, 'Teleport', base);
}

export function getFlameWhipRadius(player) {
    let areaBonus = 0;
    for (const talent of CONSTANTS.PASSIVE_TALENTS.Wizard) {
        if (!talent.abilityArea) continue;
        const raw = Number(player?.talentRanks?.[talent.id] || 0);
        const rank = Number.isFinite(raw) ? Math.max(0, Math.min(talent.maxRank, Math.floor(raw))) : 0;
        areaBonus += talent.abilityArea.radius * rank;
    }
    return getAbilityRange(player, 'Flame Whip', 12) * Math.max(0, 1 + areaBonus);
}

export function getRogueMovementCastRange(player, skillName) {
    let base = skillName === 'Backstab' ? 2.5 : 10;
    if (skillName === 'Shadow Lunge' && player?.skillRunes?.[skillName] === 'shadowlunge_extended') base = 15;
    return getAbilityRange(player, skillName, base);
}
