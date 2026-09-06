import { expect, test } from '@playwright/test';
import {
    collectBrowserFailures, credentialsFromEnvironment, ensureDungeonReadyLevel, enterAndExitDungeon,
    loginAndEnterWorld, moveByGroundClick, projectGroundOffset, readPlayerState
} from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('a real Wizard fireball ends at the dungeon wall with no false explosion footprint', async ({ page, baseURL }) => {
    const credentials = credentialsFromEnvironment();
    test.skip(!credentials.username || !credentials.password, 'Requires a dedicated QA character');
    test.skip((process.env.EIDOLON_E2E_CLASS || 'Wizard') !== 'Wizard', 'Wizard-specific projectile presentation route');
    test.setTimeout(240_000);
    const failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    await ensureDungeonReadyLevel(page);
    expect(await page.evaluate(() => window.game.player.abilityName), 'Run this inspection with EIDOLON_E2E_CLASS=Wizard').toBe('Fireball');
    await enterAndExitDungeon(page, { resetRun: true, beforeExit: async () => {
        const start = await page.evaluate(() => window.game.currentDungeonLayout.rooms[0]);
        // Walk to the north wall, away from the generated southward route.
        // No inside-instance waypoint or direct player-position mutation.
        const destinationZ = start.z + start.height / 2 - 8;
        const walkDeadline = Date.now() + 45_000;
        while (Date.now() < walkDeadline) {
            const player = await readPlayerState(page);
            if (Math.abs(destinationZ - player.z) < 2) break;
            await moveByGroundClick(page, 0, Math.max(-12, Math.min(12, destinationZ - player.z)), {
                allowJumpFallback: false, minimumDistance: Math.max(0.5, Math.min(6, Math.abs(destinationZ - player.z) / 2))
            });
        }
        expect(Math.abs((await readPlayerState(page)).z - destinationZ)).toBeLessThan(2);
        await page.evaluate(() => {
            const game = window.game;
            const original = game.handleServerMessage.bind(game);
            window.__wallInspectionImpacts = [];
            game.handleServerMessage = message => {
                if (message.type === 'projectile_impact' && message.payload?.projectileType === 'Fireball' &&
                    message.payload.instanceId === game.currentInstanceId && message.payload.sourceId === game.player.id) {
                    window.__wallInspectionImpacts.push({ x: message.payload.x, z: message.payload.z,
                        radius: message.payload.radius, terminal: message.payload.terminal,
                        hasTarget: Boolean(message.payload.targetId) });
                }
                return original(message);
            };
        });
        let aim;
        await expect.poll(async () => {
            aim = await projectGroundOffset(page, 0, 16);
            return Boolean(aim?.canvas);
        }).toBe(true);
        await page.mouse.move(aim.x, aim.y);
        await page.mouse.click(aim.x, aim.y, { button: 'right' });
        await expect.poll(() => page.evaluate(() => window.__wallInspectionImpacts.some(impact =>
            impact.terminal && !impact.hasTarget && impact.radius === 0)), { timeout: 15_000 }).toBe(true);
        const impacts = await page.evaluate(() => window.__wallInspectionImpacts);
        const wall = impacts.find(impact => impact.terminal && !impact.hasTarget && impact.radius === 0);
        expect(wall, `Expected a zero-radius terminal wall impact: ${JSON.stringify(impacts)}`).toBeTruthy();
        expect(Math.abs(wall.z - (start.z + start.height / 2))).toBeLessThan(0.1);
        await expect.poll(() => page.evaluate(() => window.game.lastProjectileImpactPresentation?.radius)).toBe(0);
        console.log('[dungeon-wall] ordinary fireball cast produced an authoritative wall impact and zero-radius client feedback');
    } });
    expect(failures, failures.join('\n')).toEqual([]);
});
