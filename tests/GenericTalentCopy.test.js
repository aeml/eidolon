import { readFileSync } from 'node:fs';
import { CONSTANTS } from '../src/core/Constants.js';

const cases = JSON.parse(readFileSync('server/internal/game/testdata/generic_talent_copy.json', 'utf8'));
test.each(cases)('$className $id describes the existing authoritative bonus', ({ className, id, description }) => {
    const talent = CONSTANTS.PASSIVE_TALENTS[className].find(value => value.id === id);
    expect(talent).toBeDefined();
    expect(talent.maxRank).toBe(5);
    expect(talent.desc).toBe(description);
});
