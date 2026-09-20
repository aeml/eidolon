import { expect } from '@playwright/test';
import { restoreEarnedEarthCheckpoint, readSavedEarnedHandoff } from '../earnedEarthCheckpoint.js';
import { openIlyra, readChronicleChapter, EARTH_DUNGEON_CHAPTER } from './chronicle-earth-route.js';
import { earnFreshStoryHunt } from './fresh-story-hunt-route.js';
import { verifyStoryOnlyEarthReadiness } from './story-readiness.js';
import { openDungeonGuide } from './dungeon-guide.js';
import { jumpByGroundClick,
    loginAndEnterWorld, openGame, readPlayerState, returnToTown } from './helpers.js';

export async function leaveEarnedParty(page) {
    const inParty = () => page.evaluate(() => Boolean(window.game.socialController?.myPartyId || window.game.uiManager.social?.inParty));
    if (await inParty()) {
        await page.locator('body').press('o');
        await page.locator('#btn-leave-party').click();
        await expect.poll(inParty).toBe(false);
        await page.locator('body').press('Escape');
    }
}

export async function resumeEarnedEarthToReadiness(page, credentials) {
    await openGame(page);
    await page.locator('#auth-username').fill(credentials.username);
    await page.locator('#auth-password').fill(credentials.password);
    await page.locator('#auth-email').fill(`${credentials.username}@example.invalid`);
    await page.locator('#btn-register').click();
    await expect(page.locator('#auth-status')).toContainText('Registration successful');
    console.log('[earned-resume]', restoreEarnedEarthCheckpoint(credentials.username));
    await loginAndEnterWorld(page, credentials);
    // The exact save still references its original account's solo party leader.
    // Leave through ordinary controls, not a rewritten PartyID or leadership grant.
    await leaveEarnedParty(page);
    const hunt = 'chronicle_earth_borrowed_oath';
    const resumedHunt = await readChronicleChapter(page, hunt);
    expect([46, 50]).toContain(resumedHunt.count);
    if (!resumedHunt.completed) await earnFreshStoryHunt(page, credentials, hunt, { resumeAccepted: true, leaveTown: async () => {
        for (let step = 0; (await readPlayerState(page)).x < 115 && step < 20; step++) {
            const position = await readPlayerState(page);
            await jumpByGroundClick(page, 25, Math.max(-8, Math.min(8, 200 - position.z)));
        }
        expect((await readPlayerState(page)).x).toBeGreaterThanOrEqual(115);
    } });
    if (!(await readChronicleChapter(page, EARTH_DUNGEON_CHAPTER))?.accepted) {
        await openIlyra(page);
        await page.getByRole('button', { name: 'Accept Quest', exact: true }).click();
        await expect.poll(async () => (await readChronicleChapter(page, EARTH_DUNGEON_CHAPTER)).accepted).toBe(true);
        await page.locator('#btn-close-quest').click();
    }
    await openDungeonGuide(page);
    await verifyStoryOnlyEarthReadiness(page);
    await page.locator('#btn-close-dungeon-menu').click();
    await returnToTown(page);
    await loginAndEnterWorld(page, credentials);
    expect((await readChronicleChapter(page, hunt)).completed).toBe(true);
    expect(await readChronicleChapter(page, EARTH_DUNGEON_CHAPTER)).toMatchObject({ accepted: true, completed: false, count: 0 });
    const earned = await page.evaluate(() => ({ level: window.game.player.level, xp: window.game.player.xp, gold: window.game.player.gold }));
    await expect.poll(() => readSavedEarnedHandoff(credentials.username), { timeout: 30_000, intervals: [2000] })
        .toEqual({ ...earned, correctSaveKey: true, huntCompleted: true, dungeonAccepted: true, dungeonCount: 0, dungeonCompleted: false });
    console.log('[earned-saved-handoff]', JSON.stringify(earned));
}
