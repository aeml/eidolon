// Convert a recorded client build into a disposable database fixture. No
// account identity or credentials live in the recorded build. This is not an
// earned replay/save receipt; only gear/stats/training/story gates are restored.
export function earnedBuildCharacter(record, name) {
    if (record.level !== 31 || record.sourceCommit !== '4b3991ffea239bb3152ea93263fbc0bbe95c05a3' ||
        Object.keys(record.equipment).length !== 14) throw new Error('Unexpected recorded earned build');
    const equipment = Object.fromEntries(Object.entries(record.equipment).map(([slot, item]) => {
        const { maxStack, statScaleVersion, rarity, ...rest } = JSON.parse(JSON.stringify(item));
        return [slot, { ...rest, rarity: rarity.name, max_stack: maxStack, stat_scale_version: statScaleVersion }];
    }));
    return { name, class: 'Wizard', level: record.level, xp: record.xp, progression_version: 2,
        gold: record.gold, x: -1.25, y: 0, z: 200, stats: { ...record.stats }, equipment,
        talent_ranks: { ...record.talentRanks }, selected_branch: record.selectedBranch,
        unlocked_skills: [...record.unlockedSkills], inventory: [], stash: [],
        quests: JSON.parse(JSON.stringify(record.quests)) };
}

export function requireIsolatedBuildFixture(env) {
    if (!/^eidolon-isolated-qa-mongo-[a-z0-9_.-]+$/.test(env.EIDOLON_E2E_BUILD_MONGO_CONTAINER || '') ||
        !/^\d+$/.test(env.EIDOLON_E2E_BUILD_MONGO_PORT || '') || env.EIDOLON_E2E_REGISTER !== '1' ||
        env.EIDOLON_E2E_EARNED_BUILD_DIAGNOSTIC !== '1' ||
        !/^ws:\/\/127\.0\.0\.1:\d+\/ws$/.test(env.EIDOLON_E2E_WS_URL || '')) {
        throw new Error('Recorded-build fixture requires explicit disposable local diagnostic');
    }
}
