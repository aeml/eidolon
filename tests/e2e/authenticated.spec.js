import { expect, test } from '@playwright/test';
import {
    collectBrowserFailures,
    credentialsFromEnvironment,
    ensureDungeonReadyLevel,
    enterAndExitDungeon,
    exerciseAreaHazards,
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
        test.setTimeout(600_000);
        const failures = collectBrowserFailures(page, baseURL);
        await loginAndEnterWorld(page, credentials);
        await page.evaluate(() => {
            const game = window.game;
            window.__questQASends = [];
            const originalSend = game.network.send.bind(game.network);
            game.network.send = (type, payload) => {
                window.__questQASends.push({ type, payload });
                return originalSend(type, payload);
            };
            game.uiManager.toggleQuestWindow();
        });
        try {
            await expect.poll(() => page.evaluate(() =>
                window.game?.player?.quests?.some?.((quest) => quest.id === 'daily_skeleton') || false
            ), {
                message: 'opening the quest giver must reconcile the level-one starter daily catalog',
                timeout: 20_000
            }).toBe(true);
        } catch (error) {
            const diagnostic = await page.evaluate(() => ({
                sent: window.__questQASends,
                socket: window.game?.network?.socket?.readyState,
                queuedTypes: window.game?.network?.messageQueue?.map?.((message) => message.type),
                quests: window.game?.player?.quests,
                requestCallback: typeof window.game?.uiManager?.quest?.onRequestQuests,
                questText: document.getElementById('quest-list')?.textContent
            }));
            throw new Error(`Quest giver did not reconcile the starter catalog: ${JSON.stringify(diagnostic)}`, {
                cause: error
            });
        }
        if (process.env.EIDOLON_E2E_REGISTER === '1') {
            await expect(page.locator('#quest-list').getByRole('button', { name: 'Accept Quest' }).first()).toBeVisible();
        }
        await page.evaluate(() => window.game?.uiManager?.toggleQuestWindow());
        await exerciseMovement(page);
        await exerciseMenus(page);
        await exerciseReconnect(page);
        expect(failures, failures.join('\n')).toEqual([]);
    });

    test('kills and loots in the overworld, enters and exits a dungeon, and persists', async ({ page, baseURL }) => {
        test.skip(process.env.EIDOLON_E2E_FULL_GAMEPLAY !== '1', 'Enable for an extended disposable-character run');
        test.setTimeout(900_000);
        const failures = collectBrowserFailures(page, baseURL);
        await loginAndEnterWorld(page, credentials);
        await ensureDungeonReadyLevel(page);
        await exerciseAreaHazards(page);
        const inventoryCount = await exerciseCombatAndLoot(page);
        await enterAndExitDungeon(page);
        await exerciseReconnect(page);
        await verifyPersistenceAfterFreshLogin(page, credentials, inventoryCount);
        expect(failures, failures.join('\n')).toEqual([]);
    });

    test('enters and exits a dungeon through the allowlisted QA waypoint', async ({ page, baseURL }) => {
        test.skip(process.env.EIDOLON_E2E_PORTAL_ONLY !== '1', 'Enable for focused portal QA');
        test.setTimeout(600_000);
        const failures = collectBrowserFailures(page, baseURL);
        await loginAndEnterWorld(page, credentials);
        await ensureDungeonReadyLevel(page);
        await enterAndExitDungeon(page);
        expect(failures, failures.join('\n')).toEqual([]);
    });
});
