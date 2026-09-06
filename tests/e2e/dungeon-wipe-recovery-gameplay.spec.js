import { expect, test } from '@playwright/test';
import { buildDungeonTraversalRoutes } from '../dungeonTraversalRoutes.js';
import {
    collectBrowserFailures, credentialsFromEnvironment, ensureDungeonReadyLevel,
    enterAndExitDungeon, loginAndEnterWorld, moveByGroundClick, readPlayerState
} from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('ordinary dungeon death requires respawn and preserves the unfinished run on re-entry', async ({ page, baseURL }) => {
    const credentials = credentialsFromEnvironment();
    test.skip(!credentials.username || !credentials.password || process.env.EIDOLON_E2E_REGISTER !== '1', 'Requires a fresh disposable character');
    test.setTimeout(300_000);
    const failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    await ensureDungeonReadyLevel(page, 30);
    let seed;
    let cleared;
    // The town guide avoids the protected QA waypoint altogether. Only the
    // character's level is a QA fixture; no health/kill/protection command is used.
    await enterAndExitDungeon(page, { useTownGuide: true, resetRun: true, beforeExit: async () => {
        const layout = await page.evaluate(() => window.game.currentDungeonLayout);
        seed = layout.generationSeed;
        console.log(`[dungeon-recovery] replay ${JSON.stringify({ seed, generator: layout.generatorVersion,
            class: process.env.EIDOLON_E2E_CLASS || 'Wizard', level: 30,
            sourceCommit: process.env.EIDOLON_E2E_SOURCE_COMMIT, sourceDirty: process.env.EIDOLON_E2E_SOURCE_DIRTY === '1' })}`);
        await page.evaluate(() => {
            const game = window.game;
            const original = game.handleServerMessage.bind(game);
            window.__dungeonRecoveryHits = 0;
            game.handleServerMessage = message => {
                if (message.type === 'damage' && message.payload?.targetId === game.player.id &&
                    Number(message.payload.amount) > 0) window.__dungeonRecoveryHits++;
                return original(message);
            };
        });
        const route = buildDungeonTraversalRoutes(layout)[0];
        const walkDeadline = Date.now() + 90_000;
        for (const destination of route) {
            while ((await readPlayerState(page)).state !== 'DEAD') {
                const player = await readPlayerState(page);
                const distance = Math.hypot(destination.x - player.x, destination.z - player.z);
                if (distance < 3) break;
                if (Date.now() > walkDeadline) throw new Error('Could not reach the first encounter through its normal corridor');
                const scale = Math.min(1, 12 / distance);
                try {
                    await moveByGroundClick(page, (destination.x - player.x) * scale, (destination.z - player.z) * scale,
                        { allowJumpFallback: false });
                } catch (error) {
                    if ((await readPlayerState(page)).state !== 'DEAD') throw error;
                }
            }
        }
        await expect.poll(() => page.evaluate(() => window.__dungeonRecoveryHits), { timeout: 60_000 }).toBeGreaterThan(0);
        await expect.poll(async () => (await readPlayerState(page)).state, { timeout: 120_000 }).toBe('DEAD');
        cleared = await page.evaluate(() => window.game.currentDungeonRoomState.rooms.map(room => room.cleared));
        await expect(page.locator('#death-screen')).toBeVisible();
        await page.keyboard.press('b');
        await expect(page.locator('#chat-messages')).toContainText('use Respawn to recover in Lanternhold');
        expect((await readPlayerState(page)).instanceType).not.toBe('overworld');
        await expect(page.locator('#death-screen')).toBeVisible();
        console.log(`[dungeon-recovery] ordinary hostile death and rejected recall; seed ${seed}`);
        // The enclosing helper uses the visible Respawn button for DEAD actors.
    } });
    expect((await readPlayerState(page)).state).not.toBe('DEAD');
    expect(await page.evaluate(() => window.game.player.stats.hp)).toBeGreaterThan(0);
    await enterAndExitDungeon(page, { useTownGuide: true, beforeExit: async () => {
        expect(await page.evaluate(() => window.game.currentDungeonLayout.generationSeed)).toBe(seed);
        expect(await page.evaluate(() => window.game.currentDungeonRoomState.rooms.map(room => room.cleared))).toEqual(cleared);
        console.log('[dungeon-recovery] explicit respawn and normal guide re-entry preserved the unfinished run');
    } });
    expect(failures, failures.join('\n')).toEqual([]);
});
