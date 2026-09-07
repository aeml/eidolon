import { expect } from '@playwright/test';
import { openDungeonGuide } from './dungeon-guide.js';
import { earnFreshHunt } from './fresh-hunt-route.js';
import { jumpByGroundClick, loginAndEnterWorld, moveByGroundClick, readPlayerState, returnToTown } from './helpers.js';
import { createEarnedWizardDefense } from './earned-wizard-defense.js';
import { earnedWizardPreparationBudget } from '../earnedPreparationPolicy.js';

const preparationState = page => page.evaluate(() => {
    const p = window.game.player;
    return { level: p.level, equipment: Object.fromEntries(Object.entries(p.equipment).filter(([, item]) => item?.id)
        .map(([slot, item]) => [slot, item.id])), talentRanks: p.talentRanks,
    talentPoints: p.talentPoints, statPoints: p.statPoints, intelligence: p.baseStats?.intelligence,
    branch: p.selectedBranch, hotbar: p.hotbar, unlockedSkills: p.unlockedSkills };
});

// Use only gear already collected during the earned story route. This is a
// deliberately simple baseline: fill empty slots, five Intelligence allocations,
// up to five Fireball Mastery ranks, and the earned Control & Utility branch.
// Not an optimized build or a loot grant.
export async function prepareEarnedWizard(page, credentials, { statBudget = 5, label = 'before-Imp' } = {}) {
    expect(await page.evaluate(() => window.game.player.constructor.name)).toBe('Wizard');
    const initial = await preparationState(page);
    const budget = earnedWizardPreparationBudget(initial, statBudget);
    await page.locator('#btn-close-dungeon-menu').click();
    await returnToTown(page);
    await page.keyboard.press('i');
    await expect(page.locator('#inventory-screen')).toBeVisible();
    const candidates = await page.evaluate(() => {
        const slots = new Set(['head', 'chest', 'legs', 'feet', 'gloves', 'shoulders', 'belt',
            'neck', 'mainHand', 'offHand', 'ring', 'ring1', 'ring2', 'trinket', 'trinket1', 'trinket2']);
        return window.game.player.inventory.filter(item => item?.id &&
            item.level <= window.game.player.level && slots.has(item.slot) &&
            !['MATERIAL', 'RELIC', 'GEM'].includes(item.type))
            .map(item => ({ id: item.id, slot: item.slot, name: item.name }));
    });
    let equipped = 0;
    for (const candidate of candidates) {
        const index = await page.evaluate(({ id, slot }) => {
            const p = window.game.player;
            const possible = slot === 'ring' ? ['ring1', 'ring2'] :
                slot === 'trinket' ? ['trinket1', 'trinket2'] : [slot];
            return possible.every(key => p.equipment[key]?.id) ? -1 :
                p.inventory.findIndex(item => item?.id === id);
        }, candidate);
        if (index < 0) continue;
        await page.locator('#inventory-grid .inv-slot').nth(index).click();
        await expect.poll(() => page.evaluate(id => Object.values(window.game.player.equipment)
            .some(item => item?.id === id), candidate.id)).toBe(true);
        equipped++;
    }
    const available = await page.evaluate(() => window.game.player.statPoints);
    const allocated = budget.statAllocations;
    for (let i = 0; i < allocated; i++) {
        await page.getByRole('button', { name: 'Increase intelligence', exact: true }).click();
        await expect.poll(() => page.evaluate(() => window.game.player.statPoints)).toBe(available - i - 1);
    }
    await page.locator('#btn-close-inventory').click();
    if (await page.locator('#character-sheet').isVisible()) await page.locator('#btn-close-character').click();
    await page.keyboard.press('k');
    const skills = page.locator('#skill-tree-window');
    await skills.getByRole('button', { name: 'Skills', exact: true }).click();
    const branch = skills.locator('.skill-branch').filter({ hasText: 'Control & Utility' });
    const selectBranch = branch.getByRole('button', { name: 'Select Spec' });
    if (await selectBranch.count()) await selectBranch.click();
    await expect.poll(() => page.evaluate(() => window.game.player.selectedBranch)).toBe('C');
    for (const skill of budget.expectedSkills) {
        await expect.poll(() => page.evaluate(skill => window.game.player.hotbar.includes(skill), skill)).toBe(true);
        await expect.poll(() => page.evaluate(skill => window.game.player.unlockedSkills.includes(skill), skill)).toBe(true);
    }
    await skills.getByRole('button', { name: 'Talents', exact: true }).click();
    const points = await page.evaluate(() => window.game.player.talentPoints);
    const ranks = budget.masteryPurchases;
    for (let i = 0; i < ranks; i++) {
        await skills.locator('.skill-node').filter({ hasText: 'Fireball - Mastery' }).click();
        await expect.poll(() => page.evaluate(() => window.game.player.talentPoints)).toBe(points - i - 1);
        await expect.poll(() => page.evaluate(() => window.game.player.talentRanks.WIZ_01)).toBe(budget.currentMastery + i + 1);
    }
    await page.locator('#btn-close-skills').click();
    const prepared = await preparationState(page);
    expect(Object.keys(prepared.equipment)).not.toContain('gem');
    expect(Object.keys(prepared.equipment)).toHaveLength(Object.keys(initial.equipment).length + equipped);
    for (const [slot, id] of Object.entries(initial.equipment)) expect(prepared.equipment[slot]).toBe(id);
    await page.reload({ waitUntil: 'networkidle' });
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
    await prepareEarnedWizard(page, credentials, { statBudget: preparedEarlier ? 0 : 5 });
    const beforeCombat = await createEarnedWizardDefense(page);
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
