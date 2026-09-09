import { earlyPreparationPlan } from './earlyPreparationPolicy.js';

test.each([['Fighter', 'strength'], ['Rogue', 'dexterity'], ['Wizard', 'intelligence'], ['Cleric', 'wisdom']])(
    '%s can spend only already-earned primary-stat points before specialization', (name, stat) => {
        expect(earlyPreparationPlan(name, 0)).toEqual({ stat, statAllocations: 0 });
        expect(earlyPreparationPlan(name, 3)).toEqual({ stat, statAllocations: 3 });
        expect(earlyPreparationPlan(name, 20)).toEqual({ stat, statAllocations: 5 });
        expect(earlyPreparationPlan(name, 20, 1)).toEqual({ stat, statAllocations: 1 });
        expect(earlyPreparationPlan(name, 20, 20)).toEqual({ stat, statAllocations: 20 });
        expect(earlyPreparationPlan(name, 20, 25)).toEqual({ stat, statAllocations: 20 });
    });
test.each([-1, 1.5, NaN, Infinity])('rejects invalid point budget %p', points => {
    expect(() => earlyPreparationPlan('Wizard', points)).toThrow();
    expect(() => earlyPreparationPlan('Wizard', 5, points)).toThrow();
});
test('does not invent preparation for another actor type', () => {
    expect(() => earlyPreparationPlan('Skeleton', 5)).toThrow();
});
