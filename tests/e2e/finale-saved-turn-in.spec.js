import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { requireIsolatedPartyFixture } from '../partyDungeonFixture.js';
import { RAID_PARTY_ROLES, DARK_KING_RAID } from '../raidPartyFixture.js';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld, openGame } from './helpers.js';
import { claimChapterAndContinue, openIlyra, readChronicleChapter } from './chronicle-earth-route.js';
import { leaveEarnedParty } from './earned-earth-continuation.js';
import { hardwareWebGLBrowserArgs } from './browserLaunchPolicy.js';

test.use({ viewport: { width: 1280, height: 720 }, trace: 'off', screenshot: 'off', video: 'off' });

// Explicit immutable post-clear saves only; never manufacture ready quests or
// refresh their logout timestamps. Fire's completed defense hit a stale QA
// loop flag, so its remaining reward checks do not need another full fight.
const fire = process.env.EIDOLON_E2E_SAVED_RAID === 'fire';
const saved = fire ? {
    archive: '/tmp/eidolon-party-checkpoint-finalfire0926b-1UGY7j/save.archive.gz',
    sha: '8a8a777f55f3351702c44f505d07928c91a2d458a411faca885b95c38956f8c4',
    chapter: 'chronicle_12_ember_crown_raid', next: 'chronicle_13_skyglass_raid',
    before: { gold: 1849, xp: 6895, resonanceXP: 0, level: 70 },
    after: { gold: 3249, xp: 36676, resonanceXP: 0, level: 71 },
    reward: { grantedGold: 1400, grantedXP: 148906 }
} : {
    archive: '/tmp/eidolon-party-checkpoint-endgameking0924a-WkprCA/save.archive.gz',
    sha: '3a0cd1fa1f800e31173927d09ff89032f237813d8f40c33f32faa2503d81310e',
    chapter: DARK_KING_RAID.RestoredQuest,
    before: { gold: 15516, xp: 245125, resonanceXP: 1012160, level: 100 },
    after: { gold: 20516, xp: 245125, resonanceXP: 1502410, level: 100 },
    reward: { grantedGold: 5000, grantedResonanceXP: 490250 }
};
const alreadyClaimed = index => !fire && index === 0;

test('actual raid survivors manually claim once and retain their story handoff after login', async ({ page, browser, baseURL }, testInfo) => {
    test.skip(process.env.EIDOLON_E2E_FINALE_TURNIN !== '1', 'Explicit private post-clear continuation only');
    test.setTimeout(600_000);
    expect(testInfo.retry).toBe(0);
    expect(['', 'fire']).toContain(process.env.EIDOLON_E2E_SAVED_RAID || '');
    requireIsolatedPartyFixture(process.env);
    const archive = saved.archive;
    const info = lstatSync(archive);
    expect(info.isFile() && !info.isSymbolicLink() && (info.mode & 0o077) === 0).toBe(true);
    expect(createHash('sha256').update(readFileSync(archive)).digest('hex'))
        .toBe(saved.sha);
    const container = process.env.EIDOLON_E2E_BUILD_MONGO_CONTAINER, port = process.env.EIDOLON_E2E_BUILD_MONGO_PORT;
    const options = { stdio: ['pipe', 'pipe', 'pipe'], timeout: 30_000 };
    execFileSync('docker', ['cp', archive, `${container}:/tmp/finale-checkpoint.archive.gz`], options);
    execFileSync('docker', ['exec', container, 'sh', '-c',
        'exec mongorestore --port "$1" --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --archive=/tmp/finale-checkpoint.archive.gz --gzip --nsInclude=eidolon.users --nsFrom=eidolon.users --nsTo=finale_checkpoint.users --stopOnError',
        'sh', port], options);
    const credentials = credentialsFromEnvironment(), actors = [], ownedBrowsers = [];
    const chapterId = saved.chapter;
    const receipt = actorPage => actorPage.evaluate(() => {
        const p = window.game.player;
        return { gold: p.gold, xp: p.xp, resonanceXP: p.resonanceXP || 0, level: p.level };
    });
    try {
        for (const [index, role] of RAID_PARTY_ROLES.entries()) {
            let actorPage = page;
            if (index) {
                const extra = await browser.browserType().launch({ executablePath: process.env.EIDOLON_E2E_BROWSER_PATH || '/usr/bin/google-chrome',
                    headless: true, args: hardwareWebGLBrowserArgs() });
                ownedBrowsers.push(extra);
                actorPage = await (await extra.newContext({ baseURL, viewport: { width: 1280, height: 720 } })).newPage();
            }
            actorPage.setDefaultTimeout(30_000);
            const login = { ...credentials, username: `${credentials.username}-${role.toLowerCase()}-${index}`, characterClass: role };
            const actor = { page: actorPage, login, failures: collectBrowserFailures(actorPage, baseURL) };
            actors.push(actor);
            await openGame(actorPage);
            await actorPage.locator('#auth-username').fill(login.username);
            await actorPage.locator('#auth-password').fill(login.password);
            await actorPage.locator('#auth-email').fill(`${login.username}@example.invalid`);
            await actorPage.locator('#btn-register').click();
            await expect(actorPage.locator('#auth-status')).toContainText('Registration successful');
            const expectedBefore = alreadyClaimed(index) ? saved.after : saved.before;
            const script = `
                if (!db.getSiblingDB('admin').auth(process.env.MONGO_INITDB_ROOT_USERNAME, process.env.MONGO_INITDB_ROOT_PASSWORD)) throw Error('Auth failed');
                const users = db.getSiblingDB('finale_checkpoint').users.find({}).toArray();
                if (users.length !== 5 || users.some(u => u.characters?.length !== 1)) throw Error('Unexpected raid archive');
                const matches = users.map(u => u.characters[0]).filter(c => c.name.endsWith(${JSON.stringify(`-${role.toLowerCase()}-${index}`)}));
                if (matches.length !== 1) throw Error('Ambiguous survivor');
                const c = matches[0], q = c.quests.find(q => q.id === ${JSON.stringify(chapterId)});
                const expected = ${JSON.stringify(expectedBefore)};
                if (c.class !== ${JSON.stringify(role)} || c.level !== expected.level || c.xp !== expected.xp || c.resources.dead ||
                    c.gold !== expected.gold || (c.resonance_xp || 0) !== expected.resonanceXP ||
                    !q?.accepted || q.count !== 1 || q.max_count !== 1 || q.completed !== ${alreadyClaimed(index)}) throw Error('Unexpected saved clear/reward');
                c.name = ${JSON.stringify(login.username)};
                const target = db.getSiblingDB('eidolon').users;
                const result = target.updateOne({username:c.name,'characters.0':{$exists:false}}, {$set:{characters:[c]}});
                if (result.modifiedCount !== 1 || EJSON.stringify(target.findOne({username:c.name}).characters[0]) !== EJSON.stringify(c))
                    throw Error('Exact character transfer failed');
            `;
            execFileSync('docker', ['exec', '-i', container, 'mongosh', '--quiet', '--port', port, '--file', '/dev/stdin'],
                { ...options, input: script });
            await loginAndEnterWorld(actorPage, login);
            await leaveEarnedParty(actorPage);
            // Five independent native browsers share one GPU. Presentation has
            // separate accepted High/Low coverage; this route checks receipts.
            await actorPage.keyboard.press('Escape');
            await actorPage.locator('#btn-settings').click();
            await actorPage.locator('#graphics-quality').selectOption('low');
            await actorPage.locator('#btn-close-settings').click();
            if (await actorPage.locator('#esc-menu').isVisible()) await actorPage.locator('#btn-resume').click();
            expect(await readChronicleChapter(actorPage, chapterId)).toMatchObject({ count: 1, completed: alreadyClaimed(index) });
            expect(await receipt(actorPage)).toEqual(expectedBefore);
        }
        const expectStoryHandoff = async actorPage => {
            if (fire) {
                expect(await readChronicleChapter(actorPage, saved.next)).toMatchObject({ accepted: false, completed: false, count: 0 });
                await expect(actorPage.getByRole('button', { name: 'Accept Quest', exact: true })).toBeVisible();
            } else {
                const letter = actorPage.locator('.quest-aftermath');
                await expect(letter).toBeVisible();
                if (await letter.getAttribute('open') === null) await letter.locator('summary').first().click();
                await expect(letter).toContainText('A Letter Without a Throne');
                await expect(letter.locator('p').first()).toBeVisible();
            }
            await expect(actorPage.getByRole('button', { name: 'Complete Quest', exact: true })).toHaveCount(0);
        };
        for (const [index, actor] of actors.entries()) {
            if (alreadyClaimed(index)) await openIlyra(actor.page);
            else await claimChapterAndContinue(actor.page, chapterId);
            await expectStoryHandoff(actor.page);
            await actor.page.screenshot({ path: testInfo.outputPath(`saved-raid-handoff-${index}.png`) });
            expect(await receipt(actor.page)).toEqual(saved.after);
            const claimed = await readChronicleChapter(actor.page, chapterId);
            expect(claimed).toMatchObject({ completed: true, ...saved.reward });
            for (const waiting of actors.slice(index + 1)) {
                expect((await readChronicleChapter(waiting.page, chapterId)).completed).toBe(false);
            }
            await actor.page.locator('#btn-close-quest').click();
            await loginAndEnterWorld(actor.page, actor.login);
            expect(await readChronicleChapter(actor.page, chapterId)).toEqual(claimed);
            expect(await receipt(actor.page)).toEqual(saved.after);
            await openIlyra(actor.page);
            await expectStoryHandoff(actor.page);
            expect(await receipt(actor.page)).toEqual(saved.after);
            await actor.page.locator('#btn-close-quest').click();
            expect(actor.failures).toEqual([]);
            console.log(`[saved-raid-turn-in] ${chapterId} ${index} ${actor.login.characterClass}: exact personal reward, story handoff and relogin passed`);
        }
    } catch (error) {
        for (const [index, actor] of actors.entries()) {
            await actor.page.screenshot({ path: testInfo.outputPath(`turn-in-failure-${index}.png`) }).catch(() => {});
        }
        throw error;
    } finally {
        await Promise.all(ownedBrowsers.map(owned => owned.close()));
    }
});
