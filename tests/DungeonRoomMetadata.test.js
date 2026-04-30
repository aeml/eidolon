import {
    decorateDungeonRoomState,
    getDungeonBeatLabel,
    getDungeonCadenceLabel,
    getDungeonRoomRole
} from '../src/utils/dungeonRoomMetadata.js';

describe('dungeonRoomMetadata', () => {
    test('classifies boss approach pacing separately from reward hooks', () => {
        const room = { index: 3, type: 'normal', pacing: 'boss_approach' };

        expect(getDungeonRoomRole(room)).toBe('approach');
        expect(getDungeonBeatLabel(room)).toBe('Approach');
        expect(getDungeonCadenceLabel(room)).toBe('Pressure');
    });

    test('decorates room states with boss approach as a meaningful next beat', () => {
        const summary = decorateDungeonRoomState({
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
        expect(summary.nextBeatRole).toBe('boss');
        expect(summary.nextBeatCadenceTag).toBe('climax');
    });
});
