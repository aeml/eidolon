import { devices, expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld, projectEntity } from './helpers.js';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
    userAgent: devices['Pixel 7'].userAgent, actionTimeout: 12_000,
    trace: 'off', screenshot: 'off', video: 'off' });

async function openGuideByTouch(page, context) {
    // Town scenery can finish before the throttled actor queue has recreated
    // the guide. Wait for the real actor before reading its interaction radius.
    await expect.poll(() => page.evaluate(() => window.game.remotePlayers.has('dungeon-npc-1'))).toBe(true);
    const cdp = await context.newCDPSession(page);
    const box = await page.locator('#joystick-zone').boundingBox();
    let started = false;
    let sampleCount = 0;
    console.log('[phone-adventure] guide approach', JSON.stringify(await page.evaluate(box => ({
        viewport: [innerWidth, innerHeight], box, player: window.game.player.position.toArray(),
        centerHit: document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.id
    }), box)));
    try {
        await expect.poll(async () => {
            const delta = await page.evaluate(() => {
                const game = window.game, guide = game.remotePlayers.get('dungeon-npc-1');
                return { x: guide.position.x - game.player.position.x, z: guide.position.z - game.player.position.z,
                    range: game.getInteractionRangeForEntity(guide) };
            });
            // Stop in the real interaction radius, not within one metre of an
            // arbitrary nearby waypoint. Full-speed joystick movement can step
            // across that tiny waypoint between automation samples and oscillate.
            if (Math.hypot(delta.x, delta.z) < delta.range - 0.5) return true;
            const jx = delta.x - delta.z, jy = delta.x + delta.z, length = Math.hypot(jx, jy);
            await cdp.send('Input.dispatchTouchEvent', { type: started ? 'touchMove' : 'touchStart', touchPoints: [
                { id: 91, x: box.x + box.width / 2 + 32 * jx / length, y: box.y + box.height / 2 + 32 * jy / length }
            ] });
            started = true;
            if (++sampleCount % 50 === 0) console.log('[phone-adventure] approach sample', JSON.stringify(await page.evaluate(() => ({
                position: window.game.player.position.toArray(), joystick: window.game.inputManager.joystickVector.toArray(),
                state: window.game.player.state, pending: window.game.pendingInteraction?.id,
                serverPosition: window.game.movementNetworkState?.lastAcknowledgedServerPosition,
                movementContext: window.game.movementNetworkState?.recoveryContext,
                pause: window.game.uiManager.isEscMenuOpen
            }))));
            return false;
        }, { timeout: 25_000, intervals: [100] }).toBe(true);
    } catch (error) {
        console.log('[phone-adventure] failed approach', JSON.stringify(await page.evaluate(box => ({
            position: window.game.player.position.toArray(), joystick: window.game.inputManager.joystickVector.toArray(),
            currentBounds: document.getElementById('joystick-zone').getBoundingClientRect().toJSON(),
            centerHit: document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.className,
            target: window.game.player.targetPosition, focused: document.activeElement?.id
        }), box)));
        throw error;
    } finally {
        if (started) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await cdp.detach();
    }
    await expect.poll(() => page.evaluate(() => window.game.inputManager.joystickVector.lengthSq())).toBe(0);
    const point = await projectEntity(page, 'dungeon-npc-1');
    expect(point?.visible, 'The guide must be visible at default phone zoom').toBe(true);
    await page.touchscreen.tap(point.x, point.y);
    await expect(page.locator('#dungeon-menu')).toBeVisible();
}

async function recallByTouch(page) {
    await page.locator('#btn-mobile-menu').tap(); await page.locator('#btn-recall').tap();
    await expect.poll(() => page.evaluate(() => {
        const game = window.game;
        return Boolean(!game.currentInstanceId && !game.currentDungeonLayout
            && Math.hypot(game.player.position.x + 1.25, game.player.position.z - 200) < 3
            && game.collisionManager.dungeonWalkableRects.length === 0
            && game.renderSystem.instanceEnvironmentGroup.children.some(child => child.name === 'DungeonEntrance'));
    }), { timeout: 30_000 }).toBe(true);
}

async function enterByTouch(page) {
    await page.locator('#btn-enter-dungeon').tap();
    await expect(page.locator('#dungeon-menu')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => {
        const game = window.game;
        return game.currentInstanceType === 'verdant_bastion_catacombs' && Boolean(game.currentInstanceId && game.currentDungeonLayout)
            && game.collisionManager.dungeonWalkableRects.length > 0;
    }), { timeout: 30_000 }).toBe(true);
    return page.evaluate(() => window.game.currentInstanceId);
}

test('phone guide starts, recalls, continues and deliberately resets a real dungeon run', async ({ page, context, baseURL }) => {
    const credentials = credentialsFromEnvironment();
    test.skip(!credentials.username || !credentials.password || process.env.EIDOLON_E2E_REGISTER !== '1', 'Requires a fresh disposable character');
    test.setTimeout(240_000);
    const failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    // Explicit level preparation only. No instance, story access or progress is granted.
    await page.locator('#chat-mobile-toggle').tap();
    await page.locator('#chat-input').fill('/level 30'); await page.locator('#chat-input').press('Enter');
    await expect.poll(() => page.evaluate(() => window.game.player.level)).toBe(30);
    await page.locator('#chat-mobile-toggle').tap();
    await openGuideByTouch(page, context);
    await expect(page.locator('#diff-btn-heroic')).toBeDisabled();
    await expect(page.locator('#dungeon-run-level-select')).toHaveValue('30');
    await page.getByRole('tab', { name: 'Raids', exact: true }).tap();
    await expect(page.locator('[data-raid-type="earth_crystal_raid"] button').first()).toBeDisabled();
    await page.getByRole('tab', { name: 'Dungeons', exact: true }).tap();
    const original = await enterByTouch(page);
    await recallByTouch(page);
    await page.setViewportSize({ width: 844, height: 390 });
    await openGuideByTouch(page, context);
    await expect(page.locator('#btn-enter-dungeon')).toHaveText('Continue run');
    await expect(page.locator('#dungeon-type-select')).toBeDisabled();
    await expect(page.locator('.phone-adventure-summary')).toContainText('Verdant Bastion Catacombs · Normal · Level 30');
    await page.locator('#btn-reset-dungeon').tap(); await page.locator('#btn-cancel-dungeon-reset').tap();
    expect(await enterByTouch(page)).toBe(original);
    await recallByTouch(page); await openGuideByTouch(page, context);
    await page.locator('#btn-reset-dungeon').tap(); await page.locator('#btn-confirm-dungeon-reset').tap();
    await expect(page.locator('#dungeon-menu')).toHaveCount(0);
    await openGuideByTouch(page, context);
    await expect(page.locator('#btn-enter-dungeon')).toHaveText('Start run');
    await expect(page.locator('#btn-reset-dungeon')).toHaveCount(0);
    const fresh = await enterByTouch(page);
    expect(fresh).not.toBe(original);
    await recallByTouch(page);
    expect(await page.evaluate(() => window.game.renderSystem.currentZoom)).toBe(15);
    console.log('[phone-adventure] real guide touch entry, complete town recall, same-run continuation, canceled reset and confirmed fresh-run reset verified at default zoom');
    expect(failures, failures.join('\n')).toEqual([]);
});
