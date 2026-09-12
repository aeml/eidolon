import { getAbilityAreaRadius, getFlameWhipRadius, getWizardAbilityAreaRadius, WIZARD_GROUND_ABILITIES } from '../core/AbilityRange.js';

// Only abilities whose server casts publish authoritative radius/arc are enrolled.
export const SELF_CENTERED_SHAPE_ABILITIES = new Set([
    'Purifying Wave', 'Guardian Embrace', 'Consecrated Ground',
    'Blessing of Resolve', 'Blessing of Zeal', "Heaven's Trumpet",
    'Spirit Guardians', 'Spirit Guardians Boost', 'Guardian Roar', 'Executioner Spin', 'Time Warp'
]);
export const AUTHORITATIVE_SHAPE_ABILITIES = new Set(['Teleport', 'Flame Whip', 'Radiant Strike', 'Healing Light', ...WIZARD_GROUND_ABILITIES, ...SELF_CENTERED_SHAPE_ABILITIES]);

/**
 * World-space radii for player ability presentations with a circular gameplay
 * boundary. These values mirror the authoritative Go ability implementation;
 * cast-range values in Constants.js are deliberately not used as AoE sizes.
 */
export const PLAYER_ABILITY_AOE_RADII = Object.freeze({
    Fighter: Object.freeze({
        Charge: Object.freeze({ base: 16 }),
        Whirlwind: Object.freeze({ base: 6 }),
        'Shield Slam': Object.freeze({ base: 4, arc: Math.PI / 2 }),
        'Guardian Roar': Object.freeze({ base: 15 }),
        'Sweeping Strike': Object.freeze({ base: 5, arc: Math.PI }),
        Earthshaker: Object.freeze({ base: 6 }),
        'Juggernaut Charge': Object.freeze({ base: 10 }),
        'Shattering Charge': Object.freeze({ base: 16 }),
        'Executioner Spin': Object.freeze({ base: 6 })
    }),
    Rogue: Object.freeze({
        'Death Spiral': Object.freeze({ base: 4 }),
        'Blade Storm': Object.freeze({ base: 10, arc: Math.PI / 2 }),
        'Smoke Bomb': Object.freeze({ base: 5 })
    }),
    Wizard: Object.freeze({
        'Flame Whip': Object.freeze({ base: 12, arc: Math.PI / 2 }),
        'Frost Nova': Object.freeze({ base: 8 }),
        'Flame Tornado': Object.freeze({ base: 3 }),
        // Meteor's server hit check and telegraph both use 1.65x authored Radius.
        'Meteor Drop': Object.freeze({
            base: 26.4,
            runes: Object.freeze({
                meteor_cluster: 15.84,
                meteor_extinction: 39.6
            })
        }),
        'Inferno Cataclysm': Object.freeze({ base: 12 }),
        'Gravity Well': Object.freeze({
            base: 8,
            runes: Object.freeze({ gravitywell_expanded: 12 })
        }),
        'Time Warp': Object.freeze({ base: 15 })
    }),
    Cleric: Object.freeze({
        'Radiant Strike': Object.freeze({ base: 3, arc: (2 * Math.PI) / 3 }),
        'Healing Light': Object.freeze({
            runes: Object.freeze({ healinglight_beacon: 5 })
        }),
        'Spirit Guardians': Object.freeze({
            base: 16,
            runes: Object.freeze({ spirits_expanded: 24 })
        }),
        'Guardian Embrace': Object.freeze({ base: 10 }),
        'Purifying Wave': Object.freeze({ base: 8 }),
        'Consecrated Ground': Object.freeze({
            base: 5,
            runes: Object.freeze({ consecratedground_expanded: 7.5 })
        }),
        'Spirit Guardians Boost': Object.freeze({
            base: 20,
            runeSkill: 'Spirit Guardians',
            runes: Object.freeze({ spirits_expanded: 30 })
        }),
        'Blessing of Resolve': Object.freeze({ base: 10 }),
        'Blessing of Zeal': Object.freeze({ base: 10 }),
        "Heaven's Trumpet": Object.freeze({ base: 12 })
    })
});

export const AOE_BOUNDARY_VISUAL_TYPES = Object.freeze(new Set([
    'ground_circle',
    'ring',
    'smoke_cloud',
    'spin',
    'telegraph',
    'wave',
    'cone',
    'cone_large'
]));

export function getAbilityAoeRadius(className, canonicalSkillName, source = null) {
    if (className === 'Wizard' && canonicalSkillName === 'Teleport') {
        return source?.skillRunes?.Teleport === 'teleport_warp' ? getWizardAbilityAreaRadius(source, 4) : null;
    }
    if (className === 'Wizard' && canonicalSkillName === 'Time Warp') return getWizardAbilityAreaRadius(source, 15);
    if (className === 'Wizard' && canonicalSkillName === 'Flame Whip') return getFlameWhipRadius(source);
    if (className === 'Cleric' && canonicalSkillName === 'Healing Light' && source?.healingLightMassRevival) return getAbilityAreaRadius(source, className, 20, canonicalSkillName);
    const definition = PLAYER_ABILITY_AOE_RADII[className]?.[canonicalSkillName];
    if (!definition) return null;

    const runeSkill = definition.runeSkill || canonicalSkillName;
    const runeId = source?.skillRunes?.[runeSkill] || null;
    const runeRadius = runeId ? definition.runes?.[runeId] : null;
    const radius = Number.isFinite(runeRadius) ? runeRadius : definition.base;
    if (className === 'Fighter' && ['Guardian Roar', 'Executioner Spin', 'Shattering Charge'].includes(canonicalSkillName)) return getAbilityAreaRadius(source, className, radius, canonicalSkillName);
    if (className === 'Cleric' && (SELF_CENTERED_SHAPE_ABILITIES.has(canonicalSkillName) || ['Radiant Strike', 'Healing Light'].includes(canonicalSkillName))) {
        return Number.isFinite(radius) && radius > 0 ? getAbilityAreaRadius(source, className, radius, canonicalSkillName) : null;
    }
    if (className === 'Wizard' && WIZARD_GROUND_ABILITIES.has(canonicalSkillName)) return getWizardAbilityAreaRadius(source, radius);
    return Number.isFinite(radius) && radius > 0 ? radius : null;
}

export function getAbilityAoeArc(className, canonicalSkillName, source = null) {
    if (className === 'Wizard' && canonicalSkillName === 'Teleport' && getAbilityAoeRadius(className, canonicalSkillName, source)) return 2 * Math.PI;
    if (className === 'Wizard' && canonicalSkillName === 'Time Warp') return 2 * Math.PI;
    if (className === 'Fighter' && ['Guardian Roar', 'Executioner Spin'].includes(canonicalSkillName)) return 2 * Math.PI;
    if (className === 'Cleric' && canonicalSkillName === 'Healing Light' && getAbilityAoeRadius(className, canonicalSkillName, source)) return 2 * Math.PI;
    if (className === 'Cleric' && SELF_CENTERED_SHAPE_ABILITIES.has(canonicalSkillName)) return 2 * Math.PI;
    if (className === 'Wizard' && WIZARD_GROUND_ABILITIES.has(canonicalSkillName)) return 2 * Math.PI;
    if (className === 'Wizard' && canonicalSkillName === 'Flame Whip' && source?.flameWhipNovaCascade) return 2 * Math.PI;
    const arc = PLAYER_ABILITY_AOE_RADII[className]?.[canonicalSkillName]?.arc;
    return Number.isFinite(arc) && arc > 0 ? arc : null;
}

export function isAoeBoundaryVisualType(type) {
    return AOE_BOUNDARY_VISUAL_TYPES.has(type);
}

/**
 * Legacy fallback for explosive projectile impacts. New Meteor replication
 * supplies its resolved impactRadius (including cast-time talents); callers
 * prefer that snapshot and use this owner/rune inference only when absent.
 */
export function getProjectileImpactRadius(projectileType, source = null, projectileScale = 1) {
    if (projectileType === 'Fireball') return 10;
    if (projectileType === 'ExplosiveTrap') return 6;
    if (projectileType !== 'Meteor') return null;

    const runeId = source?.skillRunes?.['Meteor Drop'] || null;
    if (runeId === 'meteor_cluster') return 15.84;
    if (runeId === 'meteor_extinction') return 39.6;
    if (runeId === 'meteor_apocalypse' && Number(projectileScale) < 1) return 18.48;
    return 26.4;
}
