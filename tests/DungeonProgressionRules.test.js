import {
    MAX_PLAYER_LEVEL,
    DUNGEON_UNLOCK_LEVEL,
    ENDGAME_DIFFICULTY_UNLOCK_LEVEL,
    DUNGEON_RUN_LEVEL_BANDS,
    canAccessDungeon,
    availableDungeonRunLevelsForPlayer,
    canSelectDungeonRunLevel,
    isEndgameDifficultyUnlocked,
    isDungeonDifficultyUnlocked
} from '../src/data/dungeonProgression.js';

describe('dungeon progression rules', () => {
    test('exposes canonical progression constants', () => {
        expect(MAX_PLAYER_LEVEL).toBe(100);
        expect(DUNGEON_UNLOCK_LEVEL).toBe(30);
        expect(ENDGAME_DIFFICULTY_UNLOCK_LEVEL).toBe(100);
        expect(DUNGEON_RUN_LEVEL_BANDS).toEqual([30, 40, 50, 60, 70, 80, 90, 100]);
    });

    test('unlocks dungeons and run level bands by player level bracket', () => {
        expect(canAccessDungeon(29)).toBe(false);
        expect(canAccessDungeon(30)).toBe(true);
        expect(availableDungeonRunLevelsForPlayer(30)).toEqual([30]);
        expect(availableDungeonRunLevelsForPlayer(47)).toEqual([30, 40]);
        expect(canSelectDungeonRunLevel(47, 50)).toBe(false);
        expect(canSelectDungeonRunLevel(100, 100)).toBe(true);
    });

    test('locks heroic and mythic until max level', () => {
        expect(isEndgameDifficultyUnlocked(99)).toBe(false);
        expect(isEndgameDifficultyUnlocked(100)).toBe(true);
        expect(isDungeonDifficultyUnlocked(99, 'normal')).toBe(true);
        expect(isDungeonDifficultyUnlocked(99, 'heroic')).toBe(false);
        expect(isDungeonDifficultyUnlocked(99, 'mythic')).toBe(false);
        expect(isDungeonDifficultyUnlocked(100, 'heroic')).toBe(true);
        expect(isDungeonDifficultyUnlocked(100, 'mythic')).toBe(true);
    });
});
