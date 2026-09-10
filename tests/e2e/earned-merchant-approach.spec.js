import { expect, test } from '@playwright/test';
import { openEarnedMerchant, readEarnedMerchantApproach } from './earned-inventory-management.js';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld, returnToTown } from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });
test('repeated ordinary Recall and merchant approaches settle and open the real shop', async ({ page, baseURL }, testInfo) => {
    const credentials = credentialsFromEnvironment();
    test.skip(!credentials.username || !credentials.password, 'Requires disposable credentials');
    test.setTimeout(240_000);
    const failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    try {
        for (let visit = 0; visit < 12; visit++) {
            await returnToTown(page);
            await openEarnedMerchant(page);
            console.log('[merchant-approach-visit]', JSON.stringify({ visit, ...await readEarnedMerchantApproach(page) }));
            await expect(page.locator('#shop-screen')).toBeVisible();
            await expect(page.locator('#inventory-screen')).toBeVisible();
            await page.locator('#btn-close-shop-header').click();
            if (await page.locator('#inventory-screen').isVisible()) await page.locator('#btn-close-inventory').click();
        }
        expect(failures).toEqual([]);
    } catch (cause) {
        await page.screenshot({ path: testInfo.outputPath('merchant-approach-failed.png') });
        throw cause;
    }
});
