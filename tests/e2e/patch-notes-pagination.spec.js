import { expect, test, firefox } from '@playwright/test';

test.use({ serviceWorkers: 'block' });
const isGameDependency = url => url.includes('/src/core/GameEngine.js')
    || url.includes('/vendor/three/') || url.includes('/src/utils/MeshCatalog.js')
    || url.includes('/src/assets/authoredEquipment.generated.js');

test('login loads ten notes without the game engine; older pages load only on demand and retry cleanly', async ({ page }) => {
    const archives = [], engines = [];
    page.on('request', request => {
        if (request.url().includes('/assets/patch-notes/')) archives.push(request.url());
        if (isGameDependency(request.url())) engines.push(request.url());
    });
    await page.goto('/', { waitUntil: 'load' });
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.eidolonReady)).toBe('true');
    await expect(page.locator('#patch-notes-history .patch-note-entry')).toHaveCount(10);
    expect(archives).toHaveLength(0); expect(engines).toHaveLength(0);
    await page.locator('#login-patch-notes-link').click();
    const more = page.getByRole('button', { name: 'Load more notes', exact: true });
    await more.click();
    await expect(page.locator('#patch-notes-history .patch-note-entry')).toHaveCount(20);
    expect(archives).toHaveLength(1);
    let failed = false;
    await page.route('**/assets/patch-notes/**/page-002.json', route => {
        if (!failed) { failed = true; return route.abort('internetdisconnected'); }
        return route.continue();
    });
    await more.click();
    await expect(page.locator('#patch-notes-load-status')).toContainText('Please try again');
    await expect(page.locator('#patch-notes-history .patch-note-entry')).toHaveCount(20);
    await more.click();
    await expect(page.locator('#patch-notes-history .patch-note-entry')).toHaveCount(30);
    await page.locator('#btn-close-patch-notes-header').click();
    await expect(page.locator('#patch-notes-screen')).toBeHidden();
});

test('real Firefox reaches interactive login and loads the next ten notes', async ({ baseURL }, testInfo) => {
    test.skip(!process.env.EIDOLON_E2E_FIREFOX_PATH, 'Requires an explicitly provided local Firefox');
    // 4190 is a restricted non-HTTP port in Firefox. Use ordinary 4173/4192
    // for local checks; do not override browser security to make QA pass.
    if (new URL(baseURL).port === '4190') throw new Error('Use a Firefox-safe web port such as 4192, not restricted port 4190');
    const browser = await firefox.launch({ executablePath: process.env.EIDOLON_E2E_FIREFOX_PATH, headless: true, args: [] });
    try {
        const context = await browser.newContext({ viewport: { width: 1280, height: 844 }, serviceWorkers: 'block' });
        const page = await context.newPage(), errors = [], archives = [], engines = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('request', request => {
            if (request.url().includes('/assets/patch-notes/')) archives.push(request.url());
            if (isGameDependency(request.url())) engines.push(request.url());
        });
        await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
        await expect.poll(() => page.evaluate(() => document.documentElement.dataset.eidolonReady)).toBe('true');
        await expect(page.locator('#btn-login')).toBeEnabled();
        expect(archives).toHaveLength(0); expect(engines).toHaveLength(0);
        await page.locator('#login-patch-notes-link').click();
        await expect(page.locator('#patch-notes-screen')).toBeVisible();
        await expect(page.locator('#patch-notes-history .patch-note-entry')).toHaveCount(10);
        await page.getByRole('button', { name: 'Load more notes', exact: true }).click();
        await expect(page.locator('#patch-notes-history .patch-note-entry')).toHaveCount(20);
        expect(archives).toHaveLength(1);
        expect(errors).toEqual([]);
        await page.locator('#btn-close-patch-notes-header').click();
        await page.screenshot({ path: testInfo.outputPath('firefox-login.png') });
    } finally { await browser.close(); }
});
