import { readFileSync } from 'node:fs';
import { CONSTANTS } from '../src/core/Constants.js';
import { comboBuildLabel } from '../src/ui/ComboBuildAvailability.js';

const choices = JSON.parse(readFileSync('server/internal/game/testdata/combo_choice_copy.json', 'utf8'));
test.each(choices)('$className/$id explains the actual combo benefit and limits', entry => {
    const combo = CONSTANTS.SKILL_COMBOS[entry.className].find(candidate => candidate.id === entry.id);
    expect(combo).toMatchObject({ firstSkill: entry.first, secondSkill: entry.second, description: entry.description });
});

test.each(Object.keys(CONSTANTS.SKILL_COMBOS))('%s combo cards identify a real learned branch and level', className => {
    const tree = CONSTANTS.SKILL_TREES[className];
    for (const combo of CONSTANTS.SKILL_COMBOS[className]) {
        let matches = 0;
        for (const branch of ['A', 'B', 'C']) {
            const skills = [tree.Tier1.name, ...[2, 3, 4, 5].map(t => tree[`Branch${branch}`][`Tier${t}`].name)];
            const player = { selectedBranch: branch, level: 100, unlockedSkills: skills };
            const label = comboBuildLabel(className, combo, player);
            if (skills.includes(combo.firstSkill) && skills.includes(combo.secondSkill)) {
                matches++;
                expect(label).toContain('Learned in your build');
                expect(label).toContain(tree[`Branch${branch}`].name);
                player.level = 1;
                expect(comboBuildLabel(className, combo, player)).toContain('Unlocks later');
                player.level = 100; player.unlockedSkills = [];
                expect(comboBuildLabel(className, combo, player)).toContain('Skills not learned');
            } else expect(label).toContain('Other specialization');
        }
        expect(matches).toBeGreaterThan(0);
    }
});
