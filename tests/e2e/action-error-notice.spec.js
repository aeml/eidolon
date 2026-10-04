import { test, expect } from '@playwright/test';

for (const [name, width, height] of [['desktop', 1280, 720], ['phone', 390, 844]]) {
    test(`action errors stay visible above menus without browser dialogs (${name})`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        let dialogs = 0;
        page.on('dialog', dialog => { dialogs++; dialog.dismiss(); });
        await page.goto('/');
        await page.evaluate(async () => {
            const { ActionErrorNotice } = await import('/src/ui/ActionErrorNotice.js');
            const menu = document.createElement('div');
            menu.className = 'generated-menu';
            menu.textContent = 'Merchant window';
            document.body.append(menu);
            new ActionErrorNotice().show('Selling is temporarily unavailable. Please try again.');
        });
        const notice = page.getByRole('alert').filter({ hasText: 'Action not completed' });
        await expect(notice).toBeVisible();
        const bounds = await notice.boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
        expect(await notice.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
        expect(await notice.evaluate(el => Number(getComputedStyle(el).zIndex))).toBeGreaterThan(1100);
        const close = notice.getByRole('button', { name: 'Dismiss error' });
        expect((await close.boundingBox()).height).toBeGreaterThanOrEqual(44);
        await close.click();
        await expect(notice).toHaveCount(0);
        expect(dialogs).toBe(0);
    });
}
