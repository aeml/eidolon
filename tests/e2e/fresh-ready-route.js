import { expect } from '@playwright/test';
import { openDungeonGuide } from './dungeon-guide.js';
import { earnFreshHunt } from './fresh-hunt-route.js';
import { jumpByGroundClick, loginAndEnterWorld, readPlayerState, returnToTown } from './helpers.js';
import { createEarnedClassCombat } from './earned-class-combat.js';
import { earnedPreparationBudget, earnedPreparationProfile } from '../earnedPreparationPolicy.js';
import { equipEarnedGearAndStats } from './earned-gear-and-stats.js';

const preparationState = page => page.evaluate(() => {
    const p = window.game.player;
    return { level: p.level, equipment: Object.fromEntries(Object.entries(p.equipment).filter(([, item]) => item?.id)
        .map(([slot, item]) => [slot, item.id])), talentRanks: p.talentRanks,
    talentPoints: p.talentPoints, statPoints: p.statPoints, intelligence: p.baseStats?.intelligence,
    strength: p.baseStats?.strength,
    branch: p.selectedBranch, hotbar: p.hotbar, unlockedSkills: p.unlockedSkills };
});

// Use only gear already collected during the earned story route. This is a
// deliberately simple baseline: fill empty slots, five class-stat allocations,
// up to five mastery ranks, and an earned defensive/utility branch.
// Not an optimized build or a loot grant.
export async function prepareEarnedWizard(page, credentials, { statBudget = 5, label = 'before-Imp' } = {}) {
    expect(await page.evaluate(() => window.game.player.constructor.name)).toBe('Wizard');
    return prepareEarnedClass(page, credentials, { statBudget, label });
}

export async function prepareEarnedClass(page, credentials, { statBudget = 5, label = 'before-Imp' } = {}) {
    const className = await page.evaluate(() => window.game.player.constructor.name);
    const profile = earnedPreparationProfile(className);
    const initial = await preparationState(page);
    const budget = earnedPreparationBudget(className, initial, statBudget);
    await page.locator('#btn-close-dungeon-menu').click();
    await returnToTown(page);
    const { equipped, allocated } = await equipEarnedGearAndStats(page,
        { stat: profile.stat, statAllocations: budget.statAllocations });
    await page.keyboard.press('k');
    const skills = page.locator('#skill-tree-window');
    await skills.getByRole('button', { name: 'Skills', exact: true }).click();
    const branch = skills.locator('.skill-branch').filter({ hasText: profile.branchLabel });
    const selectBranch = branch.getByRole('button', { name: 'Select Spec' });
    if (await selectBranch.count()) await selectBranch.click();
    await expect.poll(() => page.evaluate(() => window.game.player.selectedBranch)).toBe(profile.branch);
    for (const skill of budget.expectedSkills) {
        await expect.poll(() => page.evaluate(skill => window.game.player.hotbar.includes(skill), skill)).toBe(true);
        await expect.poll(() => page.evaluate(skill => window.game.player.unlockedSkills.includes(skill), skill)).toBe(true);
    }
    await skills.getByRole('button', { name: 'Talents', exact: true }).click();
    const points = await page.evaluate(() => window.game.player.talentPoints);
    const ranks = budget.masteryPurchases;
    for (let i = 0; i < ranks; i++) {
        await skills.locator('.skill-node').filter({ hasText: profile.masteryLabel }).click();
        await expect.poll(() => page.evaluate(() => window.game.player.talentPoints)).toBe(points - i - 1);
        await expect.poll(() => page.evaluate(id => window.game.player.talentRanks[id], profile.mastery))
            .toBe(budget.currentMastery + i + 1);
    }
    await page.locator('#btn-close-skills').click();
    const prepared = await preparationState(page);
    expect(Object.keys(prepared.equipment)).not.toContain('gem');
    expect(Object.keys(prepared.equipment)).toHaveLength(Object.keys(initial.equipment).length + equipped);
    for (const [slot, id] of Object.entries(initial.equipment)) expect(prepared.equipment[slot]).toBe(id);
    await loginAndEnterWorld(page, credentials);
    expect(await preparationState(page)).toEqual(prepared);
    console.log(`[fresh-ready] earned preparation ${JSON.stringify({ label, equipped, allocated, ranks, prepared })}`);
    await openDungeonGuide(page);
}

async function leaveWestTown(page) {
    for (let step = 0; (await readPlayerState(page)).x > -220 && step < 40; step++) {
        const p = await readPlayerState(page);
        await jumpByGroundClick(page, -20, Math.max(-8, Math.min(8, 200 - p.z)));
    }
    expect((await readPlayerState(page)).x).toBeLessThanOrEqual(-220);
}

export async function earnFreshDungeonReadiness(page, credentials, { findTarget, preparedEarlier = false }) {
    await prepareEarnedClass(page, credentials, { statBudget: preparedEarlier ? 0 : 5 });
    const beforeCombat = await createEarnedClassCombat(page);
    await earnFreshHunt(page, credentials, { target: 'Imp', daily: 'daily_imp', rewardXP: 150_000,
        findTarget, leaveTown: () => leaveWestTown(page), beforeCombat });
    const p = await readPlayerState(page);
    expect(p.level, 'Existing earned story and contracts should reach the first dungeon gate').toBeGreaterThanOrEqual(30);
    await page.getByRole('tab', { name: 'Dungeons', exact: true }).click();
    await page.locator('#dungeon-type-select').selectOption('verdant_bastion_catacombs');
    await expect(page.locator('#btn-enter-dungeon')).toBeVisible();
    await expect(page.locator('#btn-enter-dungeon')).toBeEnabled();
    console.log(`[fresh-ready] earned level ${p.level}: Verdant entry available after saved manual rewards`);
}
