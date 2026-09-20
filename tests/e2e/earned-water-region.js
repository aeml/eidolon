import { expect } from '@playwright/test';
import { chronicleHunts } from '../../src/data/chronicleHunts.generated.js';
import { chroniclePhoneRoutes } from './chronicle-phone-routes.js';
import { openIlyra, readChronicleChapter } from './chronicle-earth-route.js';
import { earnInvestigation, walkInvestigationWaypoints } from './chronicle-investigation-route.js';
import { clearFreshInvestigationApproach } from './fresh-investigation-combat.js';
import { earnFreshStoryHunt } from './fresh-story-hunt-route.js';
import { earnEarnedCollection } from './fresh-collection-route.js';
import { findExpeditionTarget } from './earned-expedition-target.js';
import { prepareStoryHuntBuild } from './story-hunt-preparation.js';
import { earnedCheckpoint } from './earned-checkpoint.js';
import { openDungeonGuide } from './dungeon-guide.js';
import { readSavedEarnedHandoff } from '../earnedEarthCheckpoint.js';
import { setAutoLootThroughSettings } from './helpers.js';

// Continues after an actually earned Missing Ferry turn-in. No registration,
// fixture grants or prerequisite rewriting here; the caller owns its save.
export async function earnWaterRegionToReadiness(page, credentials, { step = (_name, body) => body(), capture } = {}) {
    expect(await readChronicleChapter(page, 'chronicle_water_missing_ferry')).toMatchObject({ completed: true, count: 60 });
    const waypoints = chroniclePhoneRoutes.water;
    const leaveTown = () => walkInvestigationWaypoints(page, waypoints);
    const investigate = id => earnInvestigation(page, id, openIlyra, capture, {
        waypoints, beforeInspect: site => clearFreshInvestigationApproach(page, site), inspectWithKeyboard: true
    });
    await step('flood shelter ledger', () => investigate('chronicle_water_flood_shelter'));
    await step('snow debts', () => earnFreshStoryHunt(page, credentials, 'chronicle_water_snow_debts', { leaveTown }));
    await step('moon-tide pearls', async () => {
        const hunt = chronicleHunts.find(hunt => hunt.id === 'chronicle_water_snow_debts');
        const result = await earnEarnedCollection(page, credentials, {
            chapterId: 'chronicle_04_pearls_without_tides', itemName: 'Moon-Tide Pearl', nearbyType: 'MountainTroll',
            findTarget: () => findExpeditionTarget(page, hunt), leaveTown,
            prepare: async () => prepareStoryHuntBuild(page, credentials,
                await page.evaluate(() => ({ level: window.game.player.level, statPoints: window.game.player.statPoints })),
                'before-moon-tide-pearls')
        });
        await setAutoLootThroughSettings(page, result.previousAutoLoot);
    });
    await step('true and false reflections', () => investigate('chronicle_water_false_reflection'));
    await step('unmastered current', () => earnFreshStoryHunt(page, credentials, 'chronicle_water_unmastered_current', { leaveTown }));
    await step('Abyssal Well readiness and saved handoff', async () => {
        const completed = ['chronicle_water_flood_shelter', 'chronicle_water_snow_debts',
            'chronicle_04_pearls_without_tides', 'chronicle_water_false_reflection', 'chronicle_water_unmastered_current'];
        const id = 'chronicle_05_drowned_name';
        await openIlyra(page);
        await page.getByRole('button', { name: 'Accept Quest', exact: true }).click();
        await expect.poll(async () => (await readChronicleChapter(page, id))?.accepted).toBe(true);
        await page.locator('#btn-close-quest').click();
        await earnedCheckpoint(page, credentials, { label: 'water-region-readiness', final: true });
        const progress = await page.evaluate(() => {
            const p = window.game.player;
            return { level: p.level, xp: p.xp, gold: p.gold,
                quests: p.quests.map(q => ({ id: q.id, completed: q.completed, count: q.count })) };
        });
        console.log('[earned-water-readiness]', JSON.stringify(progress));
        for (const id of completed) expect(progress.quests.find(q => q.id === id)?.completed).toBe(true);
        // Fail and preserve the actual save if the current curve leaves a gap;
        // do not fill it with daily contracts, XP grants or a lower entry gate.
        expect(progress.level, 'Water story must support its level60 dungeon gate without mandatory dailies').toBeGreaterThanOrEqual(60);
        await openDungeonGuide(page);
        await page.getByRole('tab', { name: 'Dungeons', exact: true }).click();
        await page.locator('#dungeon-type-select').selectOption('abyssal_well');
        await page.locator('#diff-btn-normal').click();
        await page.locator('#dungeon-run-level-select').selectOption('60');
        await expect(page.locator('#btn-enter-dungeon')).toBeEnabled();
        await page.locator('#btn-close-dungeon-menu').click();
        await expect.poll(() => {
            const saved = readSavedEarnedHandoff(credentials.username, process.env, { includeQuests: true });
            const dungeon = saved.quests.find(q => q.id === id);
            return { level: saved.level, xp: saved.xp, gold: saved.gold, correctSaveKey: saved.correctSaveKey,
                accepted: dungeon?.accepted, completed: dungeon?.completed, count: dungeon?.count,
                priorChaptersSaved: completed.every(id => saved.quests.find(q => q.id === id)?.completed) };
        }, { timeout: 30_000, intervals: [2000] }).toEqual({ level: progress.level, xp: progress.xp, gold: progress.gold,
            correctSaveKey: true, accepted: true, completed: false, count: 0, priorChaptersSaved: true });
    });
}
