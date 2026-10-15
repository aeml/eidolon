import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

async function prepareEntry(page) {
    await page.route('**/src/core/GameEngine.js', route => route.fulfill({ contentType: 'text/javascript', body: `
        import { GameEngine as Actual } from '/src/core/GameEngine.js?layout-implementation';
        export class GameEngine extends Actual {
            async loadGame(progress) { this.uiManager.showHUD(); progress(100, 'Prepared'); }
        }` }));
    await page.routeWebSocket(/\/ws(?:\?|$)/, socket => socket.onMessage(data => {
        if (JSON.parse(data).type === 'login') socket.send(JSON.stringify({ type: 'login_success',
            payload: { hasCharacter: true, characterType: 'Fighter' } }));
    }));
}

for (const [initialWidth, joinWidth, mobile] of [[1280, 390, true], [390, 1280, false]]) {
    test(`login resized ${initialWidth} to ${joinWidth} installs matching real controls`, async ({ page, baseURL }) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.setViewportSize({ width: initialWidth, height: 844 });
        // Real bootstrap, renderer, UI and input construction. Only world/account
        // traffic is prepared; no authoritative login or campaign claim.
        await prepareEntry(page);
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.locator('#auth-username').fill('layout-fixture');
        await page.locator('#auth-password').fill('synthetic-fixture');
        await page.locator('#btn-login').click();
        await expect(page.locator('#btn-play-character')).toBeVisible();
        await page.setViewportSize({ width: joinWidth, height: 844 });
        await page.locator('#btn-play-character').click();
        await expect.poll(() => page.evaluate(() => Boolean(window.game?.uiManager && !document.getElementById('loading-screen').offsetParent))).toBe(true);
        expect(await page.evaluate(() => ({ engine: window.game.isMobile, ui: window.game.uiManager.isMobile,
            input: window.game.inputManager.isMobile, aim: Boolean(window.game.inputManager.touchAbilityAim),
            css: document.body.classList.contains('mobile-mode') }))).toEqual({ engine: mobile, ui: mobile, input: mobile, aim: mobile, css: mobile });
        if (mobile) await expect(page.locator('#joystick-zone')).toBeVisible();
        else await expect(page.locator('#btn-menu-inventory')).toBeVisible();
        await page.setViewportSize({ width: initialWidth, height: 844 });
        expect(await page.evaluate(() => ({ css: document.body.classList.contains('mobile-mode'), input: window.game.inputManager.isMobile })))
            .toEqual({ css: mobile, input: mobile });
        await page.evaluate(() => { window.game.destroy(); window.game = null; });
        await expect(page.locator('#mobile-ui')).toBeHidden();
        expect(failures, failures.join('\n')).toEqual([]);
    });
}

test('phone and desktop return sessions restore settings, navigation and build controls', async ({ page, baseURL }) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    for (const mobile of [true, false, true, false]) {
        await page.setViewportSize({ width: mobile ? 390 : 1280, height: 844 });
        await page.evaluate(async mobile => {
            const { UIManager } = await import('/src/ui/UIManager.js');
            window.__layoutUI?.dispose();
            document.body.classList.toggle('mobile-mode', mobile);
            document.getElementById('start-screen').style.display = 'none';
            const ui = new UIManager(mobile); window.__layoutUI = ui;
            ui.showHUD(); ui.toggleSettings();
        }, mobile);
        await expect(page.locator('.phone-settings-tabs')).toHaveCount(mobile ? 1 : 0);
        await expect(page.locator('.phone-build-tabs')).toHaveCount(mobile ? 1 : 0);
        await expect(page.locator('#phone-stash')).toHaveCount(mobile ? 1 : 0);
        await expect(page.locator('#graphics-quality')).toBeVisible();
        if (!mobile) {
            await expect(page.locator('#motion-preference')).toBeVisible();
            await expect(page.locator('#audio-enabled')).toBeVisible();
        }
        await page.evaluate(() => window.__layoutUI.toggleSettings());
    }
    await page.evaluate(() => window.__layoutUI.dispose());
    expect(failures, failures.join('\n')).toEqual([]);
});

test('returning login changes input policy without retaining touch controls or phone settings', async ({ page, baseURL }) => {
    const failures = collectBrowserFailures(page, baseURL);
    await prepareEntry(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    for (const mobile of [true, false, true]) {
        await page.setViewportSize({ width: mobile ? 390 : 1280, height: 844 });
        await page.locator('#auth-username').fill('return-layout-fixture');
        await page.locator('#auth-password').fill('synthetic-fixture');
        await page.locator('#btn-login').click();
        await page.locator('#btn-play-character').click();
        await expect.poll(() => page.evaluate(() => Boolean(window.game?.uiManager &&
            !document.getElementById('loading-screen').offsetParent))).toBe(true);
        expect(await page.evaluate(() => window.game.inputManager.isMobile)).toBe(mobile);
        await expect(page.locator('#mobile-ui')).toBeVisible({ visible: mobile });
        await expect(page.locator('.phone-settings-tabs')).toHaveCount(mobile ? 1 : 0);
        await page.evaluate(() => window.game.uiManager.toggleSettings());
        await expect(page.locator('#graphics-quality')).toBeVisible();
        if (!mobile) await expect(page.locator('#motion-preference')).toBeVisible();
        await page.evaluate(() => window.game.network.onReconnectFailed({ kind: 'expired' }));
        await expect(page.locator('#start-screen')).toBeVisible();
        await expect(page.locator('#mobile-ui')).toBeHidden();
        expect(await page.evaluate(() => window.game)).toBeNull();
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
