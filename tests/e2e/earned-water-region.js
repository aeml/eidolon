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
import { waterChapterContinuation } from '../waterRegionContinuation.js';
import { earnedRegionRoute } from '../earnedRegionRoutes.js';

// Continues after an actually earned Missing Ferry turn-in. No registration,
// fixture grants or prerequisite rewriting here; the caller owns its save.
export async function earnWaterRegionToReadiness(page, credentials, options = {}) {
    return earnRegionToReadiness(page, credentials, 'water', options);
}

export async function earnRegionToReadiness(page, credentials, realm, { step = (_name, body) => body(), capture } = {}) {
    const route = earnedRegionRoute(realm);
    expect(await readChronicleChapter(page, route.previous)).toMatchObject({ completed: true });
    const waypoints = chroniclePhoneRoutes[realm];
    const leaveTown = () => walkInvestigationWaypoints(page, waypoints);
    const chapter = async (id, run) => {
        const saved = await readChronicleChapter(page, id);
        const state = waterChapterContinuation(saved, realm);
        if (state === 'completed') {
            console.log(`[earned-${realm}-retained]`, JSON.stringify(saved));
            return;
        }
        await run({ resumeAccepted: state === 'accepted' });
        expect((await readChronicleChapter(page, id))?.completed).toBe(true);
    };
    const investigate = id => chapter(id, options => earnInvestigation(page, id, openIlyra, capture, {
        ...options, waypoints, beforeInspect: site => clearFreshInvestigationApproach(page, site), inspectWithKeyboard: true
    }));
    const hunt = id => chapter(id, options => earnFreshStoryHunt(page, credentials, id, {
        ...options, leaveTown
    }));
    await step(route.investigation, () => investigate(route.investigation));
    await step(route.hunt, () => hunt(route.hunt));
    await step(route.collection, () => chapter(route.collection, async options => {
        const hunt = chronicleHunts.find(hunt => hunt.id === route.hunt);
        const result = await earnEarnedCollection(page, credentials, {
            ...options,
            chapterId: route.collection, itemName: route.item, nearbyType: hunt.enemy,
            findTarget: () => findExpeditionTarget(page, hunt), leaveTown,
            prepare: async () => prepareStoryHuntBuild(page, credentials,
                await page.evaluate(() => ({ level: window.game.player.level, statPoints: window.game.player.statPoints })),
                `before-${route.collection}`)
        });
        await setAutoLootThroughSettings(page, result.previousAutoLoot);
    }));
    await step(route.reflection, () => investigate(route.reflection));
    if (route.finalHunt) await step(route.finalHunt, () => hunt(route.finalHunt));
    await step(`${route.dungeonType} readiness and saved handoff`, async () => {
        const completed = [route.previous, route.investigation, route.hunt, route.collection, route.reflection,
            ...(route.finalHunt ? [route.finalHunt] : [])];
        const id = route.dungeon;
        const state = waterChapterContinuation(await readChronicleChapter(page, id), realm);
        expect(state, 'This route must not replay an already completed dungeon').not.toBe('completed');
        await openIlyra(page);
        if (state === 'offered') await page.getByRole('button', { name: 'Accept Quest', exact: true }).click();
        await expect.poll(async () => (await readChronicleChapter(page, id))?.accepted).toBe(true);
        await page.locator('#btn-close-quest').click();
        await earnedCheckpoint(page, credentials, { label: `${realm}-region-readiness`, final: true });
        const progress = await page.evaluate(() => {
            const p = window.game.player;
            return { level: p.level, xp: p.xp, gold: p.gold,
                quests: p.quests.map(q => ({ id: q.id, completed: q.completed, count: q.count })) };
        });
        console.log(`[earned-${realm}-readiness]`, JSON.stringify(progress));
        for (const id of completed) expect(progress.quests.find(q => q.id === id)?.completed).toBe(true);
        // Fail and preserve the actual save if the current curve leaves a gap;
        // do not fill it with daily contracts, XP grants or a lower entry gate.
        expect(progress.level, `${realm} story must support its level${route.level} dungeon gate without mandatory dailies`).toBeGreaterThanOrEqual(route.level);
        await openDungeonGuide(page);
        await page.getByRole('tab', { name: 'Dungeons', exact: true }).click();
        await page.locator('#dungeon-type-select').selectOption(route.dungeonType);
        await page.locator('#diff-btn-normal').click();
        await page.locator('#dungeon-run-level-select').selectOption(String(route.level));
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
