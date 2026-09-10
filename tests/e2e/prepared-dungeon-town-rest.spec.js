import { expect, test } from '@playwright/test';
import { dungeonPlaythroughOptions } from '../dungeonPlaythroughCatalog.js';
import { playDungeonThroughInputs } from './dungeon-playthrough-route.js';
import { initializePreparedDungeonFixture } from './prepared-dungeon-fixture.js';
import { prepareDungeonWizard } from './prepared-dungeon-wizard.js';
import { createEarnedWizardDefense } from './earned-wizard-defense.js';
import { readEarnedRestResources } from './earned-town-rest.js';
import { collectBrowserFailures, credentialsFromEnvironment, enterAndExitDungeon,
    loginAndEnterWorld } from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });
const snapshot = page => page.evaluate(async () => {
    const { dungeonRestSnapshot } = await import('/tests/dungeonRestSnapshot.js');
    return dungeonRestSnapshot(window.game);
});

test('prepared post-combat town rest restores spent mana and preserves the unfinished dungeon', async ({ page, baseURL }) => {
    const credentials = credentialsFromEnvironment();
    test.skip(process.env.EIDOLON_E2E_PREPARED_DUNGEON_REST !== '1' ||
        !credentials.username || !credentials.password || process.env.EIDOLON_E2E_REGISTER !== '1',
    'Explicit isolated prepared diagnostic only; never an earned campaign substitute');
    test.setTimeout(1_500_000);
    const failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    await initializePreparedDungeonFixture(page);
    await prepareDungeonWizard(page);
    const playthrough = dungeonPlaythroughOptions({});
    const beforeCombat = await createEarnedWizardDefense(page);
    let progress, spent;
    const recoveredRooms = [];
    await playDungeonThroughInputs(page, { playthrough, fullRun: false, useTownGuide: false, beforeCombat,
        recoverBetweenRooms: true,
        afterTownRecovery: async (_page, { roomIndex }) => { recoveredRooms.push(roomIndex); },
        afterClearedRoute: async () => {
            progress = await snapshot(page);
            spent = await readEarnedRestResources(page);
            expect(spent.dead).toBe(false);
            expect(spent.mana, 'actual combat must spend mana before Recall').toBeLessThan(spent.maxMana);
            expect(progress.rooms.some(room => room.cleared)).toBe(true);
            expect(progress.rooms.some(room => !room.cleared)).toBe(true);
        } });
    expect(recoveredRooms.length, 'must recover mid-route then walk onward and defeat the later boss').toBeGreaterThan(0);
    const arrived = await readEarnedRestResources(page);
    expect(arrived.zone).toBe('lanternhold');
    expect(arrived.dead).toBe(false);
    await expect.poll(async () => {
        const p = await readEarnedRestResources(page);
        return !p.dead && p.hp === p.maxHP && p.mana === p.maxMana;
    }, { timeout: 15_000, message: 'ordinary sanctuary time restores resources without fixture commands' }).toBe(true);
    const rested = await readEarnedRestResources(page);
    expect(rested.level).toBe(spent.level);
    expect(rested.bank).toBeGreaterThanOrEqual(arrived.bank);
    // No reset, login, health command or new waypoint after combat. The real
    // town guide must resume the same partially completed run.
    await enterAndExitDungeon(page, { ...playthrough, useTownGuide: true, beforeExit: async () => {
        expect(await snapshot(page)).toEqual(progress);
        expect((await readEarnedRestResources(page)).dead).toBe(false);
    } });
    console.log('[prepared-dungeon-town-rest]', JSON.stringify({ spent, arrived, rested,
        seed: progress.seed, generator: progress.generator, rooms: progress.rooms,
        note: 'Prepared two-boss mana recovery and same-run re-entry; not earned balance or depleted-HP recovery.' }));
    expect(failures, failures.join('\n')).toEqual([]);
});
