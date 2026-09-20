import { expect } from '@playwright/test';
import { restoreEarnedWizard } from './earned-earth-continuation.js';
import { readChronicleChapter } from './chronicle-earth-route.js';
import { openDungeonGuide } from './dungeon-guide.js';
import { readSavedEarnedHandoff } from '../earnedEarthCheckpoint.js';
import { earnedRegionalDungeonRoute } from '../earnedRegionRoutes.js';

// A real completed regional save is required. The existing checksum-pinned archive
// transfer remains the only source of Wizard progression; never seed this gate.
export async function restoreEarnedRegionalDungeonReadiness(page, credentials, dungeonType) {
    const route = earnedRegionalDungeonRoute(dungeonType);
    await restoreEarnedWizard(page, credentials);
    const chapter = route.dungeon, prior = route.prior;
    for (const id of prior) expect((await readChronicleChapter(page, id))?.completed, id).toBe(true);
    expect(await readChronicleChapter(page, chapter)).toMatchObject({ accepted: true, completed: false, count: 0 });
    const earned = await page.evaluate(() => {
        const p = window.game.player;
        return { level: p.level, xp: p.xp, gold: p.gold };
    });
    expect(earned.level).toBeGreaterThanOrEqual(route.level);
    const saved = readSavedEarnedHandoff(credentials.username, process.env, { includeQuests: true });
    expect(saved).toMatchObject({ ...earned, correctSaveKey: true });
    for (const id of prior) expect(saved.quests.find(q => q.id === id)?.completed, `Saved ${id}`).toBe(true);
    expect(saved.quests.find(q => q.id === chapter)).toMatchObject({ accepted: true, completed: false, count: 0 });
    await openDungeonGuide(page);
    await page.getByRole('tab', { name: 'Dungeons', exact: true }).click();
    await page.locator('#dungeon-type-select').selectOption(dungeonType);
    await page.locator('#diff-btn-normal').click();
    await page.locator('#dungeon-run-level-select').selectOption(String(route.level));
    await expect(page.locator('#btn-enter-dungeon')).toBeEnabled();
    await page.locator('#btn-close-dungeon-menu').click();
    console.log(`[earned-${route.realm}-dungeon-entry]`, JSON.stringify(earned));
}
