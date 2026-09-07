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
