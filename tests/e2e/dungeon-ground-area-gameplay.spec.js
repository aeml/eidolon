import { expect, test } from '@playwright/test';
import {
    collectBrowserFailures, credentialsFromEnvironment, ensureDungeonReadyLevel, enterAndExitDungeon,
    loginAndEnterWorld, moveByGroundClick, projectGroundOffset, readPlayerState
} from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('ground spells reject dungeon walls without cooldown and still cast on reachable floor', async ({ page, baseURL }) => {
    const credentials = credentialsFromEnvironment();
    test.skip(!credentials.username || !credentials.password, 'Requires a dedicated QA character');
    test.skip((process.env.EIDOLON_E2E_CLASS || 'Wizard') !== 'Wizard', 'Wizard ground spell inspection');
    test.setTimeout(240_000);
    const failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    await ensureDungeonReadyLevel(page);
    await enterAndExitDungeon(page, { resetRun: true, beforeExit: async () => {
        const start = await page.evaluate(() => window.game.currentDungeonLayout.rooms[0]);
        const destinationZ = start.z + start.height / 2 - 8;
        const deadline = Date.now() + 45_000;
        while (Date.now() < deadline) {
            const player = await readPlayerState(page);
            if (Math.abs(destinationZ - player.z) < 2) break;
            await moveByGroundClick(page, 0, Math.max(-12, Math.min(12, destinationZ - player.z)), {
                allowJumpFallback: false, minimumDistance: 0.5
            });
        }
        expect(Math.abs((await readPlayerState(page)).z - destinationZ)).toBeLessThan(2);
        await expect.poll(() => page.evaluate(() => window.game.player.state)).toBe('IDLE');
        await page.evaluate(() => {
            const game = window.game;
            const original = game.handleServerMessage.bind(game);
            window.__groundCastResults = [];
            window.__groundCasts = [];
            game.handleServerMessage = message => {
                if (message.type === 'ability_result') window.__groundCastResults.push(message.payload);
                if (message.type === 'ability' && message.payload?.sourceId === game.player.id) {
                    window.__groundCasts.push(message.payload);
                }
                return original(message);
            };
        });
        for (const [branchName, spells] of [
            ['Pyromancer', ['Meteor Drop', 'Inferno Cataclysm']],
            ['Control & Utility', ['Gravity Well']]
        ]) {
            await page.keyboard.press('k');
            const skills = page.locator('#skill-tree-window');
            await expect(skills).toBeVisible();
            await skills.getByRole('button', { name: 'Skills', exact: true }).click();
            const branch = page.locator('.skill-branch').filter({ hasText: branchName });
            const select = branch.getByRole('button', { name: 'Select Spec' });
            if (await select.count()) await select.click();
            await expect.poll(() => page.evaluate(skill => window.game.player.hotbar.indexOf(skill), spells[0])).toBeGreaterThanOrEqual(0);
            await page.locator('#btn-close-skills').click();
            for (const skill of spells) {
                const key = String(1 + await page.evaluate(skill => window.game.player.hotbar.indexOf(skill), skill));
                const blocked = await projectGroundOffset(page, 0, 12);
                expect(blocked?.canvas).toBe(true);
                await page.mouse.move(blocked.x, blocked.y);
                await page.keyboard.press(key);
                await expect.poll(() => page.evaluate(skill => window.__groundCastResults.filter(result => result.skillName === skill).length, skill)).toBe(1);
                const result = await page.evaluate(skill => window.__groundCastResults.find(result => result.skillName === skill), skill);
                expect(result).toEqual(expect.objectContaining({ accepted: false, reason: 'requirements_not_met', cooldownRemaining: 0 }));
                expect(await page.evaluate(skill => window.__groundCasts.filter(cast => cast.skillName === skill).length, skill)).toBe(0);
                await expect.poll(() => page.evaluate(skill => window.game.player.cooldowns?.[skill] || 0, skill)).toBe(0);

                const floor = await projectGroundOffset(page, 6, 0);
                expect(floor?.canvas).toBe(true);
                await page.mouse.move(floor.x, floor.y);
                await page.keyboard.press(key);
                await expect.poll(() => page.evaluate(skill => window.__groundCastResults.filter(result => result.skillName === skill).length, skill)).toBe(2);
                expect(await page.evaluate(skill => window.__groundCastResults.filter(result => result.skillName === skill)[1].accepted, skill)).toBe(true);
                await expect.poll(() => page.evaluate(skill => window.__groundCasts.filter(cast => cast.skillName === skill).length, skill)).toBe(1);
                if (skill === 'Meteor Drop') {
                    await expect.poll(() => page.evaluate(() => window.game.lastProjectileImpactPresentation?.projectileType), { timeout: 10_000 }).toBe('Meteor');
                }
                await page.waitForTimeout(600); // ordinary global cooldown before the next skill
                console.log(`[dungeon-ground] ${skill}: blocked placement rejected, reachable floor accepted`);
            }
        }
    } });
    expect(failures, failures.join('\n')).toEqual([]);
});
