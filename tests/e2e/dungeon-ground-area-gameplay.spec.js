import { expect, test } from '@playwright/test';
import { approachSettledGround } from '../settledGroundApproach.js';
import {
    collectBrowserFailures, credentialsFromEnvironment, ensureDungeonReadyLevel, enterAndExitDungeon,
    loginAndEnterWorld, moveByGroundClick, projectGroundOffset, readPlayerState, selectGraphicsThroughSettings
} from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('ground spells reject dungeon walls without cooldown and still cast on reachable floor', async ({ page, baseURL }, testInfo) => {
    const credentials = credentialsFromEnvironment();
    test.skip(!credentials.username || !credentials.password, 'Requires a dedicated QA character');
    test.skip((process.env.EIDOLON_E2E_CLASS || 'Wizard') !== 'Wizard', 'Wizard ground spell inspection');
    expect(testInfo.retry).toBeLessThanOrEqual(1);
    if (testInfo.retry) credentials.username += `-retry${testInfo.retry}`;
    test.setTimeout(240_000);
    const failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    await ensureDungeonReadyLevel(page);
    const trained = process.env.EIDOLON_E2E_GROUND_TALENTS === '1';
    if (trained) {
        expect(await page.evaluate(() => window.game.player.talentRanks?.WIZ_38 || 0),
            'The dedicated attempt must start with untrained Mana Geometry').toBe(0);
        await page.keyboard.press('k');
        const skills = page.locator('#skill-tree-window');
        await expect(skills).toBeVisible();
        await skills.getByRole('button', { name: 'Talents', exact: true }).click();
        for (let rank = 1; rank <= 5; rank++) {
            const talent = skills.locator('.skill-node').filter({ has: page.locator('.skill-node-title', { hasText: 'Mana Geometry' }) });
            await talent.scrollIntoViewIfNeeded();
            await talent.click();
            await expect.poll(() => page.evaluate(() => window.game.player.talentRanks?.WIZ_38 || 0)).toBe(rank);
            await page.waitForTimeout(300);
        }
        await page.locator('#btn-close-skills').click();
    }
    await enterAndExitDungeon(page, { resetRun: true, beforeExit: async () => {
        const start = await page.evaluate(() => window.game.currentDungeonLayout.rooms[0]);
        const destinationZ = start.z + start.height / 2 - 8;
        const readApproach = () => page.evaluate(() => {
            const game = window.game, p = game.player;
            const cameraDistance = Math.hypot(game.renderSystem.cameraTarget.x - p.position.x,
                game.renderSystem.cameraTarget.z - p.position.z);
            return { x: p.position.x, z: p.position.z, state: p.state,
                targetPosition: p.targetPosition?.toArray?.() || null, cameraDistance,
                settled: p.state === 'IDLE' && !p.targetPosition && cameraDistance < .05 };
        });
        try {
            await approachSettledGround({ destinationZ, read: readApproach,
                settle: deadline => expect.poll(() => readApproach().then(state => state.settled),
                    { timeout: Math.max(1, deadline - Date.now()) }).toBe(true),
                move: (x, z) => moveByGroundClick(page, x, z, {
                    allowJumpFallback: false, minimumDistance: 0.5
                }) });
            expect(Math.abs((await readPlayerState(page)).z - destinationZ)).toBeLessThan(2);
        } catch (error) {
            const state = await readApproach().catch(() => null);
            await testInfo.attach('ground-approach-failure', { body: JSON.stringify({ start, destinationZ, state }), contentType: 'application/json' });
            await page.screenshot({ path: testInfo.outputPath('ground-approach-failure.png') }).catch(() => {});
            throw error;
        }
        await expect.poll(() => page.evaluate(() => window.game.player.state)).toBe('IDLE');
        await page.evaluate(() => {
            const game = window.game;
            const original = game.handleServerMessage.bind(game);
            window.__groundCastResults = [];
            window.__groundCasts = [];
            window.__groundShapes = [];
            game.handleServerMessage = message => {
                if (message.type === 'ability_result') window.__groundCastResults.push(message.payload);
                if (message.type === 'ability' && message.payload?.sourceId === game.player.id) {
                    window.__groundCasts.push(message.payload);
                }
                const result = original(message);
                if (message.type === 'ability' && message.payload?.sourceId === game.player.id) {
                    const shapes = game.effects.filter(effect => effect.isActive && effect.abilityShape?.sourceId === game.player.id && effect.abilityShape?.skillName === message.payload.skillName);
                    window.__groundShapes.push({ skill: message.payload.skillName, shapes: shapes.map(effect => {
                        const root = effect.meshes[0];
                        const boundary = root.children.find(part => part.userData.normalizedGameplayRadius === 1);
                        return { radius: boundary?.scale.x, x: root.position.x, z: root.position.z,
                            attached: root.parent === game.renderSystem.effectGroup, authoritative: effect.abilityShape.authoritative };
                    }) });
                }
                return result;
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
                if (trained) await selectGraphicsThroughSettings(page, skill === 'Inferno Cataclysm' ? 'low' : 'high');
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
                if (trained) {
                    const expectedRadius = { 'Meteor Drop': 29.04, 'Inferno Cataclysm': 13.2, 'Gravity Well': 8.8 }[skill];
                    const observed = await page.evaluate(skill => ({ cast: window.__groundCasts.find(cast => cast.skillName === skill),
                        mesh: window.__groundShapes.find(shape => shape.skill === skill) }), skill);
                    expect(observed.cast.radius).toBeCloseTo(expectedRadius, 6);
                    expect(observed.mesh.shapes.length).toBeGreaterThan(0);
                    for (const shape of observed.mesh.shapes) {
                        expect(shape).toMatchObject({ attached: true, authoritative: true });
                        expect(shape.radius).toBeCloseTo(expectedRadius, 6);
                        expect(shape.x).toBeCloseTo(observed.cast.targetX, 5);
                        expect(shape.z).toBeCloseTo(observed.cast.targetZ, 5);
                    }
                    if (skill === 'Inferno Cataclysm') {
                        await expect.poll(() => page.evaluate(() => [...window.game.remotePlayers.values()].find(entity =>
                            entity.type === 'ZoneDamage' && entity.owner?.id === window.game.player.id)?.mesh?.userData.gameplayRadius), { timeout: 5000 }).toBeCloseTo(13.2, 4);
                    }
                }
                if (skill === 'Meteor Drop') {
                    await expect.poll(() => page.evaluate(() => window.game.lastProjectileImpactPresentation?.projectileType), { timeout: 10_000 }).toBe('Meteor');
                    if (trained) expect(await page.evaluate(() => window.game.lastProjectileImpactPresentation.radius)).toBeCloseTo(29.04, 4);
                }
                await page.waitForTimeout(600); // ordinary global cooldown before the next skill
                console.log(`[dungeon-ground] ${skill}: blocked placement rejected, reachable floor accepted`);
            }
        }
    } });
    if (trained) {
        await loginAndEnterWorld(page, credentials);
        await expect.poll(() => page.evaluate(() => window.game.player.talentRanks?.WIZ_38 || 0)).toBe(5);
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
