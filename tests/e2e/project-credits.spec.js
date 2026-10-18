import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test.use({ trace: 'off', video: 'off' });
const copied = process.env.EIDOLON_E2E_STATIC_ROOT;
const release = copied ? JSON.parse(readFileSync(path.join(copied, 'release.json'), 'utf8')).commit : null;

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) test.describe(`Project credits ${viewport.width}`, () => {
    test.use({ viewport });
    test('login and Help open readable credits with matching source and no account requirement', async ({ page, context, browser, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        // Static UI preparation only; no auth/session or game-menu flow claim.
        await page.route('**/src/main.js*', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
        await page.goto('/', { waitUntil: 'networkidle' });
        const login = page.locator('#login-component-notices');
        await expect(login).toBeVisible();
        const popupPromise = context.waitForEvent('page');
        await login.click();
        const credits = await popupPromise;
        const creditFailures = collectBrowserFailures(credits, baseURL);
        await credits.waitForLoadState('networkidle');
        await expect(credits.locator('h1')).toHaveText('Credits & component notices');
        expect(new URL(credits.url()).searchParams.get('release')).toBe(release);
        expect(await credits.evaluate(() => window.opener === null)).toBe(true);
        await expect(credits.locator('section[aria-labelledby="project"]')).toContainText('Robert Mendola');
        const sources = await credits.locator('[data-eidolon-project-source]').evaluateAll(links => links.map(link => link.href));
        expect(sources).toHaveLength(4);
        for (const href of sources) expect(new URL(href).pathname).toMatch(new RegExp(`^/aeml/eidolon/(?:blob|tree)/${release || 'master'}(?:/|$)`));
        const local = await credits.locator('a').evaluateAll(links => links.map(link => link.href).filter(href => new URL(href).origin === location.origin));
        for (const href of local) expect((await context.request.get(href)).ok(), href).toBe(true);
        expect(await credits.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        await credits.screenshot({ path: testInfo.outputPath('credits-top.png') });
        await credits.locator('#characters').scrollIntoViewIfNeeded();
        await credits.screenshot({ path: testInfo.outputPath('credits-source-assets.png') });
        expect(creditFailures, creditFailures.join('\n')).toEqual([]);
        await credits.close();

        await page.evaluate(() => {
            document.getElementById('start-screen').style.display = 'none';
            document.body.classList.toggle('mobile-mode', innerWidth < 900);
            document.getElementById('help-screen').style.display = 'flex';
        });
        await page.locator('#help-credits-guide summary').click();
        const help = page.locator('#help-credits-guide a');
        await expect(help).toBeVisible();
        expect(new URL(await help.evaluate(link => link.href)).searchParams.get('release')).toBe(release);
        const helpPopupPromise = context.waitForEvent('page');
        await help.click();
        const helpCredits = await helpPopupPromise;
        const helpFailures = collectBrowserFailures(helpCredits, baseURL);
        await helpCredits.waitForLoadState('domcontentloaded');
        await expect(helpCredits.locator('h1')).toHaveText('Credits & component notices');
        await expect(page.locator('#help-screen')).toBeVisible();
        await page.locator('#help-screen').screenshot({ path: testInfo.outputPath('help-credits.png') });
        expect(helpFailures, helpFailures.join('\n')).toEqual([]);
        await helpCredits.close();

        const noJS = await browser.newContext({ javaScriptEnabled: false, viewport });
        try {
            const staticPage = await noJS.newPage();
            const staticFailures = collectBrowserFailures(staticPage, baseURL);
            const response = await staticPage.goto(new URL(`assets/notices/index.html${release ? '?release=' + release : ''}`, baseURL).href);
            expect(response.ok()).toBe(true);
            await expect(staticPage.locator('section[aria-labelledby="project"]')).toContainText('GNU AGPL version 3 only');
            expect(await staticPage.locator('script, form, iframe').count()).toBe(0);
            expect(await staticPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
            expect(staticFailures, staticFailures.join('\n')).toEqual([]);
        } finally { await noJS.close(); }
        expect(failures, failures.join('\n')).toEqual([]);
    });
});
