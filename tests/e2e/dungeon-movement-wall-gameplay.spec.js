import { expect, test } from '@playwright/test';
import {
    collectBrowserFailures, credentialsFromEnvironment, ensureDungeonReadyLevel, enterAndExitDungeon,
    jumpByGroundClick, loginAndEnterWorld, moveByGroundClick, readPlayerState
} from './helpers.js';
import { aimAtGroundPoint } from './ground-aim.js';

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
            window.__movementObservation = { samples: [], outgoing: [] };
            const send = game.network.send.bind(game.network);
            game.network.send = (type, payload) => {
                if (type === 'ability' || type === 'move') {
                    const samples = window.__movementObservation.outgoing;
                    samples.push({ type, x: payload.x, z: payload.z, targetX: payload.targetX,
                        targetZ: payload.targetZ, skill: payload.skillName, state: payload.state });
                    if (samples.length > 20) samples.shift();
                }
                return send(type, payload);
            };
            game.handleServerMessage = message => {
                if (message.type === 'ability' && message.payload?.skillName === skill &&
                    message.payload.sourceId === game.player.id) {
                    window.__dungeonMovementCast = { x: message.payload.targetX, z: message.payload.targetZ };
                }
                return original(message);
            };
        }, skill);
        const beforeCast = await readPlayerState(page);
        const aim = await aimAtGroundPoint(page, { x: beforeCast.x, z: northWall + 4 });
        expect(aim?.canvas).toBe(true);
        console.log('[movement-before]', JSON.stringify(await page.evaluate(({ northWall, aim }) => ({
            northWall, aim, position: window.game.player.position.toArray(),
            target: window.game.player.targetPosition?.toArray(),
            camera: window.game.renderSystem.camera.position.toArray(),
            rects: window.game.currentDungeonLayout.walkRects.slice(0, 6)
        }), { northWall, aim })));
        await page.mouse.move(aim.x, aim.y);
        if (className === 'Wizard') await page.keyboard.press('1');
        else await page.mouse.click(aim.x, aim.y, { button: 'right' });
        await expect.poll(() => page.evaluate(() => Boolean(window.__dungeonMovementCast))).toBe(true);
        const cast = await page.evaluate(() => window.__dungeonMovementCast);
        console.log('[movement-cast]', JSON.stringify(cast));
        expect(Math.abs(cast.z - northWall)).toBeLessThan(0.1);
        try {
            await expect.poll(async () => {
                const state = await readPlayerState(page);
                console.log('[movement-position]', JSON.stringify({ x: state.x, z: state.z, state: state.state }));
                return Math.abs(state.z - northWall);
            }).toBeLessThan(2);
        } finally {
            console.log('[movement-outgoing]', JSON.stringify(await page.evaluate(() => window.__movementObservation)));
        }
        await expect.poll(() => page.evaluate(() => window.game.player.state)).toBe('IDLE');
        await walkToZ(northWall - 8);
        await expect.poll(() => page.evaluate(() => window.game.player.state)).toBe('IDLE');
        if (className === 'Wizard') {
            await expect.poll(() => page.evaluate(() => window.game.player.cooldowns.Teleport || 0)).toBe(0);
            const beforeShort = await readPlayerState(page);
            await aimAtGroundPoint(page, { x: beforeShort.x + 1.5, z: beforeShort.z });
            await page.evaluate(() => { window.__dungeonMovementCast = null; });
            await page.keyboard.press('1');
            await expect.poll(() => page.evaluate(() => Boolean(window.__dungeonMovementCast))).toBe(true);
            const shortCast = await page.evaluate(() => window.__dungeonMovementCast);
            expect(Math.hypot(shortCast.x - beforeShort.x, shortCast.z - beforeShort.z)).toBeGreaterThan(1);
            expect(Math.hypot(shortCast.x - beforeShort.x, shortCast.z - beforeShort.z)).toBeLessThan(3);
            await expect.poll(async () => {
                const after = await readPlayerState(page);
                return Math.hypot(after.x - shortCast.x, after.z - shortCast.z);
            }).toBeLessThan(.15);
            // Cross the server movement lock and an ordinary idle heartbeat:
            // the old prediction must not overwrite this accepted short blink.
            await page.waitForTimeout(1200);
            const settled = await readPlayerState(page);
            expect(Math.hypot(settled.x - shortCast.x, settled.z - shortCast.z)).toBeLessThan(.15);
            console.log('[movement-short-blink]', JSON.stringify({ requested: shortCast,
                settled: { x: settled.x, z: settled.z } }));
        }
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
