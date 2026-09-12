import { CONSTANTS } from '../core/Constants.js';

// Shared with Focus consumption. Utility spells own separate training consumers.
export const WIZARD_DAMAGE_SKILLS = new Set(['Fireball', 'Flame Whip', 'Flame Tornado',
    'Meteor Drop', 'Inferno Cataclysm', 'Scorch Beam', 'Arcane Missiles',
    'Dragonfire Lance', 'Gravity Well', 'Frost Nova']);

// Paired with actual authoritative casts through testdata/wizard_damage.json.
// Keep rune/critical/recipient modifiers outside this base-damage boundary.
export const WIZARD_DAMAGE_PROFILES = Object.freeze(Object.fromEntries([
    ['Fireball', 20, 2], ['Flame Whip', 25, 2], ['Flame Tornado', 30, 3],
    ['Meteor Drop', 50, 3], ['Inferno Cataclysm', 30, 1], ['Scorch Beam', 25, 2],
    ['Arcane Missiles', 15, 1], ['Dragonfire Lance', 100, 5], ['Gravity Well', 20, 1]
].map(([skill, base, intelligence]) => [skill, Object.freeze({ base, intelligence })])));

export function resolveWizardSpellDamage(source, skill, multiplier = 1) {
    // Preserve Wizard's existing legacy Fireball fallback for unprofiled skills.
    const profile = WIZARD_DAMAGE_PROFILES[skill] || WIZARD_DAMAGE_PROFILES.Fireball;
    return Math.trunc((profile.base + source.stats.intelligence * profile.intelligence) * multiplier);
}

// Snapshot named Mastery once at paid cast time. Projectiles/zones retain this
// amount; criticals, runes, shields and other receiver effects still own their
// existing impact boundaries. This helper neither reads nor consumes Focus.
export function getWizardAbilityDamageMultiplier(source, skill) {
    const className = source?.meshType || source?.subType || source?.constructor?.name;
    if (className !== 'Wizard' || source.isRemote || source.isMultiplayer ||
        source.gameEngine?.isMultiplayer || !WIZARD_DAMAGE_SKILLS.has(skill)) return 1;
    let bonus = 0;
    for (const talent of CONSTANTS.PASSIVE_TALENTS.Wizard) {
        const effect = talent.abilityDamage;
        if (!effect || effect.skill !== skill) continue;
        const [prefix, number] = talent.id.split('_');
        let rank = 0;
        for (const id of new Set([talent.id, `${prefix}_${Number(number)}`])) {
            const raw = Number(source.talentRanks?.[id] || 0);
            if (Number.isFinite(raw)) rank = Math.max(rank, Math.min(talent.maxRank, Math.floor(raw)));
        }
        bonus += effect.damage * rank;
    }
    return 1 + bonus;
}
