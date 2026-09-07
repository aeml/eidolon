import { readFileSync } from 'node:fs';
import { CONSTANTS } from '../src/core/Constants.js';
import { getStatusTrainingDamage } from '../src/core/OfflineDamageOverTime.js';

const cases = JSON.parse(readFileSync('server/internal/game/testdata/status_training.json', 'utf8'));
test.each(cases)('server/client status training: $name', entry => {
    const ranks = { ...entry.ranks };
    expect(getStatusTrainingDamage({ meshType: entry.class, talentRanks: ranks }, entry.skill, entry.amount, entry.inherited)).toBe(entry.want);
    expect(ranks).toEqual(entry.ranks);
});

test.each([['ROG_07', 'Shadow Lunge'], ['ROG_13', 'Serrated Edges'], ['ROG_21', 'Poison Coating']])('%s keeps its advertised per-rank Mastery', (id, skill) => {
    const talent = CONSTANTS.PASSIVE_TALENTS.Rogue.find(talent => talent.id === id);
    expect(talent.statusTraining).toEqual({ skill, damage: .04 });
    expect(talent.desc).toContain('+4%'); expect(talent.desc).toContain('20% max');
});
