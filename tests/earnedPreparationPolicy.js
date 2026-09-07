// QA planning only. Purchases still use ordinary UI actions and server-owned
// points; this never grants equipment, levels, ranks or unlocked abilities.
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
