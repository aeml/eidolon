import { devices, expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test.use({ hasTouch: true, isMobile: true, userAgent: devices['Pixel 7'].userAgent, actionTimeout: 12_000 });
for (const [width, height] of [[360, 800], [390, 844], [844, 390], [568, 320]]) {
    test(`${width}x${height}: status details scroll without covering thumb controls`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async () => {
            const { UIManager } = await import('/src/ui/UIManager.js');
            const { Minimap } = await import('/src/ui/Minimap.js');
            const { InputManager } = await import('/src/core/InputManager.js');
            const THREE = await import('three');
            document.body.classList.add('mobile-mode'); document.getElementById('start-screen').style.display = 'none';
            const ui = new UIManager(true); ui.showHUD(); ui.toggleChat(true);
            const input = new InputManager(new THREE.PerspectiveCamera(), new THREE.Scene());
            input.setupMobileControls(); input.subscribe('onEscape', () => ui.handleEscape());
            const effects = Array.from({ length: 30 }, (_, i) => ({ id: `effect-${i}`, name: `Elemental blessing ${i + 1}`,
                remainingSeconds: 90 - i, isDebuff: i % 3 === 0,
                detail: 'An example effect with a long description, keeping its complete explanation available without shrinking text.' }));
            const minimap = new Minimap();
            minimap.setGameEngine({ isMobile: true, player: { id: 'status-fixture' }, getActiveBuffs: () => effects });
            minimap._renderBuffList();
            window.__phoneStatusFixture = { minimap, effects, ui, input };
        });
        const launcher = page.locator('#btn-phone-status'), panel = page.locator('#phone-status-panel');
        await expect(launcher).toBeVisible();
        expect((await launcher.boundingBox()).height).toBeGreaterThanOrEqual(44);
        await launcher.tap(); await expect(panel).toBeVisible();
        const body = panel.locator('.phone-status-body'), close = page.locator('#btn-close-phone-status');
        await expect(close).toBeInViewport();
        expect((await close.boundingBox()).height).toBeGreaterThanOrEqual(44);
        expect(await body.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
        expect(await panel.locator('.phone-status-detail').first().evaluate(node => getComputedStyle(node).fontSize)).toBe('16px');
        const metrics = await page.evaluate(() => ['joystick-zone', 'btn-mobile-attack', 'hotbar-container', 'chat-mobile-toggle'].map(id => {
            const element = document.getElementById(id), bounds = element.getBoundingClientRect();
            const hit = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
            return { id, reachable: element.contains(hit), width: bounds.width, height: bounds.height };
        }));
        for (const metric of metrics) expect(metric, `${metric.id} must remain reachable`).toMatchObject({ reachable: true });
        const bounds = await body.boundingBox();
        const client = await page.context().newCDPSession(page);
        const x = bounds.x + bounds.width / 2, start = bounds.y + bounds.height * .8;
        await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: start }] });
        for (let step = 1; step <= 8; step++) {
            await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: start - bounds.height * .6 * step / 8 }] });
            await page.waitForTimeout(25);
        }
        await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await expect.poll(() => body.evaluate(node => node.scrollTop)).toBeGreaterThan(20);
        await page.screenshot({ path: testInfo.outputPath(`status-${width}.png`) });
        await page.locator('#chat-mobile-toggle').tap(); await expect(panel).toBeHidden();
        await expect(page.locator('#chat-input')).toBeVisible();
        await page.locator('#chat-mobile-toggle').tap();
        await launcher.tap(); await page.keyboard.press('Escape');
        await expect(panel).toBeHidden(); await expect(page.locator('#esc-menu')).toBeHidden();
        await launcher.tap();
        await page.evaluate(() => {
            window.__phoneStatusFixture.effects.length = 0;
            window.__phoneStatusFixture.minimap._renderBuffList();
        });
        await expect(panel.getByText('No active effects.', { exact: false })).toBeVisible();
        await close.tap(); await expect(panel).toBeHidden();
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
