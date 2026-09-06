import fs from 'node:fs';
import { DUNGEON_PLAYTHROUGHS, dungeonPlaythroughOptions } from './dungeonPlaythroughCatalog.js';

describe('dungeon playthrough matrix', () => {
    test('covers all five dungeons with the exact server encounter sequence', () => {
        const source = fs.readFileSync('server/internal/game/dungeon_instance.go', 'utf8').split('func dungeonEncounterCatalog')[1];
        expect(Object.keys(DUNGEON_PLAYTHROUGHS)).toHaveLength(5);
        for (const [kind, definition] of Object.entries(DUNGEON_PLAYTHROUGHS)) {
            const label = kind === 'verdant_bastion_catacombs' ? 'default:' : `case "${kind}":`;
            const section = source.split(label)[1];
            const literals = section.match(/\[\]string\{([^}]+)\}/)[1];
            const bosses = [...literals.matchAll(/"([^"]+)"/g)].map(match => match[1]);
            expect(definition.bosses).toEqual(bosses);
        }
    });

    test('retains default Verdant smoke and permits explicit regional difficulty/level', () => {
        expect(dungeonPlaythroughOptions()).toMatchObject({ dungeonType: 'verdant_bastion_catacombs', runLevel: 30, difficulty: 'normal' });
        expect(dungeonPlaythroughOptions({ EIDOLON_E2E_DUNGEON: 'molten_core', EIDOLON_E2E_DUNGEON_DIFFICULTY: 'heroic', EIDOLON_E2E_DUNGEON_LEVEL: '90' }))
            .toMatchObject({ dungeonType: 'molten_core', runLevel: 90, difficulty: 'heroic' });
        expect(dungeonPlaythroughOptions({ EIDOLON_E2E_DUNGEON: 'umbral_nexus' }).runLevel).toBe(100);
    });

    test.each([
        { EIDOLON_E2E_DUNGEON: 'unknown' },
        { EIDOLON_E2E_DUNGEON_DIFFICULTY: 'easy' },
        { EIDOLON_E2E_DUNGEON_LEVEL: '35' },
        { EIDOLON_E2E_DUNGEON_LEVEL: '110' },
        { EIDOLON_E2E_DUNGEON: 'molten_core', EIDOLON_E2E_DUNGEON_LEVEL: '30' }
    ])('rejects a malformed matrix selection: %j', environment => {
        expect(() => dungeonPlaythroughOptions(environment)).toThrow();
    });
});
