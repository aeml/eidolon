import { earnedWizardPreparationBudget, earnedFighterPreparationBudget,
    earnedPreparationBudget, earnedPreparationProfile } from './earnedPreparationPolicy.js';
import { CONSTANTS } from '../src/core/Constants.js';

const state = { level: 16, statPoints: 30, talentPoints: 3, talentRanks: {} };
test('early preparation spends only earned points and does not require a locked shield', () => {
    expect(earnedWizardPreparationBudget(state)).toEqual({ statAllocations: 5,
        masteryPurchases: 3, currentMastery: 0, expectedSkills: ['Teleport'] });
});
test('later preparation tops up existing ranks without spending a second stat budget', () => {
    expect(earnedWizardPreparationBudget({ ...state, level: 27, talentPoints: 8,
        talentRanks: { WIZ_01: 3 } }, 0)).toEqual({ statAllocations: 0,
        masteryPurchases: 2, currentMastery: 3, expectedSkills: ['Teleport', 'Arcane Shield'] });
});
test('no available points or capped mastery means no purchase', () => {
    expect(earnedWizardPreparationBudget({ ...state, statPoints: 0, talentPoints: 0 })
        .statAllocations).toBe(0);
    expect(earnedWizardPreparationBudget({ ...state, talentRanks: { WIZ_01: 5 } })
        .masteryPurchases).toBe(0);
});
test('the ordinary specialization gate cannot be bypassed', () => {
    expect(() => earnedWizardPreparationBudget({ ...state, level: 9 })).toThrow('level 10');
});

test.each([
    [10, ['Whirlwind']], [19, ['Whirlwind']], [20, ['Whirlwind', 'Shield Slam']],
    [29, ['Whirlwind', 'Shield Slam']], [30, ['Whirlwind', 'Shield Slam', 'Iron Fortress']],
    [39, ['Whirlwind', 'Shield Slam', 'Iron Fortress']],
    [40, ['Whirlwind', 'Shield Slam', 'Iron Fortress', 'Guardian Roar']]
])('Fighter level %s follows earned specialization unlocks', (level, expectedSkills) => {
    expect(earnedFighterPreparationBudget({ ...state, level })).toEqual({
        statAllocations: 5, masteryPurchases: 3, currentMastery: 0, expectedSkills });
});
test('Fighter caps Whirlwind purchases and avoids a second stat spend', () => {
    expect(earnedPreparationBudget('Fighter', { ...state, talentPoints: 20, talentRanks: { FTR_03: 4 } }, 0))
        .toMatchObject({ statAllocations: 0, masteryPurchases: 1, currentMastery: 4 });
    expect(earnedFighterPreparationBudget({ ...state, talentRanks: { FTR_03: 5 } }).masteryPurchases).toBe(0);
    expect(earnedFighterPreparationBudget({ ...state, statPoints: 2, talentPoints: 0 }))
        .toMatchObject({ statAllocations: 2, masteryPurchases: 0 });
    expect(() => earnedFighterPreparationBudget({ ...state, level: 9 })).toThrow('level 10');
});
test.each(['Wizard', 'Fighter'])('%s profile points to its real mastery talent', className => {
    const profile = earnedPreparationProfile(className);
    expect(CONSTANTS.PASSIVE_TALENTS[className].find(talent => talent.id === profile.mastery))
        .toMatchObject({ name: profile.masteryLabel, maxRank: 5 });
    expect(earnedPreparationBudget(className, state)).toEqual(className === 'Wizard'
        ? earnedWizardPreparationBudget(state) : earnedFighterPreparationBudget(state));
});
test('unsupported earned classes are not silently given Wizard stats', () => {
    expect(() => earnedPreparationBudget('Rogue', state)).toThrow('No earned dungeon preparation');
});
