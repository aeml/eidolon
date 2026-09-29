import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test('desktop resources and actions share a clear dock without hiding chat or menus', async ({ page, baseURL }) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
        const { UIManager } = await import('/src/ui/UIManager.js');
        document.getElementById('start-screen').style.display = 'none';
        const ui = new UIManager(false); ui.showHUD(); ui.toggleChat(true);
        window.__dockUI = ui;
    });
    for (const [width, height] of [[1100, 700], [1280, 720], [1440, 900], [1920, 1080]]) {
        await page.setViewportSize({ width, height });
        // A previously saved wide chat size is constrained, not hidden.
        await page.locator('#chat-box').evaluate(node => { node.style.width = '90vw'; });
        const metrics = await page.evaluate(() => {
            const rect = id => {
                const r = document.getElementById(id).getBoundingClientRect();
                return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
            };
            return { vitals: rect('player-hud'), primary: rect('ability-container'), hotbar: rect('hotbar-container'),
                chat: rect('chat-box'), menus: rect('menu-bar') };
        });
        expect(Math.abs(metrics.vitals.left - metrics.primary.left)).toBeLessThan(1);
        expect(Math.abs(metrics.vitals.right - metrics.hotbar.right)).toBeLessThan(1);
        expect(metrics.vitals.bottom).toBeLessThan(metrics.hotbar.top);
        expect(metrics.chat.right).toBeLessThan(metrics.vitals.left - 12);
        expect(metrics.menus.left).toBeGreaterThan(metrics.hotbar.right + 12);
        for (const node of await page.locator('#ability-container, .hotbar-slot, #menu-bar button, #chat-input').all()) {
            await expect(node).toBeInViewport();
            expect(await node.evaluate(element => {
                const r = element.getBoundingClientRect();
                return element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
            })).toBe(true);
        }
        await page.locator('#ability-container').hover();
        await expect(page.locator('#ability-tooltip')).toBeVisible();
        await expect(page.locator('#ability-tooltip')).toBeInViewport();
        await page.mouse.move(width / 2, height / 2);
        await expect(page.locator('#chat-box')).toBeVisible();
    }
    // Runtime hide still removes the dock decoration with the resource HUD.
    await page.locator('#player-hud').evaluate(node => { node.style.display = 'none'; });
    await expect(page.locator('#player-hud')).toBeHidden();
    expect(failures, failures.join('\n')).toEqual([]);
    await page.evaluate(() => window.__dockUI.characterPreview.dispose());
});
