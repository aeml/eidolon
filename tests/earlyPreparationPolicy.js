const primary = { Fighter: 'strength', Rogue: 'dexterity', Wizard: 'intelligence', Cleric: 'wisdom' };

export function earlyPreparationPlan(className, statPoints, requested = 5) {
    if (!Object.hasOwn(primary, className)) throw new Error(`No early preparation for ${className}`);
    if (!Number.isInteger(statPoints) || statPoints < 0 || !Number.isInteger(requested) || requested < 0) {
        throw new Error('Early preparation requires nonnegative integer point budgets');
    }
    return { stat: primary[className], statAllocations: Math.min(requested, statPoints) };
}
