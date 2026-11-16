// QA planning only. Purchases still use ordinary UI actions and server-owned
// points; this never grants equipment, levels, ranks or unlocked abilities.
export function earnedPreparationProfile(className) {
    if (className === 'Wizard') return { stat: 'intelligence', branch: 'C',
        branchLabel: 'Control & Utility', mastery: 'WIZ_01', masteryLabel: 'Fireball - Mastery' };
    if (className === 'Fighter') return { stat: 'strength', branch: 'A',
        branchLabel: 'Shield & Mitigation', mastery: 'FTR_03', masteryLabel: 'Whirlwind - Mastery' };
    if (className === 'Rogue') return { stat: 'dexterity', branch: 'C',
        branchLabel: 'Utility / Debuff Path', mastery: 'ROG_01', masteryLabel: 'Piercing Throw - Mastery' };
    if (className === 'Cleric') return { stat: 'wisdom', branch: 'A',
        branchLabel: 'Pure Healer Path', mastery: 'CLR_03', masteryLabel: 'Healing Light - Mastery' };
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
    const profile = earnedPreparationProfile(className); // Fail closed for unknown classes.
    if (className === 'Rogue' || className === 'Cleric') {
        if (state.level < 10) throw new Error('Earned specialization requires level 10');
        const currentMastery = state.talentRanks?.[profile.mastery] || 0;
        const skills = className === 'Rogue' ? ['Smoke Bomb', 'Poison Coating', 'Tripwire', 'Cloak & Vanish']
            : ['Healing Light', 'Guardian Embrace', 'Purifying Wave', 'Divine Intervention'];
        return { statAllocations: Math.min(statBudget, state.statPoints),
            masteryPurchases: Math.min(Math.max(0, 5 - currentMastery), state.talentPoints),
            currentMastery, expectedSkills: skills.filter((_, index) => state.level >= (index + 1) * 10) };
    }
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
