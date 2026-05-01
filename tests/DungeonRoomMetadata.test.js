import {
    decorateDungeonRoomState,
    getDungeonBeatLabel,
    getDungeonCadenceLabel,
    getDungeonDifficultyPacingHint,
    getDungeonDifficultyPacingLabel,
    getDungeonRoomIdentityHint,
    getDungeonRoomIdentityLabel,
    getDungeonRoomIdentityTag,
    getDungeonRoomRole
} from '../src/utils/dungeonRoomMetadata.js';

describe('dungeonRoomMetadata', () => {
    test('classifies boss approach pacing separately from reward hooks', () => {
        const room = { index: 3, type: 'normal', pacing: 'boss_approach' };

        expect(getDungeonRoomRole(room)).toBe('approach');
        expect(getDungeonBeatLabel(room)).toBe('Boss Approach');
        expect(getDungeonCadenceLabel(room)).toBe('Pressure');
        expect(getDungeonRoomIdentityTag(room)).toBe('boss_approach');
        expect(getDungeonRoomIdentityHint(room)).toContain('last traversal check');
    });

    test('decorates room states with boss approach as a meaningful next beat', () => {
        const summary = decorateDungeonRoomState({
            difficultyPacing: 'mythic_trial',
            currentRoomIndex: 1,
            objectiveRoomIndex: 2,
            rooms: [
                { index: 0, type: 'start', explored: true, cleared: true },
                { index: 1, type: 'elite', hook: 'elite_ambush', explored: true, cleared: true },
                { index: 2, type: 'normal', pacing: 'boss_approach', explored: true, cleared: false },
                { index: 3, type: 'boss', explored: false, cleared: false }
            ]
        });

        expect(summary.objectiveRoomRole).toBe('approach');
        expect(summary.objectiveCadenceTag).toBe('pressure');
        expect(summary.objectiveIdentityTag).toBe('boss_approach');
        expect(summary.objectiveIdentityLabel).toBe('Boss Approach');
        expect(summary.nextBeatRole).toBe('boss');
        expect(summary.nextBeatCadenceTag).toBe('climax');
        expect(summary.nextBeatIdentityTag).toBe('boss_lair');
        expect(summary.nextBeatIdentityLabel).toBe('Boss Lair');
        expect(summary.difficultyPacingLabel).toBe('Mythic Trial');
        expect(summary.difficultyPacingHint).toContain('unique-effect boss loot');
    });

    test('labels room identity metadata for route surfaces', () => {
        expect(getDungeonRoomIdentityLabel({ type: 'start' })).toBe('Entry Gate');
        expect(getDungeonRoomIdentityLabel({ type: 'normal', hook: 'chest' })).toBe('Treasure Cache');
        expect(getDungeonRoomIdentityLabel({ type: 'normal', hook: 'shrine', pacing: 'boss_approach' })).toBe('Restorative Shrine');
        expect(getDungeonRoomIdentityLabel({ type: 'elite', hook: 'elite_ambush' })).toBe('Ambush Chamber');
        expect(getDungeonRoomIdentityLabel({ type: 'elite' })).toBe('Elite Guard');
        expect(getDungeonRoomIdentityLabel({ type: 'boss' })).toBe('Boss Lair');
        expect(getDungeonRoomIdentityLabel({ type: 'normal' })).toBe('Route Hall');
        expect(getDungeonRoomIdentityHint({ identity: 'treasure_cache' })).toContain('payoff beat');
    });

    test('labels dungeon difficulty pacing metadata for route surfaces', () => {
        expect(getDungeonDifficultyPacingLabel({ difficultyPacing: 'standard_route' })).toBe('Standard Route');
        expect(getDungeonDifficultyPacingLabel({ difficultyPacing: 'heroic_pressure' })).toBe('Heroic Pressure');
        expect(getDungeonDifficultyPacingLabel({ difficultyPacing: 'mythic_trial' })).toBe('Mythic Trial');
        expect(getDungeonDifficultyPacingHint({ difficultyPacing: 'heroic_pressure' })).toContain('guaranteed boss gem');
        expect(getDungeonDifficultyPacingHint({ difficultyPacing: 'mythic_trial' })).toContain('capstone push');
    });
});
