import { expect, test } from '@playwright/test';
import {
    collectBrowserFailures,
    credentialsFromEnvironment,
    ensureDungeonReadyLevel,
    enterAndExitDungeon,
    exerciseCombatAndLoot,
    exerciseMenus,
    exerciseMovement,
    exerciseReconnect,
    loginAndEnterWorld,
    verifyPersistenceAfterFreshLogin
} from './helpers.js';

const credentials = credentialsFromEnvironment();
const hasCredentials = Boolean(credentials.username && credentials.password);

// Credentialed recordings can expose account identifiers or form inputs.
// The anonymous route retains all three failure artifact types.
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test.describe('dedicated QA character', () => {
    test.skip(!hasCredentials, 'Set EIDOLON_E2E_USERNAME and EIDOLON_E2E_PASSWORD for character QA');

    test('logs in, enters the world, moves, opens gameplay UI, and reconnects', async ({ page, baseURL }) => {
        test.setTimeout(300_000);
        const failures = collectBrowserFailures(page, baseURL);
        await loginAndEnterWorld(page, credentials);
        await exerciseMovement(page);
        await exerciseMenus(page);
        await exerciseReconnect(page);
        expect(failures, failures.join('\n')).toEqual([]);
    });

    test('kills and loots in the overworld, enters and exits a dungeon, and persists', async ({ page, baseURL }) => {
        test.skip(process.env.EIDOLON_E2E_FULL_GAMEPLAY !== '1', 'Enable for an extended disposable-character run');
        test.setTimeout(600_000);
        const failures = collectBrowserFailures(page, baseURL);
        await loginAndEnterWorld(page, credentials);
        await ensureDungeonReadyLevel(page);
        const inventoryCount = await exerciseCombatAndLoot(page);
        await enterAndExitDungeon(page);
        await exerciseReconnect(page);
        await verifyPersistenceAfterFreshLogin(page, credentials, inventoryCount);
        expect(failures, failures.join('\n')).toEqual([]);
    });

    test('enters and exits a dungeon through the allowlisted QA waypoint', async ({ page, baseURL }) => {
        test.skip(process.env.EIDOLON_E2E_PORTAL_ONLY !== '1', 'Enable for focused portal QA');
        test.setTimeout(300_000);
        const failures = collectBrowserFailures(page, baseURL);
        await loginAndEnterWorld(page, credentials);
        await ensureDungeonReadyLevel(page);
        await enterAndExitDungeon(page);
        expect(failures, failures.join('\n')).toEqual([]);
    });
});
