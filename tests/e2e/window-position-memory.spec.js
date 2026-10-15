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

test('saved desktop layout survives reload, compact layout and keyboard reset', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: 1440, height: 1000 });
    const start = async () => {
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async () => {
            const { UIManager } = await import('/src/ui/UIManager.js');
            document.getElementById('start-screen').style.display = 'none';
            window.__windowMemory = new UIManager(false);
            window.__windowMemory.showHUD();
            window.__windowMemory.openManagedWindow('character');
            window.__windowMemory.openManagedWindow('inventory');
        });
    };
    await start();
    const position = selector => page.locator(selector).evaluate(element => {
        const rect = element.getBoundingClientRect(); return { x: rect.left, y: rect.top };
    });
    const drag = async (selector, x, y) => {
        const header = await page.locator(`${selector} .window-header`).boundingBox();
        await page.mouse.move(header.x + 55, header.y + 15); await page.mouse.down();
        await page.mouse.move(x + 55, y + 15, { steps: 6 }); await page.mouse.up();
        return position(selector);
    };
    const character = await drag('#character-sheet', 32, 66);
    const bag = await drag('#inventory-screen', 950, 280);
    await page.evaluate(() => window.__windowMemory.openManagedWindow('shop', { keepCompanion: true }));
    const shop = await drag('#shop-screen', 75, 145);
    await start();
    await expect.poll(() => position('#character-sheet')).toEqual(character);
    await expect.poll(() => position('#inventory-screen')).toEqual(bag);
    await page.evaluate(() => window.__windowMemory.openManagedWindow('shop', { keepCompanion: true }));
    await expect.poll(() => position('#shop-screen')).toEqual(shop);
    await expect.poll(() => position('#inventory-screen')).toEqual(bag);
    await page.setViewportSize({ width: 820, height: 720 });
    await expect(page.locator('#inventory-screen')).toBeHidden();
    await expect.poll(() => page.locator('#shop-screen').evaluate(element => {
        const r = element.getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
    })).toBe(true);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect.poll(() => position('#shop-screen')).toEqual(shop);
    await page.evaluate(() => window.__windowMemory.toggleSettings());
    const reset = page.getByRole('button', { name: 'Reset window positions' });
    await reset.scrollIntoViewIfNeeded(); await reset.focus(); await page.keyboard.press('Enter');
    await expect(page.locator('#window-layout-status')).toContainText('Window positions reset');
    await page.screenshot({ path: testInfo.outputPath('layout-reset-settings.png') });
    await start();
    expect(await position('#character-sheet')).not.toEqual(character);
    expect(await position('#inventory-screen')).not.toEqual(bag);
    await page.evaluate(() => window.__windowMemory.dispose());
    expect(failures, failures.join('\n')).toEqual([]);
});

test('phone layout ignores desktop offsets and offers a reachable layout reset', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
        localStorage.setItem('eidolon.windowLayout.v1', JSON.stringify({ version: 1,
            wide: { character: { left: 1200, top: 800 }, settings: { left: 1200, top: 800 } }, compact: {} }));
        const { UIManager } = await import('/src/ui/UIManager.js');
        document.getElementById('start-screen').style.display = 'none'; document.body.classList.add('mobile-mode');
        window.__windowMemory = new UIManager(true); window.__windowMemory.showHUD();
        window.__windowMemory.openManagedWindow('character');
    });
    const sheet = page.locator('#character-sheet');
    await expect(sheet).toBeVisible();
    expect(await sheet.getAttribute('data-dragged-window')).toBeNull();
    await expect.poll(() => sheet.evaluate(element => {
        const r = element.getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
    })).toBe(true);
    await page.evaluate(() => window.__windowMemory.toggleSettings());
    const reset = page.getByRole('button', { name: 'Reset window positions' });
    await reset.scrollIntoViewIfNeeded(); await reset.click();
    expect((await reset.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await expect(page.locator('#window-layout-status')).toContainText('Window positions reset');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('eidolon.windowLayout.v1')).wide)).toEqual({});
    await page.screenshot({ path: testInfo.outputPath('phone-layout-reset.png') });
    await page.evaluate(() => window.__windowMemory.dispose());
    expect(failures, failures.join('\n')).toEqual([]);
});
