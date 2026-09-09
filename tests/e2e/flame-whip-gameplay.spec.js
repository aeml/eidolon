import { expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, ensureDungeonReadyLevel, enterAndExitDungeon,
    loginAndEnterWorld, projectGroundOffset, selectGraphicsThroughSettings } from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('trained Flame Whip preserves accepted geometry, presentation and saved ranks', async ({ page, baseURL }) => {
    const credentials = credentialsFromEnvironment();
    test.skip(!credentials.username || !credentials.password, 'Requires a disposable QA character');
    test.skip((process.env.EIDOLON_E2E_CLASS || 'Wizard') !== 'Wizard', 'Wizard cone verification');
    test.setTimeout(240_000);
    const failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    await ensureDungeonReadyLevel(page);
    await enterAndExitDungeon(page, { resetRun: true, beforeExit: async () => {
        await page.keyboard.press('k');
        const skills = page.locator('#skill-tree-window');
        await expect(skills).toBeVisible();
        await skills.getByRole('button', { name: 'Skills', exact: true }).click();
        const branch = skills.locator('.skill-branch').filter({ hasText: 'Pyromancer' });
        const select = branch.getByRole('button', { name: 'Select Spec' });
        if (await select.count()) await select.click();
        await expect.poll(() => page.evaluate(() => window.game.player.hotbar.indexOf('Flame Whip'))).toBeGreaterThanOrEqual(0);
        const key = String(1 + await page.evaluate(() => window.game.player.hotbar.indexOf('Flame Whip')));
        await page.locator('#btn-close-skills').click();
        // Observe the normal wire handler after it reconciles the actual mesh;
        // do not send casts, allocate ranks or manufacture effects from evaluate.
        await page.evaluate(() => {
            window.__whipObservations = [];
            const game = window.game;
            const receive = game.handleServerMessage.bind(game);
            game.handleServerMessage = message => {
                const result = receive(message);
                if (message.type === 'ability' && message.payload?.sourceId === game.player.id && message.payload.skillName === 'Flame Whip') {
                    const effect = game.effects.find(effect => effect.isActive && effect.abilityShape?.sourceId === game.player.id && effect.abilityShape?.skillName === 'Flame Whip');
                    const root = effect?.meshes?.[0];
                    const boundary = root?.children.find(part => part.userData.normalizedGameplayRadius === 1);
                    window.__whipObservations.push({ radius: message.payload.radius, arc: message.payload.arc,
                        meshRadius: boundary?.scale.x, meshArc: boundary?.geometry.parameters.thetaLength,
                        attached: root?.parent === game.renderSystem.effectGroup,
                        authoritative: effect?.abilityShape.authoritative, quality: game.uiManager.getGraphicsQuality() });
                }
                return result;
            };
        });
        for (const rank of [0, 5]) {
            if (rank) {
                await page.keyboard.press('k');
                await skills.getByRole('button', { name: 'Talents', exact: true }).click();
                for (let next = 1; next <= rank; next++) {
                    const talent = skills.locator('.skill-node').filter({ has: page.locator('.skill-node-title', { hasText: 'Mana Geometry' }) });
                    await talent.scrollIntoViewIfNeeded();
                    await talent.click();
                    await expect.poll(() => page.evaluate(() => window.game.player.talentRanks?.WIZ_38 || 0)).toBe(next);
                    // Desktop ranks are optimistic; final accepted shape and the
                    // fresh login independently verify the actual purchases.
                    await page.waitForTimeout(300);
                }
                await page.locator('#btn-close-skills').click();
            }
            for (const quality of ['high', 'low']) {
                await selectGraphicsThroughSettings(page, quality);
                await expect.poll(() => page.evaluate(() => window.game.player.cooldowns?.['Flame Whip'] || 0), { timeout: 15_000 }).toBe(0);
                const count = await page.evaluate(() => window.__whipObservations.length);
                const aim = await projectGroundOffset(page, 0, -4);
                expect(aim?.canvas).toBe(true);
                await page.mouse.move(aim.x, aim.y);
                await page.keyboard.press(key);
                await expect.poll(() => page.evaluate(() => window.__whipObservations.length)).toBe(count + 1);
                const observation = await page.evaluate(() => window.__whipObservations.at(-1));
                expect(observation).toMatchObject({ attached: true, authoritative: true, quality });
                expect(observation.radius).toBeCloseTo(rank ? 14.52 : 12, 8);
                expect(observation.meshRadius).toBeCloseTo(observation.radius, 8);
                expect(observation.arc).toBeCloseTo(Math.PI / 2, 8);
                expect(observation.meshArc).toBeCloseTo(observation.arc, 8);
                console.log(`[flame-whip] Mana Geometry ${rank}/5, ${quality}: accepted shape and actual mesh match`);
            }
        }
    } });
    await loginAndEnterWorld(page, credentials);
    await expect.poll(() => page.evaluate(() => window.game.player.talentRanks?.WIZ_38 || 0)).toBe(5);
    expect(failures, failures.join('\n')).toEqual([]);
});
