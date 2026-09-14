import { test, expect } from '@playwright/test';
import { credentialsFromEnvironment, loginAndEnterWorld, moveByGroundClick, readPlayerState, collectBrowserFailures, exerciseReconnect } from './helpers.js';

const credentials = credentialsFromEnvironment();
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('casino door enters one shared safe hall, keeps tables distinct, and guards the VIP stairs', async ({ page, context, baseURL }) => {
    test.skip(!credentials.username, 'Requires disposable character QA');
    test.setTimeout(180000);
    const failures = collectBrowserFailures(page, baseURL);
    const walkTo = async (target, z) => {
        for (let step = 0; step < 18; step++) {
            const current = await readPlayerState(target);
            if (Math.abs(current.z - z) < 2) return;
            await moveByGroundClick(target, 0, Math.max(-6, Math.min(6, z - current.z)), { allowAlternatePaths: false });
            await expect.poll(() => target.evaluate(() => window.game.player.targetPosition === null)).toBe(true);
        }
        throw new Error('Casino aisle route did not reach its destination');
    };
    const enter = async target => {
        await walkTo(target, 184);
        await target.waitForTimeout(350); // Let the follow camera finish the movement before projecting the door.
        const door = await target.evaluate(() => {
            const game = window.game;
            const mesh = game.renderSystem.scene.getObjectByName('casino-town-door');
            const point = mesh.position.clone(); mesh.parent.localToWorld(point);
            point.project(game.renderSystem.camera);
            const rect = game.renderSystem.renderer.domElement.getBoundingClientRect();
            return { x: rect.left + (point.x + 1) * rect.width / 2, y: rect.top + (1 - point.y) * rect.height / 2 };
        });
        await target.mouse.click(door.x, door.y);
        const dialogue = target.locator('.casino-entry-dialogue');
        await expect(dialogue).toBeVisible().catch(async error => {
            await target.screenshot({ path: '/tmp/eidolon-casino-door-diagnostic.png' });
            const detail = await target.evaluate(point => ({ position: window.game.player.position.toArray(),
                pending: window.game.casino.pendingDoor, surface: document.elementFromPoint(point.x, point.y)?.outerHTML.slice(0, 250) }), door);
            throw new Error(`Casino door: ${JSON.stringify(detail)}`, { cause: error });
        });
        await dialogue.getByRole('button', { name: 'Enter Casino', exact: true }).click();
        await expect.poll(() => target.evaluate(() => window.game?.currentInstanceId)).toBe('lanternhold-casino');
        await expect.poll(() => target.evaluate(() => Boolean(window.game?.renderSystem.scene.getObjectByName('casino-vip-guard')))).toBe(true);
        await expect.poll(() => target.evaluate(() => window.game.renderSystem.staticEnvironmentGroup.visible)).toBe(false);
    };
    await loginAndEnterWorld(page, credentials);
    await enter(page);
    await expect.poll(() => page.evaluate(() => window.game.casino.data.tables.filter(table => table.floor === 'public').length)).toBe(10);
    const initial = await readPlayerState(page);
    const other = await context.newPage();
    await loginAndEnterWorld(other, { ...credentials, username: `${credentials.username}-casino-guest` });
    await enter(other);
    await expect.poll(() => page.evaluate(() => window.game.remotePlayers.size)).toBeGreaterThan(0);
    expect(await other.evaluate(() => window.game.currentInstanceId)).toBe(await page.evaluate(() => window.game.currentInstanceId));
    await exerciseReconnect(other);
    await expect.poll(() => other.evaluate(() => window.game.currentInstanceId)).toBe('lanternhold-casino');
    await page.bringToFront(); // Exercise the player's active tab, not background-throttled rendering.
    // Actual movement inputs down the central aisle, not a scene-position teleport.
    await walkTo(page, 154);
    await expect(page.getByRole('button', { name: 'Talk to VIP Guard', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Talk to VIP Guard', exact: true }).click();
    await expect(page.locator('.casino-entry-dialogue')).toContainText('You must be a VIP to enter');
    await page.screenshot({ path: '/tmp/eidolon-casino-guard-20260913.png' });
    await page.locator('.casino-entry-dialogue').getByRole('button', { name: 'Close', exact: true }).click();
    await page.screenshot({ path: '/tmp/eidolon-casino-interior-20260913.png' });
    expect((await readPlayerState(page)).gold).toBe(initial.gold);
    await page.keyboard.press('b');
    await expect.poll(() => page.evaluate(() => window.game.currentInstanceType)).toBe('overworld');
    await expect.poll(() => page.evaluate(() => window.game.renderSystem.staticEnvironmentGroup.visible)).toBe(true);
    expect(await other.evaluate(() => window.game.currentInstanceId)).toBe('lanternhold-casino');
    await other.close();
    expect(failures).toEqual([]);
});
