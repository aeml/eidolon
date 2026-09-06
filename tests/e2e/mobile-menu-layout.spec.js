import { devices, expect, test } from '@playwright/test';

test.use({ hasTouch: true, isMobile: true, userAgent: devices['Pixel 7'].userAgent });

for (const [width, height] of [[360, 800], [844, 390], [568, 320]]) {
    test(`phone Menu preserves readable status and reachable navigation at ${width}x${height}`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async () => {
            const { UIManager } = await import('/src/ui/UIManager.js');
            const { InputManager } = await import('/src/core/InputManager.js');
            document.body.classList.add('mobile-mode');
            document.getElementById('start-screen').style.display = 'none';
            const ui = window.__phoneMenuUI = new UIManager(true);
            const input = window.__phoneMenuInput = new InputManager(null, null);
            input.setupMobileControls();
            input.subscribe('onEscape', () => ui.handleEscape());
            input.subscribe('onInventory', () => ui.toggleInventory());
            ui.showHUD(); ui.toggleChat(true); ui.setUiScale(125);
        });
        try {
            await expect(page.locator('#mobile-top-right button')).toHaveCount(1);
            await expect(page.locator('#btn-mobile-inv')).toBeHidden();
            const status = await page.locator('#player-hud').boundingBox();
            for (const selector of ['#btn-mobile-menu', '#ability-container']) {
                const rect = await page.locator(selector).boundingBox();
                expect(rect.x).toBeGreaterThanOrEqual(status.x + status.width + 6);
            }
            expect(await page.locator('.bar-text').first().evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
            await page.screenshot({ path: `/tmp/eidolon-phone-hub-status-${width}.png` });
            await page.locator('#btn-mobile-menu').tap();
            await expect(page.locator('#esc-menu')).toBeVisible();
            await page.screenshot({ path: `/tmp/eidolon-phone-hub-menu-top-${width}.png` });
            for (const button of await page.locator('#esc-menu button').all()) {
                await button.scrollIntoViewIfNeeded();
                await expect(button).toBeInViewport();
                const rect = await button.boundingBox();
                expect(rect.width).toBeGreaterThanOrEqual(44); expect(rect.height).toBeGreaterThanOrEqual(44);
                expect(await button.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
                expect(await button.evaluate(el => {
                    const r = el.getBoundingClientRect();
                    return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
                })).toBe(true);
            }
            await expect(page.locator('#btn-resume')).toBeInViewport();
            const menu = await page.locator('#esc-menu').boundingBox(), chat = await page.locator('#chat-box').boundingBox();
            expect(menu.y + menu.height).toBeLessThanOrEqual(chat.y - 4);
            await page.screenshot({ path: `/tmp/eidolon-phone-hub-menu-${width}.png` });
            await page.locator('#btn-resume').tap();
            await expect(page.locator('#esc-menu')).toBeHidden();
            await page.locator('#btn-mobile-menu').tap();
            await page.locator('#btn-mobile-inv').tap();
            await expect(page.locator('#esc-menu')).toBeHidden();
            await expect(page.locator('#inventory-screen')).toBeVisible();
            await page.locator('#btn-close-inventory').tap();
            await page.locator('#btn-mobile-menu').tap();
            await page.locator('#chat-mobile-toggle').tap();
            await expect(page.locator('#esc-menu')).toBeHidden();
            await expect(page.locator('#chat-input')).toBeVisible();
        } finally {
            await page.evaluate(() => { window.__phoneMenuInput.dispose(); window.__phoneMenuUI.characterPreview.dispose(); });
        }
    });
}
