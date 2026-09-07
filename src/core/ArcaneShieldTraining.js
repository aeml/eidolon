import { CONSTANTS } from './Constants.js';

export function getArcaneShieldTraining(owner) {
    const className = owner?.meshType || owner?.subType || owner?.constructor?.name;
    let absorption = 0, duration = 0;
    for (const talent of CONSTANTS.PASSIVE_TALENTS[className] || []) {
        if (!talent.shieldTraining) continue;
        const raw = Number(owner.talentRanks?.[talent.id] || 0);
        const rank = Number.isFinite(raw) ? Math.max(0, Math.min(talent.maxRank, Math.floor(raw))) : 0;
        absorption += rank * (talent.shieldTraining.absorption || 0);
        duration += rank * (talent.shieldTraining.duration || 0);
    }
    const baseDuration = owner.skillRunes?.['Arcane Shield'] === 'arcaneshield_extended' ? 30 : 20;
    return { capacity: Math.floor((100 + 5 * owner.stats.intelligence) * (1 + absorption) + 1e-9),
        duration: Math.min(300, baseDuration * (1 + duration)) };
}
