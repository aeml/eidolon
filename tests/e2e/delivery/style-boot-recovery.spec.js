import { expect, test } from '@playwright/test';

const loginStyles = url => url.pathname.endsWith('/src/styles/start-screen.css');

test('a lost imported stylesheet recovers before the login interface becomes ready', async ({ page }) => {
    let requests = 0;
    await page.route(loginStyles, route => ++requests === 1 ? route.abort('internetdisconnected') : route.continue());
    // One navigation: openGame's navigation retries must not mask this defect.
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.eidolonReady), { timeout: 15_000 }).toBe('true');
    expect(requests).toBeGreaterThanOrEqual(2);
    await expect(page.locator('#btn-register')).toHaveCSS('pointer-events', 'auto');
    await expect(page.locator('#style-boot-recovery')).toHaveCount(0);
    await page.locator('#login-patch-notes-link').click();
    await expect(page.locator('#patch-notes-screen')).toBeVisible();
    await page.locator('#btn-close-patch-notes-header').click();
    await expect(page.locator('#patch-notes-screen')).toBeHidden();
});

test('persistent stylesheet failure stays unready and offers a working manual reload', async ({ page }) => {
    let requests = 0, fail = true;
    await page.route(loginStyles, route => {
        requests++;
        return fail ? route.abort('internetdisconnected') : route.continue();
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const retry = page.getByRole('button', { name: 'Retry loading', exact: true });
    await expect(retry).toBeVisible({ timeout: 35_000 });
    expect(requests).toBe(4); // Original request plus three bounded replacements.
    expect(await page.evaluate(() => document.documentElement.dataset.eidolonReady)).not.toBe('true');
    await expect(retry).toHaveCSS('pointer-events', 'auto');
    fail = false;
    await retry.click();
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.eidolonReady), { timeout: 15_000 }).toBe('true');
    await expect(page.locator('#style-boot-recovery')).toHaveCount(0);
    await expect(page.locator('#btn-register')).toHaveCSS('pointer-events', 'auto');
});
