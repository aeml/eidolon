import { readFileSync } from 'node:fs';
import { CONSTANTS } from '../src/core/Constants.js';

const healing = JSON.parse(readFileSync('server/internal/game/testdata/talent_healing.json', 'utf8'));
test.each(healing)('$id describes its working spell healing bonus', ({ id, skill, perRank }) => {
    const talent = CONSTANTS.PASSIVE_TALENTS.Cleric.find(entry => entry.id === id);
    expect(talent.maxRank).toBe(5);
    expect(talent.desc).toBe(id === 'CLR_39'
        ? `+${perRank * 100}% spell healing and ability-effect duration per rank (${perRank * 500}% each max).`
        : `+${perRank * 100}% ${skill || 'spell'} healing per rank (${perRank * 500}% max).`);
});
