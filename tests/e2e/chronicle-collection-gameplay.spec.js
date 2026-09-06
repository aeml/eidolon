import { expect, test } from '@playwright/test';
import { EARTH_DUNGEON_CHAPTER, prepareEarthChronicleThroughPlay, readChronicleChapter } from './chronicle-earth-route.js';
import { collectBrowserFailures, credentialsFromEnvironment, ensureDungeonReadyLevel,
    loginAndEnterWorld } from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('earned Chronicle collection turn-in refreshes the bag before the next chapter', async ({ page, baseURL }) => {
    const credentials = credentialsFromEnvironment();
    test.skip(!credentials.username || !credentials.password, 'Requires a dedicated QA character');
    expect(process.env.EIDOLON_E2E_REGISTER, 'Collection route requires a fresh disposable character').toBe('1');
    test.setTimeout(600_000);
    const failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    // Functional level preparation only. The shared route earns its kills and
    // random relic drops normally and explicitly clicks Ilyra's turn-in actions.
    await ensureDungeonReadyLevel(page);
    await prepareEarthChronicleThroughPlay(page);
    const remainingSeeds = () => page.evaluate(() => window.game.player.inventory.reduce((sum, item) =>
        sum + (item?.name === 'Verdant Memory Seed' ? item.stack || 1 : 0), 0));
    const beforeReload = await remainingSeeds();
    await page.reload({ waitUntil: 'networkidle' });
    await loginAndEnterWorld(page, credentials);
    expect(await remainingSeeds()).toBe(beforeReload);
    expect((await readChronicleChapter(page, 'chronicle_02_seeds_first_grove')).completed).toBe(true);
    expect((await readChronicleChapter(page, EARTH_DUNGEON_CHAPTER)).accepted).toBe(true);
    expect(failures, failures.join('\n')).toEqual([]);
});
