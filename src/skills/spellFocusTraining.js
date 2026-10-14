import { CONSTANTS } from '../core/Constants.js';

export function getSpellFocusCastMultiplier(source) {
    const talent = CONSTANTS.PASSIVE_TALENTS.Wizard.find(entry => entry.id === 'WIZ_15');
    const raw = Number(source?.talentRanks?.[talent.id] || 0);
    const rank = Number.isFinite(raw) ? Math.max(0, Math.min(talent.maxRank, Math.floor(raw))) : 0;
    return 2.5 * (1 + rank * talent.abilityDamage.damage);
}

export function getSpellFocusCastPlan(source) {
    const trained = getSpellFocusCastMultiplier(source), rune = source?.skillRunes?.['Spell Focus'];
    const plan = { runeId: '', charges: 1, multiplier: trained, wardScale: 1 };
    if (rune === 'spellfocus_reservoir') {
        plan.runeId = rune; plan.charges = 2; plan.multiplier = 1 + (trained - 1) / 2;
    } else if (rune === 'spellfocus_aegis') {
        plan.runeId = rune; plan.wardScale = 2; plan.multiplier = 1 + (trained - 1) * .6;
    } else if (rune === 'spellfocus_overchannel') {
        plan.runeId = rune; plan.wardScale = 0; plan.multiplier = 1 + (trained - 1) * 1.25;
    }
    return plan;
}

export function consumeOfflineSpellFocus(source) {
    const count = source.spellFocusRuneId === 'spellfocus_reservoir' && source.spellFocusCharges === 2 ? 2 : 1;
    source.spellFocusCharges = count - 1;
    if (!source.spellFocusCharges) {
        source.spellFocusActive = false; source.spellFocusTimer = 0;
        source.spellFocusMultiplier = 1; source.spellFocusRuneId = '';
    }
}
