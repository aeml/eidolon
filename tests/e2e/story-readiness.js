import { expect } from '@playwright/test';
import { storyReadinessProblems } from '../storyReadinessPolicy.js';
import { openDungeonGuide } from './dungeon-guide.js';

export async function verifyStoryOnlyEarthReadiness(page) {
    const snapshot = await page.evaluate(() => {
        const p = window.game.player;
        return { level: p.level, xp: p.xp, nextXP: p.xpToNextLevel, gold: p.gold,
            state: p.state, hp: p.stats.hp, quests: p.quests.map(quest => ({ id: quest.id,
                accepted: quest.accepted, completed: quest.completed, count: quest.count })) };
    });
    const problems = storyReadinessProblems(snapshot);
    console.log('[story-only-readiness]', JSON.stringify({ ...snapshot, problems }));
    expect(problems, problems.join('\n')).toEqual([]);
    expect(snapshot.state).not.toBe('DEAD');
    expect(snapshot.hp).toBeGreaterThan(0);
    await page.locator('#btn-close-dungeon-menu').click();
    await openDungeonGuide(page);
    await page.getByRole('tab', { name: 'Dungeons', exact: true }).click();
    await page.locator('#dungeon-type-select').selectOption('verdant_bastion_catacombs');
    await page.locator('#diff-btn-normal').click();
    await page.locator('#dungeon-run-level-select').selectOption('30');
    await expect(page.locator('#btn-enter-dungeon')).toBeVisible();
    await expect(page.locator('#btn-enter-dungeon')).toBeEnabled();
    await page.getByRole('tab', { name: 'Raids', exact: true }).click();
    await expect(page.locator('[data-raid-type="earth_crystal_raid"]')).toHaveAttribute('data-access', 'sealed');
    console.log('[story-only-readiness] earned level30 entry is enabled; raid remains sealed before the dungeon clear');
}
