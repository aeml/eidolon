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
    return getWizardAbilityAreaRadius(player, getAbilityRange(player, 'Flame Whip', 12));
}

export function getWizardAbilityAreaRadius(player, base) {
    return getAbilityAreaRadius(player, 'Wizard', base);
}

export function getAbilityAreaRadius(player, className, base) {
    let areaBonus = 0;
    for (const talent of CONSTANTS.PASSIVE_TALENTS[className] || []) {
        if (!talent.abilityArea) continue;
        const raw = Number(player?.talentRanks?.[talent.id] || 0);
        const rank = Number.isFinite(raw) ? Math.max(0, Math.min(talent.maxRank, Math.floor(raw))) : 0;
        areaBonus += talent.abilityArea.radius * rank;
    }
    return base * Math.max(0, 1 + areaBonus);
}

export const WIZARD_GROUND_ABILITIES = new Set(['Gravity Well', 'Meteor Drop', 'Inferno Cataclysm']);

export function getWizardGroundCastRange(player, skillName) {
    return getAbilityRange(player, skillName, skillName === 'Gravity Well' ? 18 : 20);
}

// Ground placement range does not grow with the radius of the resulting area.
export function clampWizardGroundTarget(player, skillName, target) {
    const result = target.clone();
    const distance = Math.hypot(target.x - player.position.x, target.z - player.position.z);
    const range = getWizardGroundCastRange(player, skillName);
    if (distance > range) {
        result.x = player.position.x + (target.x - player.position.x) * range / distance;
        result.z = player.position.z + (target.z - player.position.z) * range / distance;
    }
    return result;
}

export function getRogueMovementCastRange(player, skillName) {
    let base = skillName === 'Backstab' ? 2.5 : 10;
    if (skillName === 'Shadow Lunge' && player?.skillRunes?.[skillName] === 'shadowlunge_extended') base = 15;
    return getAbilityRange(player, skillName, base);
}
