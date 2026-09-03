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
        // Meteor's server-side visual radius is 1.65x its damage radius.
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
    const definition = PLAYER_ABILITY_AOE_RADII[className]?.[canonicalSkillName];
    if (!definition) return null;

    const runeSkill = definition.runeSkill || canonicalSkillName;
    const runeId = source?.skillRunes?.[runeSkill] || null;
    const runeRadius = runeId ? definition.runes?.[runeId] : null;
    const radius = Number.isFinite(runeRadius) ? runeRadius : definition.base;
    return Number.isFinite(radius) && radius > 0 ? radius : null;
}

export function getAbilityAoeArc(className, canonicalSkillName) {
    const arc = PLAYER_ABILITY_AOE_RADII[className]?.[canonicalSkillName]?.arc;
    return Number.isFinite(arc) && arc > 0 ? arc : null;
}

export function isAoeBoundaryVisualType(type) {
    return AOE_BOUNDARY_VISUAL_TYPES.has(type);
}

/**
 * Radius used by the impact burst for replicated explosive projectiles. The
 * server projectile does not currently transmit its collision radius, so the
 * visual derives the same rune-specific value from its replicated owner.
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
