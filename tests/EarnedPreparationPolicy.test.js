import { earnedWizardPreparationBudget } from './earnedPreparationPolicy.js';

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
