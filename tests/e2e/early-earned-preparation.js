import { expect } from '@playwright/test';
import { earlyPreparationPlan } from '../earlyPreparationPolicy.js';
import { equipEarnedGearAndStats } from './earned-gear-and-stats.js';

const snapshot = page => page.evaluate(() => {
    const p = window.game.player;
    return { className: p.constructor.name, level: p.level, xp: p.xp, gold: p.gold,
        statPoints: p.statPoints, stats: { ...p.baseStats }, branch: p.selectedBranch,
        talents: { ...p.talentRanks }, unlocked: [...p.unlockedSkills], hotbar: [...p.hotbar],
        gear: Object.fromEntries(Object.entries(p.equipment).filter(([, item]) => item?.id)
            .map(([slot, item]) => [slot, item.id])) };
});

// Called in town after an earned opening. No branch/rank purchase, reload,
// recovery command, or grant; the level-10 specialization path is independent.
export async function prepareEarlyEarnedCharacter(page) {
    const before = await snapshot(page);
    const plan = earlyPreparationPlan(before.className, before.statPoints);
    const result = await equipEarnedGearAndStats(page, plan);
    const after = await snapshot(page);
    for (const key of ['className', 'level', 'xp', 'gold', 'branch', 'talents', 'unlocked', 'hotbar']) {
        expect(after[key], `Early preparation must preserve ${key}`).toEqual(before[key]);
    }
    expect(after.statPoints).toBe(before.statPoints - result.allocated);
    expect(after.stats[plan.stat]).toBe(before.stats[plan.stat] + result.allocated);
    for (const [stat, value] of Object.entries(before.stats)) {
        if (stat !== plan.stat) expect(after.stats[stat]).toBe(value);
    }
    for (const [slot, id] of Object.entries(before.gear)) expect(after.gear[slot]).toBe(id);
    expect(Object.keys(after.gear)).toHaveLength(Object.keys(before.gear).length + result.equipped);
    console.log('[fresh-early-preparation]', JSON.stringify({ className: after.className,
        level: after.level, stat: plan.stat, ...result, remainingPoints: after.statPoints }));
}
