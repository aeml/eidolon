import fs from 'node:fs';
import { CONSTANTS } from '../src/core/Constants.js';

const contract = JSON.parse(fs.readFileSync('server/internal/game/testdata/talent_duration.json', 'utf8'));
test.each(contract)('$id duration copy matches the server bonus', entry => {
    const talent = CONSTANTS.PASSIVE_TALENTS.Wizard.find(talent => talent.id === entry.id);
    expect(talent.desc).toContain(`+${Math.round(entry.perRank * 100)}%`);
    expect(talent.desc).toContain('duration');
    expect(talent.maxRank).toBe(5);
    expect(talent.abilityDuration).toEqual({ duration: entry.perRank, ...(entry.skill ? { skill: entry.skill } : {}) });
});

test('Time Warp Mastery offers duration instead of nonexistent spell damage', () => {
    const talent = CONSTANTS.PASSIVE_TALENTS.Wizard.find(talent => talent.id === 'WIZ_25');
    expect(talent.desc).not.toContain('damage');
    expect(talent.abilityDamage).toBeUndefined();
});
