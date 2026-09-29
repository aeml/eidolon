import { CONSTANTS } from '../core/Constants.js';

// Build eligibility only: this does not promise enough mana, an available
// cooldown, a valid target, or an active three-second combo window.
export function comboBuildLabel(className, combo, player = {}) {
    const tree = CONSTANTS.SKILL_TREES[className];
    if (!tree) return 'Build information unavailable';
    for (const branch of ['A', 'B', 'C']) {
        const definition = tree[`Branch${branch}`];
        const skills = [tree.Tier1.name, ...[2, 3, 4, 5].map(tier => definition[`Tier${tier}`].name)];
        const first = skills.indexOf(combo.firstSkill), second = skills.indexOf(combo.secondSkill);
        if (first < 0 || second < 0) continue;
        const level = Math.max(1, first * 10, second * 10);
        const learned = [combo.firstSkill, combo.secondSkill].every(skill => skill === tree.Tier1.name || player.unlockedSkills?.includes(skill));
        const status = player.selectedBranch !== branch ? 'Other specialization'
            : player.level < level ? 'Unlocks later'
                : learned ? 'Learned in your build' : 'Skills not learned';
        return `${definition.name} · Level ${level} · ${status}`;
    }
    return 'Not available in a single specialization';
}
