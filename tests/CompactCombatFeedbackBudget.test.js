import { jest } from '@jest/globals';
import { COMPACT_COMBAT_FEEDBACK_LIMITS, isCompactCombatFeedback, limitCompactCombatFeedback } from '../src/core/CompactCombatFeedbackBudget.js';

const compact = { feedbackDensity: 'compact', feedbackKind: 'fighter_strike', sourceId: 'remote', targetId: 'enemy' };
const effect = (id, eligible = true, active = true) => ({ id, isCompactCombatFeedback: eligible, isActive: active, dispose: jest.fn() });

test('only remote compact decorative contacts are eligible', () => {
    expect(isCompactCombatFeedback('combat_feedback', compact, 'local')).toBe(true);
    expect(isCompactCombatFeedback('combat_feedback', compact)).toBe(true);
});

test.each(['telegraph', 'projectile_impact', 'ring', 'beam', 'eidolon_aid', 'impact'])('%s never enters the decorative quota', type => {
    expect(isCompactCombatFeedback(type, compact, 'local')).toBe(false);
});

test.each(['cleric_heal', 'restoration_tick', 'lifesteal', 'self_restore', 'lava_tick', 'wind_tick', 'future_warning'])('%s feedback stays protected even if compact', feedbackKind => {
    expect(isCompactCombatFeedback('combat_feedback', { ...compact, feedbackKind }, 'local')).toBe(false);
});

test.each([
    { feedbackDensity: 'full' }, { sourceId: 'local' }, { targetId: 'local' },
    { abilityName: 'Fireball' }, { projectileType: 'Fireball' },
    { authoritativeShape: true }, { radius: 6 }
])('local, full and gameplay-shape feedback remains protected: %j', protectedOptions => {
    expect(isCompactCombatFeedback('combat_feedback', { ...compact, ...protectedOptions }, 'local')).toBe(false);
});

test.each(['high', 'low'])('%s retains recent contacts and every interleaved essential effect', quality => {
    const limit = COMPACT_COMBAT_FEEDBACK_LIMITS[quality];
    const essential = ['boss-warning', 'local-hit', 'heal', 'spell-shape'].map(id => effect(id, false));
    const contacts = Array.from({ length: limit + 9 }, (_, id) => effect(id));
    const inactive = effect('expired', true, false);
    const effects = [essential[0], ...contacts.slice(0, 5), essential[1], inactive,
        ...contacts.slice(5), ...essential.slice(2)];
    limitCompactCombatFeedback(effects, quality);
    expect(effects.filter(value => value.isCompactCombatFeedback && value.isActive)).toEqual(contacts.slice(9));
    for (const value of essential) { expect(effects).toContain(value); expect(value.dispose).not.toHaveBeenCalled(); }
    contacts.forEach((value, index) => expect(value.dispose).toHaveBeenCalledTimes(index < 9 ? 1 : 0));
    expect(inactive.dispose).not.toHaveBeenCalled();
});

test('ordinary contact counts are unchanged; switching to Low applies its smaller decorative limit', () => {
    const contacts = Array.from({ length: 50 }, (_, id) => effect(id));
    const effects = [...contacts];
    limitCompactCombatFeedback(effects, 'high');
    expect(effects).toEqual(contacts);
    limitCompactCombatFeedback(effects, 'low');
    expect(effects).toEqual(contacts.slice(18));
    limitCompactCombatFeedback(effects, 'low');
    contacts.slice(0, 18).forEach(value => expect(value.dispose).toHaveBeenCalledTimes(1));
});
