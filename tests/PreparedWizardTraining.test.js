import { preparedWizardTraining } from './preparedWizardTraining.js';

test('prepared build uses damage, general efficiency and Fireball efficiency within existing points', () => {
    expect(preparedWizardTraining({ talentPoints: 20 })).toEqual([
        { id: 'WIZ_01', name: 'Fireball - Mastery', initialRank: 0, purchases: 5 },
        { id: 'WIZ_27', name: 'Efficient Casting', initialRank: 0, purchases: 5 },
        { id: 'WIZ_02', name: 'Fireball - Technique', initialRank: 0, purchases: 5 }
    ]);
});
test.each([0, 1, 4, 5, 7, 10, 12, 15, 20])('point budget %s is never overspent', talentPoints => {
    const state = { talentPoints, talentRanks: { WIZ_01: 3, WIZ_27: 5, WIZ_02: 1, WIZ_20: 4 } };
    const before = JSON.stringify(state);
    const plan = preparedWizardTraining(state);
    expect(plan.reduce((sum, talent) => sum + talent.purchases, 0)).toBe(Math.min(talentPoints, 6));
    expect(plan.map(talent => talent.initialRank + talent.purchases).every(rank => rank <= 5)).toBe(true);
    expect(plan[1].purchases).toBe(0);
    expect(JSON.stringify(state)).toBe(before);
});
test.each([-1, 1.5, NaN, undefined])('invalid point budget %s fails closed', talentPoints => {
    expect(() => preparedWizardTraining({ talentPoints })).toThrow('Invalid talent point budget');
});
test.each([-1, 6, 1.5, '3', NaN])('invalid existing rank %s is not reset or overwritten', rank => {
    expect(() => preparedWizardTraining({ talentPoints: 20, talentRanks: { WIZ_01: rank } }))
        .toThrow('Invalid prepared talent');
});
