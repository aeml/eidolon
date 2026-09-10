import { expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, enterDungeon, loginAndEnterWorld, returnToTown } from './helpers.js';
import { hardwareWebGLBrowserArgs } from './browserLaunchPolicy.js';

test.use({ viewport: { width: 1280, height: 720 }, trace: 'off', screenshot: 'off', video: 'off' });

test('four real party members repeatedly recall and individually resume through the town guide', async ({ page, browser, baseURL }) => {
    test.skip(process.env.EIDOLON_E2E_PARTY_GUIDE !== '1', 'Explicit isolated party re-entry diagnostic');
    test.setTimeout(600_000);
    expect(process.env.EIDOLON_E2E_REGISTER).toBe('1');
    expect(process.env.EIDOLON_E2E_WS_URL).toMatch(/^ws:\/\/127\.0\.0\.1:\d+\/ws$/);
    const credentials = credentialsFromEnvironment(), ownedBrowsers = [], actors = [];
    const instance = actor => actor.page.evaluate(() => window.game.currentInstanceId);
    try {
        for (const [index, role] of ['Fighter', 'Cleric', 'Wizard', 'Rogue'].entries()) {
            let actorPage = page;
            if (index) {
                const extra = await browser.browserType().launch({
                    executablePath: process.env.EIDOLON_E2E_BROWSER_PATH || '/usr/bin/google-chrome',
                    headless: true, args: hardwareWebGLBrowserArgs()
                });
                ownedBrowsers.push(extra);
                actorPage = await (await extra.newContext({ baseURL, viewport: { width: 1280, height: 720 } })).newPage();
            }
            const login = { ...credentials, username: `${credentials.username}-${role.toLowerCase()}`, characterClass: role };
            const actor = { page: actorPage, role, login, failures: collectBrowserFailures(actorPage, baseURL) };
            actors.push(actor);
            await loginAndEnterWorld(actorPage, login);
            // Prepared entry eligibility only; this route contains no combat,
            // forced room completion, earned progression or dungeon-clear claim.
            await actorPage.locator('#chat-input').click();
            await actorPage.locator('#chat-input').fill('/level 30');
            await actorPage.locator('#chat-input').press('Enter');
            await expect.poll(() => actorPage.evaluate(() => window.game.player.level)).toBe(30);
        }
        const leader = actors[0];
        await leader.page.keyboard.press('o');
        await expect(leader.page.locator('#social-window')).toBeVisible();
        for (const actor of actors.slice(1)) {
            await leader.page.locator('#party-invite-input').fill(actor.login.username);
            await leader.page.locator('#btn-invite-party').click();
            await expect(actor.page.locator('#party-request-modal')).toBeVisible();
            await actor.page.locator('#btn-accept-party').click();
        }
        await leader.page.keyboard.press('Escape');
        await expect(leader.page.locator('#social-window')).toBeHidden();
        await expect.poll(() => leader.page.evaluate(() => window.game.uiManager.social.partyData?.members?.length)).toBe(4);
        await enterDungeon(leader.page, { useTownGuide: true, resetRun: true });
        const run = await instance(leader);
        expect(run).toBeTruthy();
        for (const actor of actors) await expect.poll(() => instance(actor)).toBe(run);
        for (let cycle = 1; cycle <= 3; cycle++) {
            await Promise.all(actors.map(actor => returnToTown(actor.page, { allowRespawn: false })));
            for (const actor of actors) {
                console.log('[party-guide-reentry]', JSON.stringify({ cycle, role: actor.role, phase: 'approach' }));
                await enterDungeon(actor.page, { useTownGuide: true, resetRun: false });
                await expect.poll(() => instance(actor)).toBe(run);
                expect(await actor.page.evaluate(() => window.game.player.state)).not.toBe('DEAD');
                console.log('[party-guide-reentry]', JSON.stringify({ cycle, role: actor.role, phase: 'resumed-same-instance' }));
            }
        }
        for (const actor of actors) expect(actor.failures, actor.failures.join('\n')).toEqual([]);
    } finally {
        for (const extra of ownedBrowsers) await extra.close();
    }
});
