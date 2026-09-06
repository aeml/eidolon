import { expect, test } from '@playwright/test';
import {
    collectBrowserFailures, credentialsFromEnvironment, ensureDungeonReadyLevel, enterAndExitDungeon,
    jumpByGroundClick, loginAndEnterWorld, moveByGroundClick, projectGroundOffset, readPlayerState
} from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('dungeon movement casts and jumps stop at the wall and still permit ordinary movement', async ({ page, baseURL }) => {
    const credentials = credentialsFromEnvironment();
    const className = process.env.EIDOLON_E2E_CLASS || 'Wizard';
    test.skip(!credentials.username || !credentials.password, 'Requires a dedicated QA character');
    test.skip(!['Wizard', 'Fighter'].includes(className), 'Ground-cast movement route for Wizard and Fighter');
    test.setTimeout(240_000);
    const failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    await ensureDungeonReadyLevel(page);
    const skill = className === 'Wizard' ? 'Teleport' : 'Charge';
    if (className === 'Wizard') {
        await page.keyboard.press('k');
        const skills = page.locator('#skill-tree-window');
        await expect(skills).toBeVisible();
        await skills.getByRole('button', { name: 'Skills', exact: true }).click();
        const branch = page.locator('.skill-branch').filter({ hasText: 'Control & Utility' });
        await expect(branch).toHaveCount(1);
        const select = branch.getByRole('button', { name: 'Select Spec' });
        if (await select.count()) await select.click();
        await expect.poll(() => page.evaluate(() => window.game.player.hotbar?.[0])).toBe('Teleport');
        await page.locator('#btn-close-skills').click();
    }
    await enterAndExitDungeon(page, { resetRun: true, beforeExit: async () => {
        const start = await page.evaluate(() => window.game.currentDungeonLayout.rooms[0]);
        const northWall = start.z + start.height / 2;
        const walkToZ = async destination => {
            const deadline = Date.now() + 45_000;
            while (Date.now() < deadline) {
                const state = await readPlayerState(page);
                if (Math.abs(state.z - destination) < 2) return;
                await moveByGroundClick(page, 0, Math.max(-12, Math.min(12, destination - state.z)), {
                    allowJumpFallback: false, minimumDistance: 0.5
                });
            }
            throw new Error('Could not reach the movement inspection point using ground clicks');
        };
        await walkToZ(northWall - 8);
        await expect.poll(() => page.evaluate(() => window.game.player.state)).toBe('IDLE');
        await page.evaluate(skill => {
            const game = window.game;
            const original = game.handleServerMessage.bind(game);
            window.__dungeonMovementCast = null;
            game.handleServerMessage = message => {
                if (message.type === 'ability' && message.payload?.skillName === skill &&
                    message.payload.sourceId === game.player.id) {
                    window.__dungeonMovementCast = { x: message.payload.targetX, z: message.payload.targetZ };
                }
                return original(message);
            };
        }, skill);
        const aim = await projectGroundOffset(page, 0, 12);
        expect(aim?.canvas).toBe(true);
        await page.mouse.move(aim.x, aim.y);
        if (className === 'Wizard') await page.keyboard.press('1');
        else await page.mouse.click(aim.x, aim.y, { button: 'right' });
        await expect.poll(() => page.evaluate(() => Boolean(window.__dungeonMovementCast))).toBe(true);
        const cast = await page.evaluate(() => window.__dungeonMovementCast);
        expect(Math.abs(cast.z - northWall)).toBeLessThan(0.1);
        await expect.poll(async () => Math.abs((await readPlayerState(page)).z - northWall)).toBeLessThan(2);
        await expect.poll(() => page.evaluate(() => window.game.player.state)).toBe('IDLE');
        await walkToZ(northWall - 8);
        await jumpByGroundClick(page, 0, 12);
        const landing = await readPlayerState(page);
        expect(landing.z).toBeLessThanOrEqual(northWall + 0.1);
        expect(landing.z).toBeGreaterThan(northWall - 3);
        await jumpByGroundClick(page, 8, -8);
        expect((await readPlayerState(page)).z).toBeLessThan(landing.z - 3);
        console.log(`[dungeon-movement] ${skill} event/landing and Ctrl-click wall/open-floor jumps agree`);
    } });
    expect(failures, failures.join('\n')).toEqual([]);
});
