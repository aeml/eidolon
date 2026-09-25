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

// Continue the actual successful five-player kill, not a manufactured ready
// quest. Its Fighter already claimed; the other four players have not.
test('actual Dark King survivors manually claim once and retain their epilogue after login', async ({ page, browser, baseURL }, testInfo) => {
    test.skip(process.env.EIDOLON_E2E_FINALE_TURNIN !== '1', 'Explicit private post-clear continuation only');
    test.setTimeout(600_000);
    expect(testInfo.retry).toBe(0);
    requireIsolatedPartyFixture(process.env);
    const archive = '/tmp/eidolon-party-checkpoint-endgameking0924a-WkprCA/save.archive.gz';
    const info = lstatSync(archive);
    expect(info.isFile() && !info.isSymbolicLink() && (info.mode & 0o077) === 0).toBe(true);
    expect(createHash('sha256').update(readFileSync(archive)).digest('hex'))
        .toBe('3a0cd1fa1f800e31173927d09ff89032f237813d8f40c33f32faa2503d81310e');
    const container = process.env.EIDOLON_E2E_BUILD_MONGO_CONTAINER, port = process.env.EIDOLON_E2E_BUILD_MONGO_PORT;
    const options = { stdio: ['pipe', 'pipe', 'pipe'], timeout: 30_000 };
    execFileSync('docker', ['cp', archive, `${container}:/tmp/finale-checkpoint.archive.gz`], options);
    execFileSync('docker', ['exec', container, 'sh', '-c',
        'exec mongorestore --port "$1" --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --archive=/tmp/finale-checkpoint.archive.gz --gzip --nsInclude=eidolon.users --nsFrom=eidolon.users --nsTo=finale_checkpoint.users --stopOnError',
        'sh', port], options);
    const credentials = credentialsFromEnvironment(), actors = [], ownedBrowsers = [];
    const chapterId = DARK_KING_RAID.RestoredQuest;
    const receipt = actorPage => actorPage.evaluate(() => {
        const p = window.game.player;
        return { gold: p.gold, xp: p.xp, resonanceXP: p.resonanceXP };
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
            const script = `
                if (!db.getSiblingDB('admin').auth(process.env.MONGO_INITDB_ROOT_USERNAME, process.env.MONGO_INITDB_ROOT_PASSWORD)) throw Error('Auth failed');
                const users = db.getSiblingDB('finale_checkpoint').users.find({}).toArray();
                if (users.length !== 5 || users.some(u => u.characters?.length !== 1)) throw Error('Unexpected raid archive');
                const matches = users.map(u => u.characters[0]).filter(c => c.name.endsWith(${JSON.stringify(`-${role.toLowerCase()}-${index}`)}));
                if (matches.length !== 1) throw Error('Ambiguous survivor');
                const c = matches[0], q = c.quests.find(q => q.id === ${JSON.stringify(chapterId)});
                if (c.class !== ${JSON.stringify(role)} || c.level !== 100 || c.xp !== 245125 || c.resources.dead ||
                    c.gold !== ${index === 0 ? 20516 : 15516} || c.resonance_xp !== ${index === 0 ? 1502410 : 1012160} ||
                    !q?.accepted || q.count !== 1 || q.max_count !== 1 || q.completed !== ${index === 0}) throw Error('Unexpected saved clear/reward');
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
            expect(await readChronicleChapter(actorPage, chapterId)).toMatchObject({ count: 1, completed: index === 0 });
            expect(await receipt(actorPage)).toEqual({ gold: index === 0 ? 20516 : 15516, xp: 245125,
                resonanceXP: index === 0 ? 1502410 : 1012160 });
        }
        for (const [index, actor] of actors.entries()) {
            if (index === 0) await openIlyra(actor.page);
            else await claimChapterAndContinue(actor.page, chapterId);
            const letter = actor.page.locator('.quest-aftermath');
            await expect(letter).toBeVisible();
            if (await letter.getAttribute('open') === null) await letter.locator('summary').first().click();
            await expect(letter).toContainText('A Letter Without a Throne');
            await expect(letter.locator('p').first()).toBeVisible();
            await expect(actor.page.getByRole('button', { name: 'Complete Quest', exact: true })).toHaveCount(0);
            await actor.page.screenshot({ path: testInfo.outputPath(`finale-epilogue-${index}.png`) });
            expect(await receipt(actor.page)).toEqual({ gold: 20516, xp: 245125, resonanceXP: 1502410 });
            const claimed = await readChronicleChapter(actor.page, chapterId);
            expect(claimed).toMatchObject({ completed: true, grantedGold: 5000, grantedResonanceXP: 490250 });
            for (const waiting of actors.slice(index + 1)) {
                expect((await readChronicleChapter(waiting.page, chapterId)).completed).toBe(false);
            }
            await actor.page.locator('#btn-close-quest').click();
            await loginAndEnterWorld(actor.page, actor.login);
            expect(await readChronicleChapter(actor.page, chapterId)).toEqual(claimed);
            expect(await receipt(actor.page)).toEqual({ gold: 20516, xp: 245125, resonanceXP: 1502410 });
            await openIlyra(actor.page);
            await expect(actor.page.locator('.quest-aftermath')).toContainText('A Letter Without a Throne');
            await expect(actor.page.getByRole('button', { name: 'Complete Quest', exact: true })).toHaveCount(0);
            await actor.page.locator('#btn-close-quest').click();
            expect(actor.failures).toEqual([]);
            console.log(`[saved-finale-turn-in] ${index} ${actor.login.characterClass}: exact personal reward, epilogue and relogin passed`);
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
