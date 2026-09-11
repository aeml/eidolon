import { CONSTANTS } from '../core/Constants.js';

export function getSpellFocusCastMultiplier(source) {
    const talent = CONSTANTS.PASSIVE_TALENTS.Wizard.find(entry => entry.id === 'WIZ_15');
    const raw = Number(source?.talentRanks?.[talent.id] || 0);
    const rank = Number.isFinite(raw) ? Math.max(0, Math.min(talent.maxRank, Math.floor(raw))) : 0;
    return 2.5 * (1 + rank * talent.abilityDamage.damage);
}
