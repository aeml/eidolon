import {
    getAbilityAoeArc,
    getAbilityAoeRadius,
    getProjectileImpactRadius,
    isAoeBoundaryVisualType,
    PLAYER_ABILITY_AOE_RADII
} from '../src/skills/abilityRadii.js';

describe('authoritative player ability visual radii', () => {
    test('Spirit Guardians covers base, boost, and Expanded boundaries', () => {
        const expanded = { skillRunes: { 'Spirit Guardians': 'spirits_expanded' } };

        expect(getAbilityAoeRadius('Cleric', 'Spirit Guardians')).toBe(16);
        expect(getAbilityAoeRadius('Cleric', 'Spirit Guardians Boost')).toBe(20);
        expect(getAbilityAoeRadius('Cleric', 'Spirit Guardians', expanded)).toBe(24);
        expect(getAbilityAoeRadius('Cleric', 'Spirit Guardians Boost', expanded)).toBe(30);
    });

    test('rune-dependent ground effects resolve their production sizes', () => {
        expect(getAbilityAoeRadius('Wizard', 'Gravity Well', {
            skillRunes: { 'Gravity Well': 'gravitywell_expanded' }
        })).toBe(12);
        expect(getAbilityAoeRadius('Cleric', 'Consecrated Ground', {
            skillRunes: { 'Consecrated Ground': 'consecratedground_expanded' }
        })).toBe(7.5);
        expect(getAbilityAoeRadius('Wizard', 'Meteor Drop', {
            skillRunes: { 'Meteor Drop': 'meteor_extinction' }
        })).toBe(39.6);
        expect(getAbilityAoeRadius('Cleric', 'Healing Light')).toBeNull();
        expect(getAbilityAoeRadius('Cleric', 'Healing Light', {
            skillRunes: { 'Healing Light': 'healinglight_beacon' }
        })).toBe(5);
    });

    test('remaining shockwaves, party auras, and cones match server geometry', () => {
        expect(getAbilityAoeRadius('Fighter', 'Charge')).toBe(16);
        expect(getAbilityAoeRadius('Fighter', 'Juggernaut Charge')).toBe(10);
        expect(getAbilityAoeRadius('Wizard', 'Time Warp')).toBe(15);
        expect(getAbilityAoeRadius('Cleric', 'Blessing of Resolve')).toBe(10);
        expect(getAbilityAoeRadius('Fighter', 'Shield Slam')).toBe(4);
        expect(getAbilityAoeArc('Fighter', 'Shield Slam')).toBe(Math.PI / 2);
        expect(getAbilityAoeRadius('Fighter', 'Sweeping Strike')).toBe(5);
        expect(getAbilityAoeArc('Fighter', 'Sweeping Strike')).toBe(Math.PI);
        expect(getAbilityAoeRadius('Wizard', 'Flame Whip')).toBe(12);
        expect(getAbilityAoeRadius('Cleric', 'Radiant Strike')).toBe(3);
        expect(getAbilityAoeArc('Cleric', 'Radiant Strike')).toBeCloseTo((2 * Math.PI) / 3);
    });

    test('replicated projectile impacts use the server damage boundary', () => {
        expect(getProjectileImpactRadius('Fireball')).toBe(10);
        expect(getProjectileImpactRadius('Meteor')).toBe(26.4);
        expect(getProjectileImpactRadius('Meteor', {
            skillRunes: { 'Meteor Drop': 'meteor_cluster' }
        }, 0.7)).toBe(15.84);
        expect(getProjectileImpactRadius('Meteor', {
            skillRunes: { 'Meteor Drop': 'meteor_extinction' }
        })).toBe(39.6);
        expect(getProjectileImpactRadius('Meteor', {
            skillRunes: { 'Meteor Drop': 'meteor_apocalypse' }
        }, 0.7)).toBe(18.48);
    });

    test('registry contains only finite positive boundaries used by radius-aware visuals', () => {
        for (const abilities of Object.values(PLAYER_ABILITY_AOE_RADII)) {
            for (const definition of Object.values(abilities)) {
                if (definition.base !== undefined) expect(definition.base).toBeGreaterThan(0);
                expect(definition.base !== undefined || Object.keys(definition.runes || {}).length > 0).toBe(true);
                Object.values(definition.runes || {}).forEach((radius) => {
                    expect(Number.isFinite(radius)).toBe(true);
                    expect(radius).toBeGreaterThan(0);
                });
            }
        }

        expect(isAoeBoundaryVisualType('ring')).toBe(true);
        expect(isAoeBoundaryVisualType('smoke_cloud')).toBe(true);
        expect(isAoeBoundaryVisualType('cone')).toBe(true);
        expect(isAoeBoundaryVisualType('sphere')).toBe(false);
    });
});
