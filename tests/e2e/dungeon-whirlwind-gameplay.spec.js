import { expect, test } from '@playwright/test';
import {
    collectBrowserFailures, credentialsFromEnvironment, ensureDungeonReadyLevel, enterAndExitDungeon,
    loginAndEnterWorld, moveByGroundClick, selectGraphicsThroughSettings
} from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('ordinary Whirlwind and Extended casts follow the player for the server-owned duration', async ({ page, baseURL }) => {
    const credentials = credentialsFromEnvironment();
    test.skip(!credentials.username || !credentials.password, 'Requires a dedicated QA character');
    test.skip((process.env.EIDOLON_E2E_CLASS || 'Wizard') !== 'Fighter', 'Fighter duration inspection');
    test.setTimeout(240_000);
    const failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    await ensureDungeonReadyLevel(page);
    await enterAndExitDungeon(page, { resetRun: true, beforeExit: async () => {
        await page.keyboard.press('k');
        const skills = page.locator('#skill-tree-window');
        await expect(skills).toBeVisible();
        await skills.getByRole('button', { name: 'Skills', exact: true }).click();
        const branch = page.locator('.skill-branch').filter({ hasText: 'Shield & Mitigation' });
        const select = branch.getByRole('button', { name: 'Select Spec' });
        if (await select.count()) await select.click();
        await expect.poll(() => page.evaluate(() => window.game.player.hotbar.indexOf('Whirlwind'))).toBeGreaterThanOrEqual(0);
        const key = String(1 + await page.evaluate(() => window.game.player.hotbar.indexOf('Whirlwind')));
        await page.locator('#btn-close-skills').click();
        // Observe production effects and snapshots only. All casts, movement,
        // graphics changes and rune selections use normal player controls.
        await page.evaluate(() => {
            const game = window.game;
            window.__spinCasts = [];
            const spawn = game.spawnTransientEffect.bind(game);
            game.spawnTransientEffect = (...args) => {
                const previous = game.player.whirlwindCastEffect;
                const result = spawn(...args);
                const effect = game.player.whirlwindCastEffect;
                if (effect && effect !== previous) {
                    const record = { duration: effect.duration, frames: [] };
                    window.__spinCasts.push(record);
                    const update = effect.update.bind(effect);
                    effect.update = dt => {
                        update(dt);
                        record.frames.push({ elapsed: effect.elapsed, active: effect.isActive,
                            acknowledged: effect.authoritativeSeen, x: effect.root.position.x,
                            z: effect.root.position.z, playerX: game.player.position.x,
                            playerZ: game.player.position.z, attached: Boolean(effect.root.parent) });
                    };
                }
                return result;
            };
        });
        for (const extended of [false, true]) {
            if (extended) {
                await page.keyboard.press('k');
                await skills.getByRole('button', { name: 'Runes', exact: true }).click();
                const card = skills.getByText('Whirlwind', { exact: true }).locator('..');
                await card.getByText('Extended', { exact: true }).click();
                await expect.poll(() => page.evaluate(() => window.game.player.skillRunes?.Whirlwind)).toBe('whirlwind_extended');
                await page.locator('#btn-close-skills').click();
            }
            for (const quality of ['high', 'low']) {
                await selectGraphicsThroughSettings(page, quality);
                await expect.poll(() => page.evaluate(() => window.game.player.cooldowns?.Whirlwind || 0), { timeout: 15_000 }).toBe(0);
                await expect.poll(() => page.evaluate(() => window.game.player.state)).toBe('IDLE');
                const count = await page.evaluate(() => window.__spinCasts.length);
                await page.keyboard.press(key);
                await expect.poll(() => page.evaluate(() => window.__spinCasts.length), { intervals: [20] }).toBe(count + 1);
                await moveByGroundClick(page, quality === 'high' ? 4 : -4, 0, { allowJumpFallback: false, minimumDistance: 0.5 });
                await expect.poll(() => page.evaluate(() => Boolean(window.game.player.whirlwindCastEffect?.isActive))).toBe(false);
                const record = await page.evaluate(() => window.__spinCasts.at(-1));
                const duration = extended ? 2 : 1;
                expect(record.duration).toBeCloseTo(duration, 1);
                const active = record.frames.filter(frame => frame.active);
                expect(active.some(frame => frame.acknowledged)).toBe(true);
                expect(active.at(-1).elapsed).toBeGreaterThan(duration - 0.25);
                expect(active.at(-1).elapsed).toBeLessThan(duration + 0.5);
                expect(active.every(frame => frame.attached && Math.hypot(frame.x - frame.playerX, frame.z - frame.playerZ) < 0.01)).toBe(true);
                expect(Math.max(...active.map(frame => frame.x)) - Math.min(...active.map(frame => frame.x))).toBeGreaterThan(0.5);
                expect(await page.evaluate(() => window.__spinCasts.length)).toBe(count + 1);
                console.log(`[dungeon-whirlwind] ${quality}, extended=${extended}: acknowledged ${duration}s spin follows ordinary movement`);
            }
        }
    } });
    expect(failures, failures.join('\n')).toEqual([]);
});
