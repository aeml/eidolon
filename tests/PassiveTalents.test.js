import { CONSTANTS } from '../src/core/Constants.js';

describe('PASSIVE_TALENTS definitions', () => {
    test('has 40 unique talents per class with correct id prefix', () => {
        const cases = [
            { cls: 'Fighter', prefix: 'FTR_' },
            { cls: 'Rogue', prefix: 'ROG_' },
            { cls: 'Wizard', prefix: 'WIZ_' },
            { cls: 'Cleric', prefix: 'CLR_' },
        ];

        for (const { cls, prefix } of cases) {
            const list = CONSTANTS.PASSIVE_TALENTS?.[cls];
            expect(Array.isArray(list)).toBe(true);
            expect(list).toHaveLength(40);

            const ids = list.map(t => t.id);
            expect(new Set(ids).size).toBe(40);
            for (const id of ids) {
                expect(typeof id).toBe('string');
                expect(id.startsWith(prefix)).toBe(true);
                expect(id).toMatch(new RegExp(`^${prefix}\\d{2}$`));
            }

			for (const t of list) {
				expect(typeof t.name).toBe('string');
				expect(typeof t.desc).toBe('string');
				expect(typeof t.maxRank).toBe('number');
                expect(t.maxRank).toBe(5);
			}
        }
    });
});
