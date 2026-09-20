import { expect, test } from '@playwright/test';
import { restoreEarnedWizard } from './earned-earth-continuation.js';
import { readSavedEarnedHandoff } from '../earnedEarthCheckpoint.js';
import { readChronicleChapter } from './chronicle-earth-route.js';
import { earnFreshStoryHunt } from './fresh-story-hunt-route.js';
import { collectBrowserFailures, credentialsFromEnvironment, jumpByGroundClick, readPlayerState } from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('earned post-Verdant Wizard completes Missing Ferry and saves the Water investigation handoff', async ({ page, baseURL }, testInfo) => {
    test.skip(process.env.EIDOLON_E2E_EARNED_WATER !== '1', 'Explicit private post-Verdant continuation only');
    test.setTimeout(1_800_000);
    expect(testInfo.retry).toBe(0);
    const credentials = credentialsFromEnvironment();
    const failures = collectBrowserFailures(page, baseURL);
    await restoreEarnedWizard(page, credentials);
    // The transfer has already verified the archive checksum and exact earned
    // fields. Compare the client against that saved state rather than assuming
    // every continuation starts before the first kill at level33.
    const savedEntry = readSavedEarnedHandoff(credentials.username, process.env, { includeQuests: true });
    expect(await page.evaluate(() => {
        const p = window.game.player;
        return { level: p.level, xp: p.xp, gold: p.gold };
    })).toEqual({ level: savedEntry.level, xp: savedEntry.xp, gold: savedEntry.gold });
    expect(savedEntry.correctSaveKey).toBe(true);
    expect(await readChronicleChapter(page, 'chronicle_03_roots_remember')).toMatchObject({ completed: true, count: 1 });
    const id = 'chronicle_water_missing_ferry';
    const entry = await readChronicleChapter(page, id);
    expect(savedEntry.quests.find(q => q.id === id)).toMatchObject({
        accepted: entry.accepted, completed: entry.completed, count: entry.count
    });
    expect(entry.maxCount).toBe(60);
    expect(Number.isInteger(entry.count)).toBe(true);
    expect(entry.count).toBeGreaterThanOrEqual(0);
    expect(entry.count).toBeLessThanOrEqual(60);
    if (entry.completed) expect(entry.count).toBe(60);
    // This Water chapter hunts Constructs in western Earth. Use the authored
    // west town gate (z180..220), including after ordinary town rest/training.
    if (!entry.completed) await earnFreshStoryHunt(page, credentials, id, { resumeAccepted: entry.accepted, leaveTown: async () => {
        for (let step = 0; (await readPlayerState(page)).x > -115 && step < 20; step++) {
            const position = await readPlayerState(page);
            await jumpByGroundClick(page, -25, Math.max(-8, Math.min(8, 200 - position.z)));
        }
        expect((await readPlayerState(page)).x).toBeLessThanOrEqual(-115);
    } });
    const earned = await page.evaluate(() => {
        const p = window.game.player;
        return { level: p.level, xp: p.xp, gold: p.gold };
    });
    await expect.poll(() => {
        const saved = readSavedEarnedHandoff(credentials.username, process.env, { includeQuests: true });
        const quest = saved.quests.find(q => q.id === id);
        const next = saved.quests.find(q => q.id === 'chronicle_water_flood_shelter');
        return { level: saved.level, xp: saved.xp, gold: saved.gold, correctSaveKey: saved.correctSaveKey,
            completed: quest?.completed, count: quest?.count,
            next: next && { accepted: next.accepted, completed: next.completed, count: next.count } };
    }, { timeout: 30_000, intervals: [2000] }).toEqual({ ...earned, correctSaveKey: true, completed: true, count: 60,
        next: { accepted: false, completed: false, count: 0 } });
    console.log('[earned-water-saved]', JSON.stringify({ ...earned, chapter: id, kills: 60 }));
    expect(failures, failures.join('\n')).toEqual([]);
});
