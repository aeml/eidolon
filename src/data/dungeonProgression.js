export const MAX_PLAYER_LEVEL = 100;
export const DUNGEON_UNLOCK_LEVEL = 30;
export const ENDGAME_DIFFICULTY_UNLOCK_LEVEL = MAX_PLAYER_LEVEL;
export const DUNGEON_RUN_LEVEL_BANDS = [30, 40, 50, 60, 70, 80, 90, 100];

export function canAccessDungeon(playerLevel) {
    return Number(playerLevel) >= DUNGEON_UNLOCK_LEVEL;
}

export function highestUnlockedDungeonRunLevel(playerLevel) {
    if (!canAccessDungeon(playerLevel)) {
        return 0;
    }
    let highest = 0;
    for (const level of DUNGEON_RUN_LEVEL_BANDS) {
        if (playerLevel >= level) {
            highest = level;
        }
    }
    return highest;
}

export function availableDungeonRunLevelsForPlayer(playerLevel) {
    const highest = highestUnlockedDungeonRunLevel(playerLevel);
    return DUNGEON_RUN_LEVEL_BANDS.filter((level) => level <= highest);
}

export function canSelectDungeonRunLevel(playerLevel, runLevel) {
    return DUNGEON_RUN_LEVEL_BANDS.includes(Number(runLevel))
        && Number(runLevel) <= highestUnlockedDungeonRunLevel(playerLevel);
}

export function isEndgameDifficultyUnlocked(playerLevel) {
    return Number(playerLevel) >= ENDGAME_DIFFICULTY_UNLOCK_LEVEL;
}

export function isDungeonDifficultyUnlocked(playerLevel, difficulty) {
    if (difficulty === 'normal') {
        return canAccessDungeon(playerLevel);
    }
    return isEndgameDifficultyUnlocked(playerLevel);
}
