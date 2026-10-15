import { test, expect } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test('moved character, bag and merchant windows keep their positions when reopened', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
        const { UIManager } = await import('/src/ui/UIManager.js');
        document.getElementById('start-screen').style.display = 'none';
        window.__windowMemory = new UIManager(false);
        window.__windowMemory.showHUD();
        window.__windowMemory.openManagedWindow('character');
        window.__windowMemory.openManagedWindow('inventory');
    });
    const position = selector => page.locator(selector).evaluate(element => {
        const rect = element.getBoundingClientRect(); return { x: rect.left, y: rect.top };
    });
    const drag = async (selector, x, y) => {
        const header = await page.locator(`${selector} .window-header`).boundingBox();
        await page.mouse.move(header.x + 55, header.y + 15);
        await page.mouse.down(); await page.mouse.move(x + 55, y + 15, { steps: 6 }); await page.mouse.up();
        await expect(page.locator(selector)).toHaveAttribute('data-dragged-window', 'true');
        return position(selector);
    };
    const character = await drag('#character-sheet', 35, 75);
    const bag = await drag('#inventory-screen', 990, 320);
    await page.locator('#btn-close-character').click();
    await page.evaluate(() => window.__windowMemory.openManagedWindow('character'));
    await expect.poll(() => position('#character-sheet')).toEqual(character);
    await expect.poll(() => position('#inventory-screen')).toEqual(bag);
    await page.locator('#btn-close-inventory').click();
    await page.evaluate(() => window.__windowMemory.openManagedWindow('inventory'));
    await expect.poll(() => position('#inventory-screen')).toEqual(bag);
    await expect.poll(() => position('#character-sheet')).toEqual(character);

    await page.evaluate(() => window.__windowMemory.openManagedWindow('shop', { keepCompanion: true }));
    const shop = await drag('#shop-screen', 90, 155);
    await page.locator('#btn-close-shop-header').click();
    await page.evaluate(() => window.__windowMemory.openManagedWindow('shop', { keepCompanion: true }));
    await expect.poll(() => position('#shop-screen')).toEqual(shop);
    await expect.poll(() => position('#inventory-screen')).toEqual(bag);
    // Content arrives after opening; the real ResizeObserver must retain layout.
    await page.locator('#shop-screen').evaluate(element => { element.style.height = '600px'; });
    await expect.poll(() => position('#shop-screen')).toEqual(shop);
    await expect.poll(() => position('#inventory-screen')).toEqual(bag);
    await page.screenshot({ path: testInfo.outputPath('remembered-store-and-bag.png') });

    await page.setViewportSize({ width: 700, height: 720 });
    await expect(page.locator('#inventory-screen')).toBeHidden();
    await expect.poll(() => page.locator('#shop-screen').evaluate(element => {
        const rect = element.getBoundingClientRect();
        return rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight;
    })).toBe(true);
    const clamped = await position('#shop-screen');
    await page.locator('#btn-close-shop-header').click();
    await page.evaluate(() => window.__windowMemory.openManagedWindow('shop'));
    await expect.poll(() => position('#shop-screen')).toEqual(clamped);
    await page.screenshot({ path: testInfo.outputPath('remembered-store-resized.png') });
    await page.evaluate(() => window.__windowMemory.dispose());
    expect(failures, failures.join('\n')).toEqual([]);
});
