import { expect, test } from '@playwright/test';
import { EARTH_DUNGEON_CHAPTER, earnEarthCollectionThroughPlay, earnEarthImpAndScarThroughPlay,
    prepareEarthDungeonOfferThroughPlay, readChronicleChapter } from './chronicle-earth-route.js';
import { collectBrowserFailures, credentialsFromEnvironment, ensureDungeonReadyLevel,
    loginAndEnterWorld } from './helpers.js';
import { readStoryHuntFailureEvidence } from './story-hunt-combat-observer.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });
test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === testInfo.expectedStatus || page.isClosed()) return;
    const evidence = await readStoryHuntFailureEvidence(page);
    if (!evidence) return;
    await testInfo.attach('prepared-earth-failure', { body: JSON.stringify(evidence), contentType: 'application/json' });
    await page.screenshot({ path: testInfo.outputPath('prepared-earth-failure.png') });
    console.log('[prepared-earth-failure]', JSON.stringify(evidence));
});

const remainingSeeds = page => page.evaluate(() => window.game.player.inventory.reduce((sum, item) =>
    sum + (item?.name === 'Verdant Memory Seed' ? item.stack || 1 : 0), 0));

test.describe('prepared Earth prerequisites earned across saved chapter stages', () => {
    // Serial retries replay the entire chain on a new disposable character;
    // neither a retry nor a new page may manufacture a completed prerequisite.
    test.describe.configure({ mode: 'serial', timeout: 600_000 });
    let seedsAfterTurnIn;
    const stageCredentials = testInfo => {
        const credentials = credentialsFromEnvironment();
        test.skip(!credentials.username || !credentials.password, 'Requires a dedicated QA character');
        expect(process.env.EIDOLON_E2E_REGISTER, 'Collection route requires a fresh disposable character').toBe('1');
        return { ...credentials, username: testInfo.retry
            ? `${credentials.username}-retry${testInfo.retry}` : credentials.username };
    };

    test('opening, diary, Skeleton hunt and collection consume only the required Seeds', async ({ page, baseURL }, testInfo) => {
        const credentials = stageCredentials(testInfo);
        const failures = collectBrowserFailures(page, baseURL);
        await loginAndEnterWorld(page, credentials);
        // The only level preparation in the serial route. No quest/item grants.
        await ensureDungeonReadyLevel(page);
        await earnEarthCollectionThroughPlay(page);
        seedsAfterTurnIn = await remainingSeeds(page);
        await loginAndEnterWorld(page, credentials);
        expect(await remainingSeeds(page)).toBe(seedsAfterTurnIn);
        expect((await readChronicleChapter(page, 'chronicle_02_seeds_first_grove')).completed).toBe(true);
        expect(failures, failures.join('\n')).toEqual([]);
    });

    test('the same saved character earns the Imp hunt and scar investigation', async ({ page, baseURL }, testInfo) => {
        const credentials = stageCredentials(testInfo);
        const failures = collectBrowserFailures(page, baseURL);
        await loginAndEnterWorld(page, credentials);
        expect(seedsAfterTurnIn).toBeDefined();
        expect(await remainingSeeds(page)).toBe(seedsAfterTurnIn);
        await earnEarthImpAndScarThroughPlay(page);
        await loginAndEnterWorld(page, credentials);
        expect((await readChronicleChapter(page, 'chronicle_earth_returning_scar')).completed).toBe(true);
        expect(await remainingSeeds(page)).toBe(seedsAfterTurnIn);
        expect(failures, failures.join('\n')).toEqual([]);
    });

    test('the same saved character earns the Demon Orc hunt before accepting the dungeon', async ({ page, baseURL }, testInfo) => {
        const credentials = stageCredentials(testInfo);
        const failures = collectBrowserFailures(page, baseURL);
        await loginAndEnterWorld(page, credentials);
        expect(seedsAfterTurnIn).toBeDefined();
        expect(await remainingSeeds(page)).toBe(seedsAfterTurnIn);
        await prepareEarthDungeonOfferThroughPlay(page);
        await loginAndEnterWorld(page, credentials);
        expect(await remainingSeeds(page)).toBe(seedsAfterTurnIn);
        expect((await readChronicleChapter(page, EARTH_DUNGEON_CHAPTER)).accepted).toBe(true);
        expect(failures, failures.join('\n')).toEqual([]);
    });
});
