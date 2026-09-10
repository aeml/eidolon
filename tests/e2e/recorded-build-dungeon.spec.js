import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { earnedBuildCharacter, requireIsolatedBuildFixture } from '../earnedBuildDiagnostic.js';
import { dungeonPlaythroughOptions } from '../dungeonPlaythroughCatalog.js';
import { playDungeonThroughInputs } from './dungeon-playthrough-route.js';
import { createEarnedDungeonCombat } from './earned-dungeon-combat.js';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld, openGame } from './helpers.js';
import { readEarnedRestResources } from './earned-town-rest.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });
test('recorded level31 Wizard survives the Warden using ordinary town preparation and combat', async ({ page, baseURL }) => {
    test.skip(process.env.EIDOLON_E2E_EARNED_BUILD_DIAGNOSTIC !== '1', 'Explicit isolated recorded-build diagnostic only');
    test.setTimeout(1_200_000);
    requireIsolatedBuildFixture(process.env);
    const credentials = credentialsFromEnvironment();
    const record = JSON.parse(readFileSync('tests/fixtures/earned-wizard-31.json', 'utf8'));
    const failures = collectBrowserFailures(page, baseURL);
    await openGame(page);
    await page.locator('#auth-username').fill(credentials.username);
    await page.locator('#auth-password').fill(credentials.password);
    await page.locator('#auth-email').fill(`${credentials.username}@example.invalid`);
    await page.locator('#btn-register').click();
    await expect(page.locator('#auth-status')).toContainText('Registration successful');
    const character = earnedBuildCharacter(record, credentials.username);
    const script = `
        if (!db.getSiblingDB('admin').auth(process.env.MONGO_INITDB_ROOT_USERNAME, process.env.MONGO_INITDB_ROOT_PASSWORD)) throw Error('Fixture auth failed');
        const r = db.getSiblingDB('eidolon').users.updateOne(
            { username: ${JSON.stringify(credentials.username)}, 'characters.0': { $exists: false } },
            { $set: { characters: [${JSON.stringify(character)}] } });
        if (r.matchedCount !== 1 || r.modifiedCount !== 1) throw Error('Requires one newly registered empty account');
    `;
    try {
        execFileSync('docker', ['exec', '-i', process.env.EIDOLON_E2E_BUILD_MONGO_CONTAINER, 'mongosh',
            '--quiet', '--port', process.env.EIDOLON_E2E_BUILD_MONGO_PORT, '--file', '/dev/stdin'],
        { input: script, stdio: ['pipe', 'pipe', 'pipe'], timeout: 20_000 });
    } catch { throw new Error('Could not seed disposable recorded-build diagnostic'); }
    await loginAndEnterWorld(page, credentials);
    const build = await page.evaluate(() => {
        const p = window.game.player;
        return { level: p.level, baseStats: p.baseStats, talentRanks: p.talentRanks,
            branch: p.selectedBranch, unlockedSkills: p.unlockedSkills, hotbar: p.hotbar,
            equipment: Object.fromEntries(Object.entries(p.equipment).map(([slot, item]) => [slot, { id: item.id, stats: item.stats }])) };
    });
    expect(build.level).toBe(record.level);
    expect(build.baseStats).toMatchObject(record.stats);
    expect(build.talentRanks).toEqual(record.talentRanks);
    expect(build.branch).toBe(record.selectedBranch);
    expect(build.unlockedSkills).toEqual(expect.arrayContaining(record.unlockedSkills));
    expect(build.hotbar).toEqual(expect.arrayContaining(['Teleport', 'Arcane Shield', 'Gravity Well']));
    for (const [slot, item] of Object.entries(record.equipment)) expect(build.equipment[slot]).toEqual({ id: item.id, stats: item.stats });
    await expect.poll(async () => {
        const p = await readEarnedRestResources(page);
        return !p.dead && p.zone === 'lanternhold' && p.hp === p.maxHP && p.mana === p.maxMana;
    }).toBe(true);
    const combat = await createEarnedDungeonCombat(page, 'Wizard');
    const firstBossComplete = new Error('Recorded-build first-boss diagnostic complete; not a full dungeon clear');
    let reachedBoss = false, confirmedBossDeath = false;
    console.log('[recorded-build-dungeon]', JSON.stringify({ source: record.sourceCommit, level: build.level,
        stats: build.baseStats, talents: build.talentRanks, note: record.note }));
    try {
        await playDungeonThroughInputs(page, { playthrough: dungeonPlaythroughOptions({}),
            fullRun: true, useTownGuide: true, recoverBetweenRooms: true,
            beforeCombat: async (p, target) => {
                if (target.type === 'RootboundWarden' && !reachedBoss) {
                    reachedBoss = true;
                    console.log('[recorded-build-warden-entry]', JSON.stringify(await readEarnedRestResources(page)));
                }
                return combat(p, target);
            },
            afterEncounter: async (_p, target) => {
                if (target.type !== 'RootboundWarden') return;
                confirmedBossDeath = true;
                console.log('[recorded-build-warden-dead]', JSON.stringify(await readEarnedRestResources(page)));
                throw firstBossComplete; // Deliberate bounded diagnostic; ordinary helper Recall still executes.
            } });
    } catch (error) { if (error !== firstBossComplete) throw error; }
    expect(reachedBoss).toBe(true);
    expect(confirmedBossDeath).toBe(true);
    expect(failures, failures.join('\n')).toEqual([]);
});
