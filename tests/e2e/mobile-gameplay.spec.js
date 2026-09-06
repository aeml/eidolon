import { expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld } from './helpers.js';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
    actionTimeout: 12_000, trace: 'off', screenshot: 'off', video: 'off' });

test('phone touch controls move a real character and open its core menus in both orientations', async ({ page, context, baseURL }) => {
    const credentials = credentialsFromEnvironment();
    test.skip(!credentials.username || !credentials.password, 'Requires a dedicated QA character');
    test.setTimeout(180_000);
    const failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    console.log('[phone-gameplay] authenticated character entered the rendered world');
    expect(await page.evaluate(() => window.game.isMobile)).toBe(true);
    const cdp = await context.newCDPSession(page);
    try {
        for (const [width, height] of [[390, 844], [844, 390]]) {
            await page.setViewportSize({ width, height });
            await expect(page.locator('#chat-mobile-toggle')).toBeVisible();
            await expect.poll(() => page.evaluate(() => {
                const camera = window.game.renderSystem.camera;
                return Math.min(camera.right - camera.left, camera.top - camera.bottom);
            })).toBeCloseTo(24);
            const before = await page.evaluate(() => ({ x: window.game.player.position.x, z: window.game.player.position.z }));
            const bounds = await page.locator('#joystick-zone').boundingBox();
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
                { id: 1, x: bounds.x + bounds.width / 2 + 24, y: bounds.y + bounds.height / 2 }
            ] });
            try {
                await expect.poll(() => page.evaluate(before => Math.hypot(window.game.player.position.x - before.x,
                    window.game.player.position.z - before.z), before), { timeout: 5000 }).toBeGreaterThan(1);
            } finally { await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
            await expect.poll(() => page.evaluate(() => window.game.inputManager.joystickVector.length())).toBe(0);
            console.log(`[phone-gameplay] ${width}x${height}: joystick movement accepted and released`);

            for (const [button, panel, close] of [
                ['btn-mobile-inv', 'inventory-screen', 'btn-close-inventory'],
                ['btn-mobile-char', 'character-sheet', 'btn-close-character'],
                ['btn-mobile-quest', 'quest-journal', 'btn-close-journal'],
                ['btn-mobile-social', 'social-window', 'close-social']
            ]) {
                console.log(`[phone-gameplay] ${width}x${height}: opening ${panel}`);
                await page.locator(`#${button}`).tap();
                await expect(page.locator(`#${panel}`)).toBeVisible();
                await expect(page.locator(`#${close}`)).toBeInViewport();
                await page.locator(`#${close}`).tap();
                await expect(page.locator(`#${panel}`)).toBeHidden();
            }
            console.log(`[phone-gameplay] ${width}x${height}: opening skills through Menu`);
            await page.locator('#btn-mobile-menu').tap();
            await page.locator('#btn-phone-skills').tap();
            await expect(page.locator('#skill-tree-window')).toBeVisible();
            await page.locator('#btn-close-skills').tap();
            await page.evaluate(() => window.game.renderSystem.setZoom(25));
            await page.locator('#btn-mobile-menu').tap();
            await page.locator('#btn-phone-camera').tap();
            await expect(page.locator('#esc-menu')).toBeHidden();
            expect(await page.evaluate(() => window.game.renderSystem.currentZoom)).toBe(15);
            expect(await page.evaluate(() => window.game.cameraLocked)).toBe(true);
            console.log(`[phone-gameplay] ${width}x${height}: opening chat history and composer`);
            await page.locator('#chat-mobile-toggle').tap();
            await page.locator('#chat-input').tap();
            await expect(page.locator('#chat-input')).toBeFocused();
            await page.locator('#chat-mobile-toggle').tap();
            await expect(page.locator('#chat-box')).toBeVisible();
            console.log(`[phone-gameplay] ${width}x${height}: joystick movement, core menus, skills and chat operated by touch`);
        }
    } finally { if (!page.isClosed()) await cdp.detach(); }
    expect(failures, failures.join('\n')).toEqual([]);
});
