import { expect, test } from '@playwright/test';
import {
    collectBrowserFailures, credentialsFromEnvironment, ensureDungeonReadyLevel,
    findOverworldTarget, loginAndEnterWorld, moveByGroundClick, projectEntity,
    projectGroundOffset, returnToTown, useCombatQAWaypoint
} from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('hostile marks reject an empty cast and accept an actual reachable enemy', async ({ page, baseURL }) => {
    const credentials = credentialsFromEnvironment();
    const className = process.env.EIDOLON_E2E_CLASS || 'Wizard';
    test.skip(!credentials.username || !credentials.password, 'Requires a dedicated QA character');
    test.skip(!['Cleric', 'Rogue'].includes(className), 'Direct hostile marks belong to Cleric and Rogue');
    test.setTimeout(240_000);
    const failures = collectBrowserFailures(page, baseURL);
    const skill = className === 'Cleric' ? 'Mark of Weakness' : 'Weak Point Mark';
    const branchName = className === 'Cleric' ? 'Buff/Debuff Support' : 'Assassin Burst Path';
    await loginAndEnterWorld(page, credentials);
    await ensureDungeonReadyLevel(page);
    await page.keyboard.press('k');
    const skills = page.locator('#skill-tree-window');
    await expect(skills).toBeVisible();
    await skills.getByRole('button', { name: 'Skills', exact: true }).click();
    const branch = page.locator('.skill-branch').filter({ hasText: branchName });
    await expect(branch).toHaveCount(1);
    const select = branch.getByRole('button', { name: 'Select Spec' });
    if (await select.count()) await select.click();
    await expect.poll(() => page.evaluate(skill => window.game.player.hotbar.indexOf(skill), skill)).toBeGreaterThanOrEqual(0);
    const key = String(1 + await page.evaluate(skill => window.game.player.hotbar.indexOf(skill), skill));
    await page.locator('#btn-close-skills').click();
    await returnToTown(page);
    await page.evaluate(skill => {
        const game = window.game;
        const original = game.handleServerMessage.bind(game);
        window.__directCastResults = [];
        window.__directCastTargets = [];
        game.handleServerMessage = message => {
            if (message.type === 'ability_result' && message.payload?.skillName === skill) {
                window.__directCastResults.push(message.payload);
            }
            if (message.type === 'ability' && message.payload?.skillName === skill &&
                message.payload.sourceId === game.player.id) {
                window.__directCastTargets.push(message.payload.targetId);
            }
            return original(message);
        };
    }, skill);
    const empty = await projectGroundOffset(page, 7, 2);
    expect(empty?.canvas).toBe(true);
    await page.mouse.move(empty.x, empty.y);
    await page.keyboard.press(key);
    await expect.poll(() => page.evaluate(() => window.__directCastResults.length)).toBe(1);
    expect(await page.evaluate(() => window.__directCastResults[0])).toEqual(expect.objectContaining({
        accepted: false, reason: 'requirements_not_met', cooldownRemaining: 0
    }));
    expect(await page.evaluate(() => window.__directCastTargets)).toEqual([]);
    await expect.poll(() => page.evaluate(skill => window.game.player.cooldowns?.[skill] || 0, skill)).toBe(0);

    // Protection is only incoming-damage QA setup. Selection, movement and
    // casting use ordinary controls against a normal authoritative enemy.
    await useCombatQAWaypoint(page);
    const target = await findOverworldTarget(page);
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
        const offset = await page.evaluate(id => {
            const game = window.game;
            const enemy = game.remotePlayers.get(id);
            if (!enemy?.isActive || enemy.state === 'DEAD') return null;
            return { x: enemy.position.x - game.player.position.x, z: enemy.position.z - game.player.position.z };
        }, target.id);
        expect(offset, 'selected ordinary enemy must remain alive').not.toBeNull();
        const distance = Math.hypot(offset.x, offset.z);
        if (distance < 6) break;
        const scale = Math.min(8, distance - 4) / distance;
        await moveByGroundClick(page, offset.x * scale, offset.z * scale, { allowJumpFallback: false });
    }
    await expect.poll(async () => {
        const aim = await projectEntity(page, target.id);
        if (!aim?.visible) return false;
        await page.mouse.move(aim.x, aim.y);
        return page.evaluate(id => window.game.hoveredEntity?.id === id &&
            window.game.hoveredEntity.position.distanceTo(window.game.player.position) < 8, target.id);
    }).toBe(true);
    await page.keyboard.press(key);
    await expect.poll(() => page.evaluate(() => window.__directCastResults.length)).toBe(2);
    const accepted = await page.evaluate(() => window.__directCastResults[1]);
    expect(accepted.accepted).toBe(true);
    expect(accepted.cooldownRemaining).toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(() => window.__directCastTargets)).toEqual([target.id]);
    console.log(`[direct-target] ${className} empty rejection and authoritative enemy mark passed`);
    await returnToTown(page);
    expect(failures, failures.join('\n')).toEqual([]);
});
