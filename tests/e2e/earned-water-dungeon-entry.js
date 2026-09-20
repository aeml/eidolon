import { expect } from '@playwright/test';
import { restoreEarnedWizard } from './earned-earth-continuation.js';
import { readChronicleChapter } from './chronicle-earth-route.js';
import { openDungeonGuide } from './dungeon-guide.js';
import { readSavedEarnedHandoff } from '../earnedEarthCheckpoint.js';

// A real completed Water save is required. The existing checksum-pinned archive
// transfer remains the only source of Wizard progression; never seed this gate.
export async function restoreEarnedWaterDungeonReadiness(page, credentials) {
    await restoreEarnedWizard(page, credentials);
    const chapter = 'chronicle_05_drowned_name';
    const prior = ['chronicle_03_roots_remember', 'chronicle_water_missing_ferry',
        'chronicle_water_flood_shelter', 'chronicle_water_snow_debts',
        'chronicle_04_pearls_without_tides', 'chronicle_water_false_reflection',
        'chronicle_water_unmastered_current'];
    for (const id of prior) expect((await readChronicleChapter(page, id))?.completed, id).toBe(true);
    expect(await readChronicleChapter(page, chapter)).toMatchObject({ accepted: true, completed: false, count: 0 });
    const earned = await page.evaluate(() => {
        const p = window.game.player;
        return { level: p.level, xp: p.xp, gold: p.gold };
    });
    expect(earned.level).toBeGreaterThanOrEqual(60);
    const saved = readSavedEarnedHandoff(credentials.username, process.env, { includeQuests: true });
    expect(saved).toMatchObject({ ...earned, correctSaveKey: true });
    for (const id of prior) expect(saved.quests.find(q => q.id === id)?.completed, `Saved ${id}`).toBe(true);
    expect(saved.quests.find(q => q.id === chapter)).toMatchObject({ accepted: true, completed: false, count: 0 });
    await openDungeonGuide(page);
    await page.getByRole('tab', { name: 'Dungeons', exact: true }).click();
    await page.locator('#dungeon-type-select').selectOption('abyssal_well');
    await page.locator('#diff-btn-normal').click();
    await page.locator('#dungeon-run-level-select').selectOption('60');
    await expect(page.locator('#btn-enter-dungeon')).toBeEnabled();
    await page.locator('#btn-close-dungeon-menu').click();
    console.log('[earned-water-dungeon-entry]', JSON.stringify(earned));
}
