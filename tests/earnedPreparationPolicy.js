// QA planning only. Purchases still use ordinary UI actions and server-owned
// points; this never grants equipment, levels, ranks or unlocked abilities.
export function earnedPreparationProfile(className) {
    if (className === 'Wizard') return { stat: 'intelligence', branch: 'C',
        branchLabel: 'Control & Utility', mastery: 'WIZ_01', masteryLabel: 'Fireball - Mastery' };
    if (className === 'Fighter') return { stat: 'strength', branch: 'A',
        branchLabel: 'Shield & Mitigation', mastery: 'FTR_03', masteryLabel: 'Whirlwind - Mastery' };
    throw new Error(`No earned dungeon preparation for ${className}`);
}

export function earnedFighterPreparationBudget(state, statBudget = 5) {
    if (state.level < 10) throw new Error('Earned specialization requires level 10');
    const currentMastery = state.talentRanks?.FTR_03 || 0;
    return {
        statAllocations: Math.min(statBudget, state.statPoints),
        masteryPurchases: Math.min(Math.max(0, 5 - currentMastery), state.talentPoints),
        currentMastery,
        expectedSkills: [[10, 'Whirlwind'], [20, 'Shield Slam'], [30, 'Iron Fortress'], [40, 'Guardian Roar']]
            .filter(([level]) => state.level >= level).map(([, skill]) => skill)
    };
}

export function earnedPreparationBudget(className, state, statBudget = 5) {
    earnedPreparationProfile(className); // Fail closed for unimplemented classes.
    return className === 'Fighter' ? earnedFighterPreparationBudget(state, statBudget)
        : earnedWizardPreparationBudget(state, statBudget);
}

export function earnedWizardPreparationBudget(state, statBudget = 5) {
    if (state.level < 10) throw new Error('Earned specialization requires level 10');
    const currentMastery = state.talentRanks?.WIZ_01 || 0;
    return {
        statAllocations: Math.min(statBudget, state.statPoints),
        masteryPurchases: Math.min(Math.max(0, 5 - currentMastery), state.talentPoints),
        currentMastery,
        expectedSkills: ['Teleport', ...(state.level >= 20 ? ['Arcane Shield'] : [])]
    };
}
