import { expect } from '@playwright/test';
import { openDungeonGuide } from './dungeon-guide.js';
import { earnFreshHunt } from './fresh-hunt-route.js';
import { jumpByGroundClick, loginAndEnterWorld, readPlayerState, returnToTown } from './helpers.js';

const preparationState = page => page.evaluate(() => {
    const p = window.game.player;
    return { equipment: Object.fromEntries(Object.entries(p.equipment).filter(([, item]) => item?.id)
        .map(([slot, item]) => [slot, item.id])), talentRanks: p.talentRanks,
    talentPoints: p.talentPoints, statPoints: p.statPoints, intelligence: p.baseStats?.intelligence };
});

// Use only gear already collected during the earned story route. This is a
// deliberately simple baseline: fill empty slots, five Intelligence allocations,
// and up to five Fireball Mastery ranks. Not an optimized build or a loot grant.
async function prepareEarnedWizard(page, credentials) {
    expect(await page.evaluate(() => window.game.player.constructor.name)).toBe('Wizard');
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
    const allocated = Math.min(5, available);
    for (let i = 0; i < allocated; i++) {
        await page.getByRole('button', { name: 'Increase intelligence', exact: true }).click();
        await expect.poll(() => page.evaluate(() => window.game.player.statPoints)).toBe(available - i - 1);
    }
    await page.locator('#btn-close-inventory').click();
    if (await page.locator('#character-sheet').isVisible()) await page.locator('#btn-close-character').click();
    await page.keyboard.press('k');
    const skills = page.locator('#skill-tree-window');
    await skills.getByRole('button', { name: 'Talents', exact: true }).click();
    const points = await page.evaluate(() => window.game.player.talentPoints);
    const ranks = Math.min(5, points);
    for (let i = 0; i < ranks; i++) {
        await skills.locator('.skill-node').filter({ hasText: 'Fireball - Mastery' }).click();
        await expect.poll(() => page.evaluate(() => window.game.player.talentPoints)).toBe(points - i - 1);
        await expect.poll(() => page.evaluate(() => window.game.player.talentRanks.WIZ_01)).toBe(i + 1);
    }
    await page.locator('#btn-close-skills').click();
    const prepared = await preparationState(page);
    expect(Object.keys(prepared.equipment)).not.toContain('gem');
    expect(Object.keys(prepared.equipment)).toHaveLength(equipped);
    await page.reload({ waitUntil: 'networkidle' });
    await loginAndEnterWorld(page, credentials);
    expect(await preparationState(page)).toEqual(prepared);
    console.log(`[fresh-ready] earned preparation ${JSON.stringify({ equipped, allocated, ranks, prepared })}`);
    await openDungeonGuide(page);
}

async function leaveWestTown(page) {
    for (let step = 0; (await readPlayerState(page)).x > -220 && step < 40; step++) {
        const p = await readPlayerState(page);
        await jumpByGroundClick(page, -20, Math.max(-8, Math.min(8, 200 - p.z)));
    }
    expect((await readPlayerState(page)).x).toBeLessThanOrEqual(-220);
}

export async function earnFreshDungeonReadiness(page, credentials, { findTarget }) {
    await prepareEarnedWizard(page, credentials);
    await earnFreshHunt(page, credentials, { target: 'Imp', daily: 'daily_imp', rewardXP: 150_000,
        findTarget, leaveTown: () => leaveWestTown(page) });
    const p = await readPlayerState(page);
    expect(p.level, 'Existing earned story and contracts should reach the first dungeon gate').toBeGreaterThanOrEqual(30);
    await page.getByRole('tab', { name: 'Dungeons', exact: true }).click();
    await page.locator('#dungeon-type-select').selectOption('verdant_bastion_catacombs');
    await expect(page.locator('#btn-enter-dungeon')).toBeVisible();
    await expect(page.locator('#btn-enter-dungeon')).toBeEnabled();
    console.log(`[fresh-ready] earned level ${p.level}: Verdant entry available after saved manual rewards`);
}
