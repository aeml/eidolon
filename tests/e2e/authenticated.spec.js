import { expect, test } from '@playwright/test';
import { profileGameplayScene } from './scene-performance.js';
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

    test('logs in, enters the world, moves, opens gameplay UI, and reconnects', async ({ page, baseURL }, testInfo) => {
        test.setTimeout(600_000);
        const failures = collectBrowserFailures(page, baseURL);
        if (process.env.EIDOLON_E2E_CAPTURE_VISUALS === '1' || process.env.EIDOLON_E2E_PROFILE_VISUALS === '1') await page.setViewportSize({ width: 1440, height: 1000 });
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
            await page.locator('#quest-list .quest-contract').first().click();
            await expect(page.locator('#quest-list').getByRole('button', { name: 'Accept Quest' }).first()).toBeVisible();
        }
        await page.evaluate(() => window.game?.uiManager?.toggleQuestWindow());
        if (process.env.EIDOLON_E2E_PROFILE_VISUALS === '1') {
            for (const quality of ['high', 'low']) {
                await page.evaluate((quality) => window.game.renderSystem.setGraphicsQuality(quality), quality);
                for (const state of ['closed', 'preview', 'closed-again']) {
                    await page.evaluate((state) => {
                        const ui = window.game.uiManager;
                        ui.closePrimaryHudMenus();
                        if (state === 'preview') ui.toggleCharacterSheet();
                    }, state);
                    const metrics = await profileGameplayScene(page, `${quality}-${state}`);
                    console.log(`Scene profile: ${JSON.stringify(metrics)}`);
                    await testInfo.attach(`scene-${quality}-${state}`, { body: JSON.stringify(metrics, null, 2), contentType: 'application/json' });
                    expect(metrics.frames).toBe(180);
                    expect(metrics.previewFramesDuringSample).toBe(0);
                }
            }
            await page.evaluate(() => window.game.renderSystem.setGraphicsQuality('high'));
        }
        if (process.env.EIDOLON_E2E_CAPTURE_VISUALS === '1') {
            // Opt-in component crops only: no authentication forms, account
            // identifiers, chat transcripts or full-page credentialed captures.
            for (const id of ['game-timer', 'objectives-panel', 'player-hud']) {
                await page.locator(`#${id}`).screenshot({ path: testInfo.outputPath(`polish-${id}.png`) });
            }
            // A ground-only crop right of the local actor and away from chat.
            await page.screenshot({ path: testInfo.outputPath('polish-town-surface.png'), clip: { x: 900, y: 350, width: 480, height: 280 } });
            for (const [key, id] of [['i', 'inventory-screen'], ['j', 'quest-journal'], ['k', 'skill-tree-window']]) {
                await page.keyboard.press(key);
                await expect(page.locator(`#${id}`)).toBeVisible();
                await expect.poll(() => page.locator(`#${id}`).evaluate((element) => {
                    const bounds = element.getBoundingClientRect();
                    const header = element.querySelector('.window-header').getBoundingClientRect();
                    return {
                        fits: bounds.x >= 0 && bounds.y >= 0 && bounds.right <= innerWidth && bounds.bottom <= innerHeight,
                        headerUncovered: element.contains(document.elementFromPoint(header.x + 20, header.y + header.height / 2)),
                        aboveHud: ['objectives-panel', 'game-timer'].every((id) =>
                            Number(getComputedStyle(document.getElementById(id)).zIndex) < Number(getComputedStyle(element).zIndex))
                    };
                })).toEqual({ fits: true, headerUncovered: true, aboveHud: true });
                await page.locator(`#${id}`).screenshot({ path: testInfo.outputPath(`polish-${id}.png`) });
                await page.keyboard.press('Escape');
            }
        }
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
