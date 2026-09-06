import { expect, test } from '@playwright/test';
import {
    collectBrowserFailures, credentialsFromEnvironment, ensureDungeonReadyLevel, enterAndExitDungeon,
    loginAndEnterWorld, moveByGroundClick, projectGroundOffset, readPlayerState, selectGraphicsThroughSettings
} from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('ordinary Scorch Beam casts match the server endpoint at both graphics settings', async ({ page, baseURL }) => {
    const credentials = credentialsFromEnvironment();
    test.skip(!credentials.username || !credentials.password, 'Requires a dedicated QA character');
    test.skip((process.env.EIDOLON_E2E_CLASS || 'Wizard') !== 'Wizard', 'Wizard beam inspection');
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
        await page.keyboard.press('k');
        const skills = page.locator('#skill-tree-window');
        await expect(skills).toBeVisible();
        await skills.getByRole('button', { name: 'Skills', exact: true }).click();
        const branch = page.locator('.skill-branch').filter({ hasText: 'Single-Target Caster' });
        const select = branch.getByRole('button', { name: 'Select Spec' });
        if (await select.count()) await select.click();
        await expect.poll(() => page.evaluate(() => window.game.player.hotbar.indexOf('Scorch Beam'))).toBeGreaterThanOrEqual(0);
        const key = String(1 + await page.evaluate(() => window.game.player.hotbar.indexOf('Scorch Beam')));
        await page.locator('#btn-close-skills').click();
        // Observe actual production meshes and accepted events, without creating
        // effects, moving actors or calling the ability/network APIs ourselves.
        await page.evaluate(() => {
            const game = window.game;
            window.__beamMeshes = [];
            window.__beamEvents = [];
            const spawn = game.spawnTransientEffect.bind(game);
            game.spawnTransientEffect = (...args) => {
                const result = spawn(...args);
                if (args[0] === 'beam' && args[3]?.abilityName === 'Scorch Beam') {
                    const root = game.effects.at(-1)?.meshes?.[0];
                    const tip = root?.getObjectByName('Wizard:Scorch Beam:0:beam:TargetBrand');
                    if (tip) {
                        const endpoint = tip.getWorldPosition(game.player.position.clone());
                        window.__beamMeshes.push({ x: endpoint.x, z: endpoint.z,
                            sourceX: game.player.position.x, sourceZ: game.player.position.z,
                            attached: root.parent === game.renderSystem.effectGroup,
                            quality: game.uiManager.getGraphicsQuality() });
                    }
                }
                return result;
            };
            const receive = game.handleServerMessage.bind(game);
            game.handleServerMessage = message => {
                if (message.type === 'ability' && message.payload?.sourceId === game.player.id &&
                    message.payload.skillName === 'Scorch Beam') {
                    window.__beamEvents.push({ x: message.payload.targetX, z: message.payload.targetZ });
                }
                return receive(message);
            };
        });
        for (const quality of ['high', 'low']) {
            await selectGraphicsThroughSettings(page, quality);
            for (const wall of [true, false]) {
                await expect.poll(() => page.evaluate(() => window.game.player.cooldowns?.['Scorch Beam'] || 0),
                    { timeout: 15_000 }).toBe(0);
                const previous = await page.evaluate(() => window.__beamEvents.length);
                // Aim only four units away: the open cast must extend beyond
                // the cursor; the northward cast must stop at the room wall.
                const aim = await projectGroundOffset(page, 0, wall ? 4 : -4);
                expect(aim?.canvas).toBe(true);
                await page.mouse.move(aim.x, aim.y);
                await page.keyboard.press(key);
                await expect.poll(() => page.evaluate(() => window.__beamEvents.length)).toBe(previous + 1);
                const observation = await page.evaluate(() => ({ mesh: window.__beamMeshes.at(-1), event: window.__beamEvents.at(-1) }));
                expect(observation.mesh).toEqual(expect.objectContaining({ quality, attached: true }));
                expect(observation.mesh.x).toBeCloseTo(observation.event.x, 1);
                expect(observation.mesh.z).toBeCloseTo(observation.event.z, 1);
                if (wall) {
                    expect(observation.mesh.z).toBeCloseTo(start.z + start.height / 2, 1);
                } else {
                    expect(Math.hypot(observation.mesh.x - observation.mesh.sourceX,
                        observation.mesh.z - observation.mesh.sourceZ)).toBeCloseTo(18, 1);
                }
                console.log(`[dungeon-beam] ${quality}, wall=${wall}: actual mesh matches accepted endpoint`);
            }
        }
    } });
    expect(failures, failures.join('\n')).toEqual([]);
});
